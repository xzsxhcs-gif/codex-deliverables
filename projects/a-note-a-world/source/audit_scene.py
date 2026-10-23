"""Independent camera, shared-clock and deterministic-seek audit of the film.

Uses the actual browser scene API, never a wall-clock recording. The contact
strips are extracted from the already rendered preview, not synthesized fixtures.
"""
from __future__ import annotations

import hashlib
import io
import json
import math
from pathlib import Path
from types import SimpleNamespace
import subprocess
import sys

import numpy as np
from PIL import Image

from render_film import BrowserFrames

ROOT = Path(__file__).resolve().parents[1]


def main():
    data = json.loads((ROOT / 'notes.json').read_text())
    fps, count = data['fps'], data['frame_count']
    notes = data['notes']
    report = {'status': 'running', 'checks': [], 'limitations': [
        'Pixel determinism is checked on the attached Chromium/SwiftShader environment; other GPUs may differ slightly.',
        'Camera metrics and image comparisons do not replace visual composition review.',
        'Active-note API intervals are sampled; all onset quantization is checked independently from the complete event list.',
    ]}

    def check(name, passed, detail=None):
        result = {'name': name, 'passed': bool(passed)}
        if detail is not None:
            result['detail'] = detail
        report['checks'].append(result)

    args = SimpleNamespace(width=640, height=360, softwaregl=True, hardwaregl=False, browser=None)
    with BrowserFrames(args) as frames:
        page = frames.page
        cameras = page.evaluate('(n) => Array.from({length:n}, (_,i) => window.cameraAt(i/30))', count)
        position = np.array([c['position'] for c in cameras])
        target = np.array([c['target'] for c in cameras])
        fov = np.array([c['fov'] for c in cameras])
        direction = target - position
        distance = np.linalg.norm(direction, axis=1)
        forward = direction / distance[:, None]
        steps = np.linalg.norm(np.diff(position, axis=0), axis=1)
        turns = np.rad2deg(np.arccos(np.clip(np.sum(forward[1:] * forward[:-1], axis=1), -1, 1)))
        acceleration = np.linalg.norm(np.diff(position, n=2, axis=0), axis=1) * fps * fps
        check('All camera coordinates and lens values are finite', np.isfinite(position).all() and np.isfinite(target).all() and np.isfinite(fov).all())
        check('No camera-target collapse', distance.min() > 20, {'minimum_distance': float(distance.min())})
        check('No camera orientation flip in one frame', turns.max() < 1.0,
              {'maximum_degrees_per_frame': float(turns.max()), 'time': float((np.argmax(turns) + 1) / fps)})
        check('Camera travel has no teleport', steps.max() < .65,
              {'maximum_world_units_per_frame': float(steps.max()), 'time': float((np.argmax(steps) + 1) / fps)})
        check('Camera remains in front of composition plane', position[:, 2].min() > 5,
              {'minimum_camera_z': float(position[:, 2].min())})
        check('World up never approaches a look-at singularity', np.max(np.abs(forward[:, 1])) < .95)
        check('Lens remains within intended restrained range', fov.min() >= 42.9 and fov.max() <= 50.1)
        report['camera'] = {'samples': count, 'maximum_step': float(steps.max()),
                            'maximum_turn_degrees': float(turns.max()),
                            'maximum_acceleration_world_units_per_second_squared': float(acceleration.max()),
                            'minimum_z': float(position[:, 2].min())}
        # Check camera clearance against the real, music-derived terrain function.
        clearance = page.evaluate('''async (samples) => {
            const {createLandscape}=await import('./landscape.js');
            const data=await fetch('../notes.json').then(r=>r.json());
            const world=createLandscape(data);
            const result=samples.map(s=>({t:s.t,clearance:s.p[1]-world.getHeight(s.p[0],s.p[2])}));
            world.dispose();return result;
        }''', [{'t': i / fps, 'p': c['position']} for i, c in enumerate(cameras) if 48 <= i / fps <= 85])
        minimum = min(clearance, key=lambda row: row['clearance'])
        check('World camera clears full-height terrain', minimum['clearance'] > 1, minimum)

        # Every rendered onset follows the first sample at or after the audio onset.
        errors = [math.ceil((n['t0'] - 1e-10) * fps) / fps - n['t0'] for n in notes]
        check('All 643 note onsets quantize within one video frame', len(errors) == 643 and min(errors) >= -1e-8 and max(errors) < 1 / fps,
              {'events': len(errors), 'maximum_delay_ms': float(max(errors) * 1000)})
        samples = {0., 4., 4.0333333333, 14.67, 20., 28., 35.8, 36., 42., 49., 56., 64., 72., 78.7, 83., 87., 90.3}
        channels = sorted({n['ch'] for n in notes})
        for ch in channels:
            channel_notes = [n for n in notes if n['ch'] == ch]
            samples.add(min(n['t0'] for n in channel_notes) + 1e-5)
            samples.add(max(n['t1'] for n in channel_notes) + 1e-5)
        active_errors = []
        for t in sorted(samples):
            actual = frames.draw(t)['activeNotes']
            expected = [dict(ch=n['ch'], p=n['p'], t0=n['t0'], t1=n['t1']) for n in notes if n['t0'] <= t < n['t1']]
            if actual != expected:
                active_errors.append(t)
        check('Rendered active-note intervals use the shared film clock', not active_errors,
              {'sampled_times': len(samples), 'mismatch_times': active_errors})

        references = {}
        times = [4.05, 35.8, 42., 56., 66., 83., 87., 90.3]
        for t in times:
            frames.draw(t)
            references[t] = frames.page.screenshot(type='png')
        pixels = []
        for t in reversed(times):
            frames.draw(t)
            repeated = frames.page.screenshot(type='png')
            a = np.asarray(Image.open(io.BytesIO(references[t])).convert('RGB'), dtype=np.int16)
            b = np.asarray(Image.open(io.BytesIO(repeated)).convert('RGB'), dtype=np.int16)
            pixels.append({'t': t, 'identical_png': references[t] == repeated,
                           'maximum_pixel_difference': int(np.max(np.abs(a - b))),
                           'mean_pixel_difference': float(np.mean(np.abs(a - b))),
                           'sha256': hashlib.sha256(references[t]).hexdigest()})
        report['deterministic_frames'] = pixels
        check('Same timestamp produces the same decoded pixels after arbitrary seeks', all(p['maximum_pixel_difference'] == 0 for p in pixels), pixels)
        check('No JavaScript, shader or resource errors', not frames.errors and not frames.failed_requests,
              {'errors': frames.errors, 'failed_requests': frames.failed_requests})
        report['browser'] = frames.info

    preview = ROOT / 'previews' / 'preview.mp4'
    if preview.exists():
        for name, start, duration, rate, tile in [
            ('review-first-transform.png', 35.6, .8, 5, '4x1'),
            ('review-world-entry.png', 52.7, 1., 5, '5x1'),
            ('review-return.png', 78., 12., 1, '4x3'),
        ]:
            subprocess.run(['ffmpeg', '-v', 'error', '-y', '-ss', str(start), '-i', str(preview),
                            '-t', str(duration), '-vf', f'fps={rate},scale=480:270,tile={tile}',
                            '-frames:v', '1', str(ROOT / 'previews' / name)], check=True)
    passed = sum(row['passed'] for row in report['checks'])
    report.update(status='passed' if passed == len(report['checks']) else 'failed', passed=passed, total_checks=len(report['checks']))
    output = ROOT / 'previews' / 'scene-QA.json'
    output.write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n')
    print(f"{report['status'].upper()}: {passed}/{len(report['checks'])}; {output}")
    for row in report['checks']:
        if not row['passed']:
            print('FAIL', row['name'], row.get('detail'))
    return 0 if report['status'] == 'passed' else 1


if __name__ == '__main__':
    sys.exit(main())
