"""Prepare the existing original score on one deterministic film clock.

No notes, instruments or mixed musical samples are changed. A silent lead-in
gives the opening question and first-note action room to read; final padding
aligns PCM audio exactly to the 30 fps film boundary.
"""
from __future__ import annotations

import argparse
from collections import defaultdict
from fractions import Fraction
import hashlib
import json
import math
from pathlib import Path
import struct
import wave

import numpy as np


SOURCE = Path(__file__).resolve().parent
PROJECT = SOURCE.parent
FPS = 30
LEAD_IN = 3.7


def variable_length(value: int) -> bytes:
    if value < 0:
        raise ValueError('Negative MIDI delta')
    result = [value & 127]
    while value > 127:
        value >>= 7
        result.insert(0, (value & 127) | 128)
    return bytes(result)


def read_midi(path: Path):
    """Independent SMF parser, retaining ordinary, meta and SysEx events."""
    raw = path.read_bytes()
    if raw[:8] != b'MThd\x00\x00\x00\x06':
        raise ValueError('Expected Standard MIDI header, length 6')
    midi_format, count, ppq = struct.unpack('>HHH', raw[8:14])
    if midi_format != 1 or not 0 < ppq < 32768:
        raise ValueError('Expected format-1 PPQ MIDI')
    cursor, tracks = 14, []
    for _ in range(count):
        if raw[cursor:cursor + 4] != b'MTrk':
            raise ValueError('Missing MIDI track')
        size = int.from_bytes(raw[cursor + 4:cursor + 8], 'big')
        data = raw[cursor + 8:cursor + 8 + size]
        cursor += 8 + size
        pos, tick, running, events = 0, 0, None, []

        def vlq():
            nonlocal pos
            number = 0
            for _ in range(4):
                byte = data[pos]
                pos += 1
                number = (number << 7) | (byte & 127)
                if byte < 128:
                    return number
            raise ValueError('Invalid MIDI variable-length value')

        while pos < len(data):
            tick += vlq()
            status = data[pos]
            if status >= 128:
                pos += 1
                if status < 240:
                    running = status
            elif running is None:
                raise ValueError('Invalid MIDI running status')
            else:
                status = running
            if status == 255:
                kind = data[pos]
                pos += 1
                length = vlq()
                payload = data[pos:pos + length]
                pos += length
            elif status in (240, 247):
                kind = None
                length = vlq()
                payload = data[pos:pos + length]
                pos += length
                running = None
            else:
                kind = None
                length = 1 if status >> 4 in (12, 13) else 2
                payload = data[pos:pos + length]
                pos += length
                if len(payload) != length or any(n >= 128 for n in payload):
                    raise ValueError('Invalid MIDI channel data')
            events.append((tick, status, kind, bytes(payload)))
        if pos != len(data):
            raise ValueError('MIDI track length mismatch')
        tracks.append(events)
    if cursor != len(raw):
        raise ValueError('Unexpected trailing MIDI data')
    return ppq, tracks


def midi_clock(ppq, conductor):
    tempos = [(tick, int.from_bytes(payload, 'big'))
              for tick, status, kind, payload in conductor
              if status == 255 and kind == 81]
    if not tempos or tempos[0][0] != 0:
        tempos.insert(0, (0, 500000))
    ticks, seconds, last_tick, last_us, elapsed = [], [], 0, 500000, 0.0
    for tick, us in tempos:
        elapsed += (tick - last_tick) * last_us / (ppq * 1e6)
        ticks.append(tick)
        seconds.append(elapsed)
        last_tick, last_us = tick, us

    def time_at(tick):
        import bisect
        index = bisect.bisect_right(ticks, tick) - 1
        return seconds[index] + (tick - ticks[index]) * tempos[index][1] / (ppq * 1e6)

    return time_at, tempos


def write_midi(path, ppq, tracks):
    chunks = []
    for events in tracks:
        result, last = bytearray(), 0
        for tick, status, kind, payload in events:
            result.extend(variable_length(tick - last))
            if status == 255:
                result.extend(bytes([255, kind]) + variable_length(len(payload)) + payload)
            elif status in (240, 247):
                result.extend(bytes([status]) + variable_length(len(payload)) + payload)
            else:
                result.extend(bytes([status]) + payload)
            last = tick
        chunks.append(b'MTrk' + struct.pack('>I', len(result)) + result)
    path.write_bytes(b'MThd' + struct.pack('>IHHH', 6, 1, len(chunks), ppq) + b''.join(chunks))


def delay_midi(source: Path, output: Path, delay: float, duration: float):
    ppq, tracks = read_midi(source)
    _, tempos = midi_clock(ppq, tracks[0])
    initial_us = tempos[0][1]
    offset_ticks = round(delay * 1e6 * ppq / initial_us)
    shifted = []
    for events in tracks:
        result = []
        for tick, status, kind, payload in events:
            # Initialization remains available during silence. Musical events
            # and the complete tempo ramp share the same added tick interval.
            musical = status < 240 and status >> 4 in (8, 9, 10)
            result.append((tick + offset_ticks if tick > 0 or musical else tick,
                           status, kind, payload))
        shifted.append(result)
    clock, shifted_tempos = midi_clock(ppq, shifted[0])
    end_tick = max(tick for track in shifted for tick, *_ in track)
    end_tick += round((duration - clock(end_tick)) * 1e6 * ppq / shifted_tempos[-1][1])
    for index, events in enumerate(shifted):
        shifted[index] = [(end_tick if status == 255 and kind == 47 else tick,
                           status, kind, payload) for tick, status, kind, payload in events]
    write_midi(output, ppq, shifted)
    return offset_ticks


def midi_note_errors(path: Path, notes):
    ppq, tracks = read_midi(path)
    clock, _ = midi_clock(ppq, tracks[0])
    starts, ends, expected = defaultdict(list), defaultdict(list), defaultdict(list)
    for events in tracks[1:]:
        for tick, status, _, payload in events:
            key = (status & 15, payload[0]) if status < 240 and payload else None
            if status >> 4 == 9 and payload[1] > 0:
                starts[key].append((clock(tick), payload[1]))
            elif status >> 4 == 8 or status >> 4 == 9 and payload[1] == 0:
                ends[key].append(clock(tick))
    for note in notes:
        expected[(note['ch'], note['p'])].append(note)
    if set(starts) != set(expected) or set(ends) != set(expected):
        raise AssertionError('MIDI note channels/pitches differ from JSON')
    errors = []
    for key, rows in expected.items():
        rows.sort(key=lambda n: n['t0'])
        ons, offs = sorted(starts[key]), sorted(ends[key])
        if len(rows) != len(ons) or len(rows) != len(offs):
            raise AssertionError(f'MIDI note count differs for {key}')
        for note, (on, velocity), off in zip(rows, ons, offs):
            if velocity != note['v']:
                raise AssertionError('MIDI velocity differs from JSON')
            errors.extend([abs(on - note['t0']), abs(off - note['t1'])])
    return errors, clock(max(tick for track in tracks for tick, *_ in track))


def prepare(music_source: Path, root: Path):
    root.mkdir(parents=True, exist_ok=True)
    with wave.open(str(music_source / 'song.wav'), 'rb') as reader:
        rate, channels, width, source_frames = (reader.getframerate(), reader.getnchannels(),
                                                 reader.getsampwidth(), reader.getnframes())
        if (rate, channels, width) != (48000, 2, 2):
            raise ValueError('Expected existing 48 kHz stereo 16-bit PCM master')
        pcm = reader.readframes(source_frames)
    lead_frames = round(LEAD_IN * rate)
    video_frames = math.ceil(Fraction((source_frames + lead_frames) * FPS, rate))
    total_frames = video_frames * (rate // FPS)
    padding = total_frames - source_frames - lead_frames
    output_pcm = bytes(lead_frames * channels * width) + pcm + bytes(padding * channels * width)
    with wave.open(str(root / 'final_music.wav'), 'wb') as writer:
        writer.setnchannels(channels)
        writer.setsampwidth(width)
        writer.setframerate(rate)
        writer.writeframes(output_pcm)
    duration = total_frames / rate
    data = json.loads((music_source / 'notes.json').read_text(encoding='utf-8'))
    source_total = data['total']
    data.update(total=duration, frame_count=video_frames, frameCount=video_frames, fps=FPS,
                filmTitle='一音成境', originalMusicStart=LEAD_IN,
                source_music_duration=source_frames / rate, source_score_duration=source_total,
                audio_padding_samples=padding,
                timing={'clock': 'film seconds, including the silent prelude',
                        'source_to_film_offset_seconds': LEAD_IN,
                        'lead_in_pcm_samples': lead_frames,
                        'beat_zero_film_seconds': 0.3 + LEAD_IN,
                        'frame_count': video_frames, 'fps': FPS,
                        'samples_per_frame': rate // FPS,
                        'original_musical_samples_unchanged': True})
    for note in data['notes']:
        note['source_t0'], note['source_t1'] = note['t0'], note['t1']
        for name in ('t0', 't1', 'start_seconds', 'end_seconds'):
            if name in note:
                note[name] = round(note[name] + LEAD_IN, 5)
    for kind in ('bars', 'beats'):
        data['source_' + kind] = data[kind]
        data[kind] = [round(t + LEAD_IN, 5) for t in data[kind]]
    for section in data['sections']:
        for key in ('start_seconds', 'end_seconds'):
            section['source_' + key] = section[key]
            section[key] = round(section[key] + LEAD_IN, 5)
    for control in data['controllers']:
        control['source_time_seconds'] = control['time_seconds']
        control['time_seconds'] = round(control['time_seconds'] + LEAD_IN, 5)
    offset_ticks = delay_midi(music_source / 'song.mid', root / 'final_music.mid', LEAD_IN, duration)
    errors, midi_end = midi_note_errors(root / 'final_music.mid', data['notes'])
    if max(errors) >= 0.002 or abs(midi_end - duration) >= 0.002:
        raise AssertionError('Prepared MIDI timing is inconsistent with film clock')
    data['timing']['midi_delay_ticks'] = offset_ticks
    data['timing']['midi_note_max_error_seconds'] = max(errors)
    (root / 'notes.json').write_text(json.dumps(data, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    audio = np.frombuffer(output_pcm, dtype='<i2').reshape(-1, 2).astype(np.float32) / 32768
    size = rate // 10
    count = len(audio) // size
    levels = np.sqrt(np.mean(audio[:count * size].reshape(count, size, 2) ** 2, axis=(1, 2)))
    maximum = max(float(np.quantile(levels, .95)), 1e-9)
    features = {'clock': 'film seconds', 'step': .1,
                'times': [round((i + .5) * .1, 4) for i in range(count)],
                'rms': [round(float(r), 7) for r in levels],
                'normalized': [round(min(float(r) / maximum, 1), 6) for r in levels]}
    (root / 'music_features.json').write_text(json.dumps(features, separators=(',', ':')) + '\n')
    report = {'status': 'passed', 'duration_seconds': duration, 'frame_count': video_frames,
              'fps': FPS, 'sample_rate': rate, 'channels': channels, 'bit_depth': width * 8,
              'source_pcm_frames': source_frames, 'lead_in_pcm_frames': lead_frames,
              'tail_padding_pcm_frames': padding, 'original_pcm_sha256': hashlib.sha256(pcm).hexdigest(),
              'embedded_pcm_sha256': hashlib.sha256(output_pcm[lead_frames * 4:(lead_frames + source_frames) * 4]).hexdigest(),
              'midi_offset_ticks': offset_ticks, 'midi_note_boundaries_checked': len(errors),
              'midi_max_note_error_seconds': max(errors), 'midi_duration_seconds': midi_end,
              'first_note_seconds': min(n['t0'] for n in data['notes'])}
    (root / 'music-preparation.json').write_text(json.dumps(report, indent=2) + '\n')
    print(json.dumps(report, indent=2))
    return report


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--music-source', type=Path, default=SOURCE / 'music')
    parser.add_argument('--output', type=Path, default=PROJECT)
    args = parser.parse_args()
    prepare(args.music_source.resolve(), args.output.resolve())


if __name__ == '__main__':
    main()
