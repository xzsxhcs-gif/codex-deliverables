"""Check actual music, MIDI, encoded frames and A/V timing of the finished film.

Examples:
  python source/verify_film.py --music-only
  python source/verify_film.py --video previews/preview.mp4 --width 640 --height 360
  python source/verify_film.py --video final_video.mp4

Numerical image checks do not replace the director's keyframe review.
"""
from __future__ import annotations

import argparse
from collections import defaultdict
from fractions import Fraction
import hashlib
import json
import math
from pathlib import Path
import subprocess
import sys
import wave

import numpy as np
from PIL import Image
from scipy.signal import correlate

from prepare_music import LEAD_IN, PROJECT, SOURCE, midi_clock, midi_note_errors, read_midi


def read_wav(path):
    with wave.open(str(path), 'rb') as reader:
        params = {'sample_rate': reader.getframerate(), 'channels': reader.getnchannels(),
                  'sample_width': reader.getsampwidth(), 'frames': reader.getnframes()}
        pcm = reader.readframes(params['frames'])
    if params['sample_width'] != 2:
        raise ValueError('Expected 16-bit PCM master')
    return params, pcm, np.frombuffer(pcm, dtype='<i2').reshape(-1, params['channels'])


def first_audible(audio, rate, threshold=1e-4):
    size = round(rate * .005)
    count = len(audio) // size
    signal = audio[:count * size].reshape(count, size, -1)
    levels = np.sqrt(np.mean(signal * signal, axis=(1, 2)))
    active = np.flatnonzero(levels > threshold)
    return None if not len(active) else float(active[0] * size / rate)


def estimate_lag(reference, encoded, rate, start, end):
    a = reference[round(start * rate):round(end * rate)].mean(axis=1)
    b = encoded[round(start * rate):round(end * rate)].mean(axis=1)
    n = min(len(a), len(b))
    if n < rate or np.std(a[:n]) < 1e-5 or np.std(b[:n]) < 1e-5:
        raise ValueError('Insufficient audio for synchronization correlation')
    a = a[:n] - a[:n].mean()
    b = b[:n] - b[:n].mean()
    values = correlate(b, a, mode='full', method='fft')
    center, margin = n - 1, round(rate * .25)
    selected = values[center - margin:center + margin + 1]
    lag = int(np.argmax(selected)) - margin
    normalized = float(np.max(selected) / np.sqrt(np.sum(a * a) * np.sum(b * b)))
    return {'start_seconds': start, 'end_seconds': end, 'lag_samples': lag,
            'lag_seconds': lag / rate, 'normalized_correlation': normalized}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--project', type=Path, default=PROJECT)
    ap.add_argument('--music-source', type=Path, default=SOURCE / 'music')
    ap.add_argument('--video', type=Path, default=Path('final_video.mp4'))
    ap.add_argument('--width', type=int, default=1920)
    ap.add_argument('--height', type=int, default=1080)
    ap.add_argument('--report', type=Path, default=Path('QA.json'))
    ap.add_argument('--music-only', action='store_true')
    args = ap.parse_args()
    root, music_source = args.project.resolve(), args.music_source.resolve()
    report = {'status': 'running', 'checks': [], 'limitations': [
        'Numerical frame statistics cannot establish artistic quality or rule out every geometry problem.',
        'Keyframe and motion review must be documented separately; this script does not claim human listening.',
        'The musical PCM master is unchanged; AAC is a lossy listening copy in the MP4.',
    ]}

    def check(name, passed, detail=None):
        item = {'name': name, 'passed': bool(passed)}
        if detail is not None:
            item['detail'] = detail
        report['checks'].append(item)

    try:
        notes = json.loads((root / 'notes.json').read_text(encoding='utf-8'))
        original_notes = json.loads((music_source / 'notes.json').read_text(encoding='utf-8'))
        original_params, original_pcm, _ = read_wav(music_source / 'song.wav')
        params, pcm, integer_audio = read_wav(root / 'final_music.wav')
        rate, expected_frames = params['sample_rate'], int(notes['frame_count'])
        fps, expected_duration = int(notes['fps']), float(notes['total'])
        audio = integer_audio.astype(np.float32) / 32768
        lead_samples = round(LEAD_IN * rate)
        byte_start, byte_end = lead_samples * 4, (lead_samples + original_params['frames']) * 4
        check('WAV is 48kHz stereo 16-bit PCM', (rate, params['channels'], params['sample_width']) == (48000, 2, 2))
        check('Film clock and PCM length agree exactly', params['frames'] * fps == expected_frames * rate,
              {'pcm_frames': params['frames'], 'video_frames': expected_frames, 'fps': fps})
        check('Duration is approximately 94 seconds', 93 < expected_duration < 95)
        check('Leading 3.7 seconds is silent', not any(pcm[:byte_start]))
        check('Original musical PCM is completely unchanged', pcm[byte_start:byte_end] == original_pcm,
              {'source_pcm_sha256': hashlib.sha256(original_pcm).hexdigest(),
               'embedded_pcm_sha256': hashlib.sha256(pcm[byte_start:byte_end]).hexdigest()})
        check('Only silent frame-alignment padding was appended', not any(pcm[byte_end:]), len(pcm[byte_end:]) // 4)
        peak = float(np.max(np.abs(audio)))
        check('No PCM clipping', np.count_nonzero(np.abs(integer_audio.astype(np.int32)) >= 32767) == 0,
              {'peak_dbfs': float(20 * np.log10(max(peak, 1e-12)))})
        check('All samples finite', np.isfinite(audio).all())
        check('643 musical notes and nine instruments retained', len(notes['notes']) == len(original_notes['notes']) == 643
              and len(set(n['ch'] for n in notes['notes'])) == 9)
        note_shift_correct = True
        for row, old in zip(notes['notes'], original_notes['notes']):
            note_shift_correct &= row['ch'] == old['ch'] and row['p'] == old['p'] and row['v'] == old['v']
            note_shift_correct &= abs(row['t0'] - old['t0'] - LEAD_IN) < 1e-7
            note_shift_correct &= abs(row['t1'] - old['t1'] - LEAD_IN) < 1e-7
        check('Every note uses the same global time offset', note_shift_correct)
        check('All visual notes remain within the film', all(0 <= n['t0'] < n['t1'] < expected_duration for n in notes['notes']))
        for name in ('bars', 'beats'):
            check(f'{name}: same musical clock', len(notes[name]) == len(original_notes[name]) and
                  all(abs(a - b - LEAD_IN) < 1e-7 for a, b in zip(notes[name], original_notes[name])))
        check('Section boundaries use the same global time offset', all(
            a['name'] == b['name'] and abs(a['start_seconds'] - b['start_seconds'] - LEAD_IN) < 1e-7
            and abs(a['end_seconds'] - b['end_seconds'] - LEAD_IN) < 1e-7
            for a, b in zip(notes['sections'], original_notes['sections'])))
        errors, midi_duration = midi_note_errors(root / 'final_music.mid', notes['notes'])
        check('Every MIDI note and velocity matches film-clock JSON', max(errors) < .002,
              {'note_boundaries_checked': len(errors), 'max_error_ms': max(errors) * 1000})
        check('MIDI ends at film duration within MIDI tick precision', abs(midi_duration - expected_duration) < .002,
              {'midi_duration_seconds': midi_duration, 'film_duration_seconds': expected_duration})
        ppq, midi_tracks = read_midi(root / 'final_music.mid')
        old_ppq, old_tracks = read_midi(music_source / 'song.mid')
        check('MIDI instruments, controllers and event payloads preserved', ppq == old_ppq
              and len(midi_tracks) == len(old_tracks)
              and all([(s, k, p) for _, s, k, p in new] == [(s, k, p) for _, s, k, p in old]
                      for new, old in zip(midi_tracks, old_tracks)))
        clock, _ = midi_clock(ppq, midi_tracks[0])
        actual_controls, expected_controls = defaultdict(list), defaultdict(list)
        for track in midi_tracks[1:]:
            for tick, status, _, payload in track:
                if status >> 4 == 11 and payload[0] == 11 and tick > 0:
                    actual_controls[(status & 15, payload[0])].append((clock(tick), payload[1]))
        for control in notes['controllers']:
            expected_controls[(control['channel'], control['controller'])].append((control['time_seconds'], control['value']))
        control_errors, controls_match = [], set(actual_controls) == set(expected_controls)
        for key, expected in expected_controls.items():
            actual, expected = sorted(actual_controls[key]), sorted(expected)
            controls_match &= len(actual) == len(expected)
            for (actual_time, actual_value), (expected_time, expected_value) in zip(actual, expected):
                controls_match &= actual_value == expected_value
                control_errors.append(abs(actual_time - expected_time))
        check('Every expression controller uses the same film clock', controls_match and max(control_errors, default=0) < .002,
              {'events_checked': len(control_errors), 'max_error_ms': max(control_errors, default=0) * 1000})
        first_note = min(n['t0'] for n in notes['notes'])
        pcm_onset = first_audible(audio, rate)
        check('First audible note matches documented film onset', pcm_onset is not None and abs(pcm_onset - first_note) < .04,
              {'note_seconds': first_note, 'detected_pcm_seconds': pcm_onset,
               'first_onset_visual_frame': math.ceil(first_note * fps),
               'maximum_30fps_visual_quantization_ms': 1000 / fps})
        report['music'] = {'duration_seconds': expected_duration, 'frames': expected_frames,
                           'fps': fps, 'pcm_parameters': params, 'first_note_seconds': first_note,
                           'first_audio_seconds': pcm_onset, 'midi_max_error_ms': max(errors) * 1000}

        if not args.music_only:
            video = args.video if args.video.is_absolute() else root / args.video
            metadata = json.loads(subprocess.check_output([
                'ffprobe', '-v', 'error', '-show_streams', '-show_format', '-of', 'json', str(video)], text=True))
            visuals = [s for s in metadata['streams'] if s['codec_type'] == 'video']
            sound = [s for s in metadata['streams'] if s['codec_type'] == 'audio']
            check('Exactly one video and one audio stream', len(visuals) == 1 and len(sound) == 1)
            v, a = visuals[0], sound[0]
            check('H.264 video', v['codec_name'] == 'h264')
            check('Universal yuv420p pixel format', v['pix_fmt'] == 'yuv420p', v['pix_fmt'])
            check('Requested resolution', (v['width'], v['height']) == (args.width, args.height),
                  {'width': v['width'], 'height': v['height']})
            check('Constant 30fps timing', Fraction(v['avg_frame_rate']) == fps and Fraction(v['r_frame_rate']) == fps)
            check('Encoded frame count matches timeline', int(v.get('nb_frames', -1)) == expected_frames,
                  {'encoded_frames': v.get('nb_frames'), 'expected_frames': expected_frames})
            check('AAC stereo 48kHz audio', a['codec_name'] == 'aac' and a['channels'] == 2 and int(a['sample_rate']) == rate)
            check('Video duration matches music frame boundary', abs(float(v['duration']) - expected_duration) < 1 / fps)
            check('Audio/video duration differs by less than one frame', abs(float(a['duration']) - float(v['duration'])) <= 1 / fps)
            check('Both streams begin at zero', abs(float(v.get('start_time', 0))) < .001 and abs(float(a.get('start_time', 0))) < .001)
            encoded = subprocess.run(['ffmpeg', '-v', 'error', '-i', str(video), '-map', '0:a:0',
                                      '-ar', str(rate), '-ac', '2', '-f', 'f32le', '-'],
                                     capture_output=True, check=True)
            check('Complete AAC decode without errors', not encoded.stderr.strip(), encoded.stderr.decode(errors='replace')[:1000])
            decoded = np.frombuffer(encoded.stdout, dtype='<f4').reshape(-1, 2)
            check('Decoded AAC audio is finite and non-silent', np.isfinite(decoded).all() and float(np.sqrt(np.mean(decoded ** 2))) > .005)
            aac_onset = first_audible(decoded, rate)
            check('AAC audible onset is synchronized within 40ms', aac_onset is not None and abs(aac_onset - pcm_onset) < .04,
                  {'pcm_onset_seconds': pcm_onset, 'aac_onset_seconds': aac_onset})
            correlations = [estimate_lag(audio, decoded, rate, start, end) for start, end in ((5, 15), (70, 80))]
            check('Beginning and ending audio remain sample synchronized', all(abs(c['lag_samples']) <= 48 for c in correlations), correlations)
            check('Encoded music matches master content', all(c['normalized_correlation'] > .95 for c in correlations))
            decoded_frames = subprocess.run([
                'ffmpeg', '-v', 'error', '-i', str(video), '-map', '0:v:0',
                '-vf', 'scale=96:54', '-pix_fmt', 'gray', '-fps_mode', 'passthrough',
                '-f', 'rawvideo', '-'], capture_output=True, check=True)
            check('Complete H.264 decode without errors', not decoded_frames.stderr.strip(), decoded_frames.stderr.decode(errors='replace')[:1000])
            small_frames = np.frombuffer(decoded_frames.stdout, dtype=np.uint8).reshape(-1, 54, 96)
            check('Every encoded frame decodes', len(small_frames) == expected_frames, len(small_frames))
            reduced = small_frames.astype(np.float32) / 255
            difference = np.mean(np.abs(np.diff(reduced, axis=0)), axis=(1, 2))
            extreme = np.flatnonzero(difference > .25)
            check('No extreme whole-frame luminance jumps', not len(extreme),
                  {'maximum_mean_frame_difference': float(np.max(difference)),
                   'candidate_times': [round((int(i) + 1) / fps, 4) for i in extreme[:30]]})
            check('Opening begins in near-black', float(np.mean(reduced[0])) < .02,
                  {'first_frame_mean_luminance': float(np.mean(reduced[0]))})
            check('Final frame resolves to near-black', float(np.mean(reduced[-1])) < .02,
                  {'last_frame_mean_luminance': float(np.mean(reduced[-1]))})
            report['video'] = {'path': str(video.relative_to(root)) if video.is_relative_to(root) else str(video),
                               'metadata': metadata, 'audio_correlations': correlations,
                               'decoded_frames': len(small_frames), 'first_aac_seconds': aac_onset,
                               'frame_difference_max': float(np.max(difference)),
                               'frame_difference_p99': float(np.quantile(difference, .99))}

        snapshots = []
        for path in sorted((root / 'previews').glob('*.png')):
            if any(word in path.stem.lower() for word in ('contact', 'sheet', 'quality')):
                continue
            with Image.open(path) as im:
                rgb = np.asarray(im.convert('RGB'), dtype=np.float32) / 255
                snapshots.append({'name': path.name, 'width': im.width, 'height': im.height,
                                  'mean_rgb': [float(n) for n in rgb.mean(axis=(0, 1))],
                                  'maximum_rgb': float(rgb.max()),
                                  'sha256': hashlib.sha256(path.read_bytes()).hexdigest()})
        report['keyframe_statistics'] = snapshots
        report['keyframe_review_scope'] = 'Numeric file statistics only; see visual review document for composition and geometry assessment.'
        try:
            from fontTools.ttLib import TTFont
            fonts = list((root / 'source' / 'fonts').glob('*.woff2')) + list((root / 'source' / 'fonts').glob('*.ttf')) + list((root / 'source' / 'fonts').glob('*.otf'))
            coverage = set()
            for path in fonts:
                with TTFont(path) as font:
                    coverage.update(font.getBestCmap() or {})
            if coverage:
                title = '一首曲子，是怎样诞生的？'
                missing = sorted(set(title) - set(chr(c) for c in coverage))
                check('Bundled fonts cover required opening Chinese glyphs', not missing, {'missing': missing})
        except ImportError:
            report['limitations'].append('FontTools unavailable; font glyph coverage was not checked programmatically.')
    except Exception as error:
        report['exception'] = f'{type(error).__name__}: {error}'
        check('Verification completed without exceptions', False, report['exception'])
    passed = sum(c['passed'] for c in report['checks'])
    report.update(status='passed' if passed == len(report['checks']) else 'failed',
                  passed=passed, total_checks=len(report['checks']))
    output = args.report if args.report.is_absolute() else root / args.report
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print(f"{report['status'].upper()}: {passed}/{len(report['checks'])} checks; report {output}")
    for item in report['checks']:
        if not item['passed']:
            print('FAIL:', item['name'], item.get('detail', ''))
    return 0 if report['status'] == 'passed' else 1


if __name__ == '__main__':
    sys.exit(main())
