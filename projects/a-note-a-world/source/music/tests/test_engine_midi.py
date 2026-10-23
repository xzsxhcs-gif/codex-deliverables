"""Independent SMF checks for the locally corrected upstream exporter."""
import bisect
import importlib.util
import math
import os
from pathlib import Path
import struct
import tempfile
import unittest


ENGINE = Path(__file__).resolve().parents[1] / 'engine' / 'compose_kit.py'
spec = importlib.util.spec_from_file_location('audited_compose', ENGINE)
ck = importlib.util.module_from_spec(spec)
spec.loader.exec_module(ck)


def parse_midi(path):
    """Read MIDI independently of the composition engine and its time helpers."""
    raw = path.read_bytes()
    assert raw[:8] == b'MThd\x00\x00\x00\x06'
    file_format, track_count, ppq = struct.unpack('>HHH', raw[8:14])
    assert file_format == 1
    tracks, pos = [], 14
    for _ in range(track_count):
        assert raw[pos:pos + 4] == b'MTrk'
        size = int.from_bytes(raw[pos + 4:pos + 8], 'big')
        pos += 8
        data = raw[pos:pos + size]
        pos += size
        events, cursor, tick = [], 0, 0

        def variable():
            nonlocal cursor
            number = 0
            while True:
                byte = data[cursor]
                cursor += 1
                number = (number << 7) | (byte & 127)
                if not byte & 128:
                    return number

        while cursor < len(data):
            tick += variable()
            status = data[cursor]
            cursor += 1
            if status == 255:
                kind = data[cursor]
                cursor += 1
                length = variable()
                value = data[cursor:cursor + length]
                cursor += length
                events.append((tick, status, kind, value))
            else:
                assert status & 128, 'Exporter should use explicit MIDI status bytes'
                count = 1 if status >> 4 in (12, 13) else 2
                value = tuple(data[cursor:cursor + count])
                cursor += count
                events.append((tick, status, None, value))
        tracks.append(events)
    assert pos == len(raw)
    return ppq, tracks


class ExportTests(unittest.TestCase):
    def setUp(self):
        ck.CHANNELS.clear()
        ck.NOTES.clear()
        ck.CC.clear()
        ck.tempo([(0, 48, 90, 90), (48, 80, 90, 104),
                  (80, 112, 104, 104), (112, 128, 104, 62)],
                 intro=0.25, tail=4, seed=2901)

    def test_exact_linear_tempo_integral(self):
        expected = (0.25 + 48 * 60 / 90
                    + 60 / (14 / 32) * math.log(104 / 90)
                    + 32 * 60 / 104
                    + 60 / (-42 / 16) * math.log(62 / 104))
        self.assertAlmostEqual(ck.beat2sec(128), expected, places=11)
        self.assertAlmostEqual(ck.beat2sec(-0.1), 0.25 - 0.1 * 60 / 90, places=11)
        self.assertEqual(ck.beat2sec(0), 0.25)

    def test_midi_timing_and_instrument_data(self):
        ck.channel(0, 'Piano', 0, gain=0.125, pan=-0.15)
        ck.channel(1, 'Cello', 42, bank=128, pan=0.35)
        for i in range(513):
            beat = max(0, i * 0.249 - (0.005 if i % 2 else 0))
            ck.note(i % 2, 55 + i % 18, beat, 0.18, 70, hum=0)
        ck.NOTES[0]['b0'] = -0.008
        ck.expression(1, 16, 128, 72, 112, step=0.25)
        saved = Path.cwd()
        with tempfile.TemporaryDirectory() as directory:
            try:
                os.chdir(directory)
                ck._midi(128, key_signature=(2, 0))
                ppq, tracks = parse_midi(Path('song.mid'))
            finally:
                os.chdir(saved)
        tempos = [(tick, int.from_bytes(value, 'big'))
                  for tick, status, kind, value in tracks[0]
                  if status == 255 and kind == 81]
        tempo_ticks, seconds, last_tick, previous_us = [], [], 0, 500000
        elapsed = 0.0
        for tick, us in tempos:
            elapsed += (tick - last_tick) * previous_us / (ppq * 1e6)
            tempo_ticks.append(tick)
            seconds.append(elapsed)
            last_tick, previous_us = tick, us

        def time_at(tick):
            index = bisect.bisect_right(tempo_ticks, tick) - 1
            return seconds[index] + (tick - tempo_ticks[index]) * tempos[index][1] / (ppq * 1e6)

        errors = []
        for ch, track in enumerate(tracks[1:]):
            starts = [(tick, value) for tick, status, _, value in track if status == 0x90 | ch]
            ends = [(tick, value) for tick, status, _, value in track if status == 0x80 | ch]
            intended = [n for n in ck.NOTES if n['ch'] == ch]
            self.assertEqual(len(starts), len(intended))
            self.assertEqual(len(ends), len(intended))
            for (tick, value), note in zip(starts, intended):
                self.assertEqual(value, (note['pitch'], note['vel']))
                errors.append(abs(time_at(tick) - ck.beat2sec(max(0, note['b0']))))
            for (tick, value), note in zip(ends, intended):
                errors.append(abs(time_at(tick) - ck.beat2sec(note['b1'])))
            controls = [(tick, value) for tick, status, _, value in track if status == 0xB0 | ch]
            initial = [value for tick, value in controls if tick == 0]
            for number in (0, 32, 7, 10, 11):
                self.assertTrue(any(value[0] == number for value in initial))
            if ch == 0:
                self.assertIn((7, 55), initial)
            self.assertTrue(any(status == 255 and kind == 3 for _, status, kind, _ in track))
            self.assertEqual(track[-1][1:3], (255, 47))
            self.assertAlmostEqual(time_at(track[-1][0]), ck.beat2sec(128) + ck.TAIL, delta=0.0015)
        actual_cc11 = [(tick, value) for tick, status, _, value in tracks[2]
                       if status == 0xB1 and value[0] == 11 and tick > 0]
        self.assertEqual(len(actual_cc11), len(ck.CC))
        self.assertTrue(any(kind == 89 and value == bytes([2, 0])
                            for _, _, kind, value in tracks[0]))
        self.assertLess(max(errors), 0.0015)
        print(f'\nMIDI timing: {len(errors)} note boundaries; max drift {max(errors) * 1000:.4f} ms')

    def test_repeated_pitch_retrigger_order(self):
        ck.channel(0, 'Repeated piano note', 0)
        # Deliberately insert the later note first; event order must still be safe.
        ck.note(0, 60, 1, 1, 70, hum=0)
        ck.note(0, 60, 0, 1, 70, hum=0)
        saved = Path.cwd()
        with tempfile.TemporaryDirectory() as directory:
            try:
                os.chdir(directory)
                ck._midi(2)
                ppq, tracks = parse_midi(Path('song.mid'))
            finally:
                os.chdir(saved)
        initial_us = round(60_000_000 / 90)
        overlap_tick = round(ck.INTRO * 1e6 * ppq / initial_us) + ppq
        retrigger = [status for tick, status, _, _ in tracks[1]
                     if tick == overlap_tick and status in (0x80, 0x90)]
        self.assertEqual(retrigger, [0x80, 0x90])


if __name__ == '__main__':
    unittest.main()
