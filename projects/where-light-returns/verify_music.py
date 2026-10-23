"""Validate the rendered artifacts independently of the composition engine.

Run after score.py. Writes validation.json and, when matplotlib is available,
audio-quality.png. A failed requirement produces a non-zero exit status.
"""
from __future__ import annotations
import argparse
import bisect
from collections import defaultdict
import hashlib
import json
import math
import os
from pathlib import Path
import struct
import sys
import wave

import numpy as np
from scipy.signal import resample_poly, spectrogram


def read_midi(path):
    data = path.read_bytes()
    if data[:8] != b'MThd\x00\x00\x00\x06':
        raise ValueError('Invalid Standard MIDI File header')
    file_format, count, ppq = struct.unpack('>HHH', data[8:14])
    if file_format != 1 or ppq & 0x8000:
        raise ValueError('Expected format-1 PPQ MIDI')
    tracks, pos = [], 14
    for _ in range(count):
        if data[pos:pos + 4] != b'MTrk':
            raise ValueError('Missing MIDI track header')
        length = int.from_bytes(data[pos + 4:pos + 8], 'big')
        end, pos = pos + 8 + length, pos + 8
        events, tick, running = [], 0, None

        def variable():
            nonlocal pos
            value = 0
            for _ in range(4):
                byte = data[pos]
                pos += 1
                value = (value << 7) | (byte & 127)
                if not byte & 128:
                    return value
            raise ValueError('Invalid MIDI variable-length integer')

        while pos < end:
            tick += variable()
            status = data[pos]
            if status & 128:
                pos += 1
                if status < 240:
                    running = status
            elif running is None:
                raise ValueError('Missing MIDI running status')
            else:
                status = running
            if status == 255:
                kind = data[pos]
                pos += 1
                size = variable()
                payload = data[pos:pos + size]
                pos += size
                events.append((tick, status, kind, payload))
            elif status in (240, 247):
                size = variable()
                pos += size
                running = None
            else:
                size = 1 if status >> 4 in (12, 13) else 2
                payload = tuple(data[pos:pos + size])
                pos += size
                if len(payload) != size or any(v >= 128 for v in payload):
                    raise ValueError('Invalid MIDI channel message')
                events.append((tick, status, None, payload))
        if pos != end:
            raise ValueError('Invalid MIDI track length')
        tracks.append(events)
    if pos != len(data):
        raise ValueError('Unexpected trailing MIDI bytes')
    return ppq, tracks


def db(value):
    return float(20 * np.log10(max(float(value), 1e-12)))


def rms(signal):
    return float(np.sqrt(np.mean(np.square(signal, dtype=np.float64)))) if signal.size else 0.0


def longest_run(mask):
    boundaries = np.diff(np.r_[False, mask, False].astype(np.int8))
    starts, ends = np.flatnonzero(boundaries == 1), np.flatnonzero(boundaries == -1)
    return int(np.max(ends - starts)) if len(starts) else 0


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--project', type=Path, default=Path(__file__).resolve().parent)
    args = ap.parse_args()
    root = args.project.resolve()
    report = {'status': 'running', 'checks': [], 'limitations': [
        'Signal analysis confirms technical integrity; it is not a substitute for human listening.',
        '4x oversampling estimates intersample peaks; this is not a certified true-peak meter.',
        'External MIDI players may use different SoundFonts, controller curves and effects.',
    ]}

    def check(name, passed, detail=None):
        row = {'name': name, 'passed': bool(passed)}
        if detail is not None:
            row['detail'] = detail
        report['checks'].append(row)

    try:
        notes = json.loads((root / 'notes.json').read_text())
        mix = json.loads((root / 'mix.json').read_text())
        mix_report = json.loads((root / 'mix-report.json').read_text())
        rows = notes['notes']
        with wave.open(str(root / 'song.wav'), 'rb') as reader:
            sr, frames = reader.getframerate(), reader.getnframes()
            channels, width = reader.getnchannels(), reader.getsampwidth()
            if width != 2:
                raise ValueError('Expected 16-bit PCM WAV')
            pcm = np.frombuffer(reader.readframes(frames), dtype='<i2').reshape(-1, channels)
        audio = pcm.astype(np.float32) / 32768
        duration = frames / sr
        check('48 kHz stereo PCM', sr == 48000 and channels == 2 and width == 2)
        check('Approximately 90 seconds', 89.5 < duration < 90.5, duration)
        check('WAV duration agrees with score', abs(duration - notes['total']) <= 1 / sr)
        check('Mix and score duration agree', abs(mix['total'] - notes['total']) < 1e-8)
        check('Audio samples are finite', np.isfinite(audio).all())
        peak = float(np.max(np.abs(audio)))
        true_peak = max(float(np.max(np.abs(resample_poly(audio[:, ch], 4, 1)))) for ch in range(channels))
        clipping = int(np.count_nonzero(np.abs(pcm.astype(np.int32)) >= 32767))
        check('No clipped samples', clipping == 0, {'clipped_samples': clipping, 'peak_dbfs': db(peak)})
        check('Intersample headroom', true_peak < 0.99, {'estimated_true_peak_dbfs': db(true_peak)})
        check('Audio is not silent', rms(audio) > 0.005)
        check('Limiter avoids excessive gain reduction', mix_report['limiter_min_gain'] >= 0.70,
              mix_report['limiter_min_gain'])
        check('Mix report matches WAV', abs(mix_report['duration'] - duration) < 1 / sr
              and abs(mix_report['peak'] - peak) < 0.0001)
        first_note, last_note = min(n['t0'] for n in rows), max(n['t1'] for n in rows)
        block = sr // 10
        block_rms = np.sqrt(np.mean(audio[:len(audio) // block * block].reshape(-1, block, 2) ** 2, axis=(1, 2)))
        times = (np.arange(len(block_rms)) + 0.5) * 0.1
        internal = (times > first_note + 0.1) & (times < last_note)
        quiet_gap = longest_run((block_rms < 10 ** (-75 / 20)) & internal) * 0.1
        check('No unintended internal silence over 0.8 seconds', quiet_gap <= 0.8, {'longest_low_level_gap_seconds': quiet_gap})
        check('Ending resolves into silence', np.max(np.abs(audio[-int(0.1 * sr):])) < 0.002,
              {'last_100ms_peak_dbfs': db(np.max(np.abs(audio[-int(0.1 * sr):])))})
        sections = []
        for section in notes['sections']:
            chunk = audio[round(section['start_seconds'] * sr):round(section['end_seconds'] * sr)]
            sections.append({**section, 'rms_dbfs': db(rms(chunk)), 'peak_dbfs': db(np.max(np.abs(chunk)))})
        report['sections'] = sections
        levels = {s['name']: s['rms_dbfs'] for s in sections}
        check('Climax rises above the opening', levels['climax'] - levels['opening'] > 3,
              {'increase_db': levels['climax'] - levels['opening']})
        check('Reprise softens after climax', levels['return'] < levels['climax'] - 2,
              {'decrease_db': levels['climax'] - levels['return']})
        report['audio'] = {'sample_rate': sr, 'channels': channels, 'bit_depth': 16,
                           'frames': frames, 'duration_seconds': duration, 'rms_dbfs': db(rms(audio)),
                           'sample_peak_dbfs': db(peak), 'estimated_true_peak_dbfs': db(true_peak),
                           'stereo_correlation': float(np.corrcoef(audio.T)[0, 1]),
                           'last_note_off_seconds': last_note, 'mix_report': mix_report}

        ranges = {0: (21, 108), 1: (36, 84), 2: (55, 103), 3: (36, 96),
                  4: (60, 96), 5: (34, 77), 6: (24, 103), 7: (36, 65), 9: (0, 127)}
        check('All note events valid', all(0 <= n['p'] <= 127 and 1 <= n['v'] <= 127
              and 0 <= n['t0'] < n['t1'] <= duration
              and all(math.isfinite(n[k]) for k in ('t0', 't1')) for n in rows))
        presets = json.loads((root / 'soundfont-presets.json').read_text())
        font = root / 'sound_library' / 'GeneralUser-GS' / 'GeneralUser-GS.sf2'
        font_hash = hashlib.sha256(font.read_bytes()).hexdigest()
        expected_hash = font.with_suffix('.sf2.sha256').read_text().strip().split()[0]
        check('SoundFont checksum verified', font_hash == expected_hash == notes['soundfont_sha256'], font_hash)
        stems = []
        for channel, config in mix['channels'].items():
            ch = int(channel)
            channel_rows = [n for n in rows if n['ch'] == ch]
            pitches = [n['p'] for n in channel_rows]
            stem_path = root / 'work' / 'stems' / f'ch{ch:02d}.raw'
            stem = np.fromfile(stem_path, dtype='<f4').reshape(-1, 2)
            active_start, active_end = min(n['t0'] for n in channel_rows), max(n['t1'] for n in channel_rows)
            active = stem[int(active_start * sr):min(len(stem), int((active_end + 0.2) * sr))]
            lo, hi = ranges[ch]
            effective_bank = 128 if ch == 9 else config['bank']
            preset = next((p for p in presets if p['bank'] == effective_bank and p['program'] == config['program']), None)
            check(f'{config["name"]}: real non-silent stem', np.isfinite(stem).all() and rms(active) > 1e-5)
            check(f'{config["name"]}: requested SoundFont preset exists', preset is not None)
            check(f'{config["name"]}: practical instrument range', min(pitches) >= lo and max(pitches) <= hi)
            check(f'{config["name"]}: complete frame count', frames <= len(stem) <= frames + 63)
            stems.append({'channel': ch, 'name': config['name'], 'note_count': len(pitches),
                          'pitch_range': [min(pitches), max(pitches)], 'active_rms_dbfs': db(rms(active)),
                          'peak_dbfs': db(np.max(np.abs(stem))), 'preset': preset})
        report['stems'] = stems
        check('All nine instrument tracks rendered', len(stems) == 9 and sum(s['note_count'] for s in stems) == len(rows))

        ppq, tracks = read_midi(root / 'song.mid')
        tempo_events = [(tick, int.from_bytes(value, 'big')) for tick, status, kind, value in tracks[0]
                        if status == 255 and kind == 81]
        tempo_ticks, tempo_seconds = [], []
        elapsed, last_tick, last_us = 0.0, 0, 500000
        for tick, us in tempo_events:
            elapsed += (tick - last_tick) * last_us / (ppq * 1e6)
            tempo_ticks.append(tick)
            tempo_seconds.append(elapsed)
            last_tick, last_us = tick, us

        def tick_seconds(tick):
            index = bisect.bisect_right(tempo_ticks, tick) - 1
            return tempo_seconds[index] + (tick - tempo_ticks[index]) * tempo_events[index][1] / (ppq * 1e6)

        check('MIDI D major key and 4/4 meter', any(status == 255 and kind == 89 and value == b'\x02\x00'
              for _, status, kind, value in tracks[0]) and any(status == 255 and kind == 88 and value[:2] == b'\x04\x02'
              for _, status, kind, value in tracks[0]))
        starts, ends, controllers = defaultdict(list), defaultdict(list), defaultdict(list)
        midi_names, programs = {}, {}
        initial_cc = defaultdict(dict)
        for track in tracks[1:]:
            name = next(value.decode('utf-8') for _, status, kind, value in track if status == 255 and kind == 3)
            for tick, status, kind, value in track:
                ch, typ = status & 15, status >> 4
                if typ == 9 and value[1]:
                    starts[ch].append((value[0], tick_seconds(tick), value[1]))
                elif typ == 8 or (typ == 9 and not value[1]):
                    ends[ch].append((value[0], tick_seconds(tick)))
                elif typ == 12:
                    programs[ch], midi_names[ch] = value[0], name
                elif typ == 11:
                    if tick == 0:
                        initial_cc[ch][value[0]] = value[1]
                    else:
                        controllers[ch].append((tick_seconds(tick), value[0], value[1]))
        note_errors, control_errors = [], []
        for channel, config in mix['channels'].items():
            ch = int(channel)
            expected_notes = [n for n in rows if n['ch'] == ch]
            onsets = sorted(starts[ch], key=lambda e: (e[0], e[1]))
            expected = sorted(expected_notes, key=lambda n: (n['p'], n['t0']))
            check(f'{config["name"]}: MIDI note count', len(onsets) == len(expected) == len(ends[ch]))
            for actual, intended in zip(onsets, expected):
                check_ok = actual[0] == intended['p'] and actual[2] == intended['v']
                if not check_ok:
                    raise ValueError(f'Pitch or velocity differs in MIDI channel {ch}')
                note_errors.append(abs(actual[1] - intended['t0']))
            for actual, intended in zip(sorted(ends[ch]), sorted(expected_notes, key=lambda n: (n['p'], n['t1']))):
                if actual[0] != intended['p']:
                    raise ValueError(f'Note-off pitch differs in MIDI channel {ch}')
                note_errors.append(abs(actual[1] - intended['t1']))
            cc = initial_cc[ch]
            pan = min(127, max(0, round(64 + 63 * config['pan'])))
            volume = min(127, max(0, round(110 * config['gain'] ** (1 / 3))))
            check(f'{config["name"]}: MIDI program/bank/pan/name', programs[ch] == config['program']
                  and cc.get(0) * 128 + cc.get(32) == config['bank'] and cc.get(10) == pan
                  and cc.get(7) == volume and cc.get(11) == 100 and midi_names[ch] == config['name'])
            expected_cc = sorted([c for c in notes['controllers'] if c['channel'] == ch],
                                 key=lambda c: (c['time_seconds'], c['controller'], c['value']))
            actual_cc = sorted(controllers[ch], key=lambda c: (c[0], c[1], c[2]))
            check(f'{config["name"]}: all MIDI expression events retained', len(expected_cc) == len(actual_cc))
            for actual, intended in zip(actual_cc, expected_cc):
                if actual[1:] != (intended['controller'], intended['value']):
                    raise ValueError(f'Controller differs in MIDI channel {ch}')
                control_errors.append(abs(actual[0] - intended['time_seconds']))
        midi_duration = max(tick_seconds(track[-1][0]) for track in tracks)
        check('MIDI note timings match all JSON events', len(note_errors) == len(rows) * 2 and max(note_errors) < 0.002,
              {'note_count': len(rows), 'boundary_count': len(note_errors), 'max_error_ms': max(note_errors) * 1000})
        check('MIDI controller timing matches audio automation', max(control_errors) < 0.003,
              {'controller_count': len(control_errors), 'max_error_ms': max(control_errors) * 1000})
        check('MIDI includes complete release window', abs(midi_duration - duration) < 0.002,
              {'midi_seconds': midi_duration, 'wav_seconds': duration})
        report['midi'] = {'format': 1, 'ppq': ppq, 'tracks': len(tracks), 'tempo_changes': len(tempo_events),
                          'note_count': len(rows), 'duration_seconds': midi_duration,
                          'max_note_timing_error_ms': max(note_errors) * 1000,
                          'max_controller_timing_error_ms': max(control_errors) * 1000}

        try:
            plot_cache = root / 'work' / '.plot-cache'
            plot_cache.mkdir(parents=True, exist_ok=True)
            os.environ.setdefault('MPLCONFIGDIR', str(plot_cache / 'matplotlib'))
            os.environ.setdefault('XDG_CACHE_HOME', str(plot_cache))
            import matplotlib
            matplotlib.use('Agg')
            import matplotlib.pyplot as plt
            mono = audio.mean(axis=1)
            visual_audio = resample_poly(mono, 1, 3)
            frequency, stimes, power = spectrogram(visual_audio, fs=sr // 3, nperseg=1024, noverlap=768)
            fig, axes = plt.subplots(3, 1, figsize=(15, 9), sharex=True,
                                     gridspec_kw={'height_ratios': [1, 1, 1.6]})
            fig.suptitle('Where Light Returns — rendered audio verification', fontsize=15)
            stride = 480
            cropped = mono[:len(mono) // stride * stride].reshape(-1, stride)
            envelope_times = np.arange(len(cropped)) * stride / sr
            axes[0].fill_between(envelope_times, cropped.min(axis=1), cropped.max(axis=1), color='#3b687c', linewidth=0)
            axes[0].set_ylabel('Waveform')
            axes[1].plot(times, 20 * np.log10(np.maximum(block_rms, 1e-8)), color='#aa6038', linewidth=1)
            axes[1].set_ylim(-65, -5)
            axes[1].set_ylabel('100 ms RMS\n(dBFS)')
            axes[2].pcolormesh(stimes, frequency, 10 * np.log10(np.maximum(power, 1e-14)),
                               shading='auto', cmap='magma', vmin=-100, vmax=-35, rasterized=True)
            axes[2].set_yscale('log')
            axes[2].set_ylim(40, 8000)
            axes[2].set_ylabel('Frequency (Hz)')
            axes[2].set_xlabel('Time (seconds)')
            for section in sections:
                for ax in axes:
                    ax.axvline(section['start_seconds'], color='#888888', alpha=0.5, linewidth=0.7)
                midpoint = (section['start_seconds'] + section['end_seconds']) / 2
                axes[0].text(midpoint, 0.88, section['name'], transform=axes[0].get_xaxis_transform(),
                             ha='center', fontsize=9)
            axes[0].set_xlim(0, duration)
            fig.tight_layout(rect=(0, 0, 1, 0.97))
            fig.savefig(root / 'audio-quality.png', dpi=150)
            plt.close(fig)
            report['quality_plot'] = 'audio-quality.png'
        except ImportError:
            report['quality_plot'] = 'Skipped: matplotlib is not installed'
    except Exception as exc:
        report['error'] = f'{type(exc).__name__}: {exc}'
        check('Validation completed', False, report['error'])
    failures = [c for c in report['checks'] if not c['passed']]
    report['status'] = 'pass' if not failures else 'fail'
    report['passed_checks'] = len(report['checks']) - len(failures)
    report['failed_checks'] = len(failures)
    (root / 'validation.json').write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n')
    print(f'{report["status"].upper()}: {report["passed_checks"]}/{len(report["checks"])} checks')
    for failure in failures:
        print(f'FAIL: {failure["name"]}: {failure.get("detail", "")}')
    if 'midi' in report:
        print('MIDI:', json.dumps(report['midi']))
    if 'audio' in report:
        print('AUDIO:', json.dumps(report['audio']))
    return 0 if report['status'] == 'pass' else 1


if __name__ == '__main__':
    sys.exit(main())
