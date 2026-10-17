#!/usr/bin/env python3
"""Validate the delivered MP4 itself, plus deterministic scene and font inputs."""
import argparse
import hashlib
import json
import math
import struct
import subprocess
import sys
import wave
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
parser = argparse.ArgumentParser()
parser.add_argument('--input', default='output/snickers-civilization.mp4')
parser.add_argument('--report', default='output/verification.json')
parser.add_argument('--width', type=int, default=1080)
parser.add_argument('--height', type=int, default=1920)
parser.add_argument('--fps', type=int, default=30)
parser.add_argument('--duration', type=float, default=50)
args = parser.parse_args()
video = (ROOT / args.input).resolve()
report_path = (ROOT / args.report).resolve()
checks = []

def check(name, ok, details=None):
    item = {'name': name, 'passed': bool(ok)}
    if details is not None:
        item['details'] = details
    checks.append(item)
    print(f"{'PASS' if ok else 'FAIL'} {name}", flush=True)

def command(argv, **kwargs):
    return subprocess.run(argv, cwd=ROOT, check=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE, **kwargs).stdout

def inspect_stream_bytes(argv):
    child = subprocess.Popen(argv, cwd=ROOT, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    count = nonzero = peak = 0
    while data := child.stdout.read(1024 * 1024):
        count += len(data)
        nonzero += len(data) - data.count(0)
        peak = max(peak, max(data, default=0))
    stderr = child.stderr.read().decode(errors='replace')
    if child.wait() != 0:
        raise RuntimeError(stderr)
    return {'bytes': count, 'nonzeroBytes': nonzero, 'maximumByte': peak}

def top_level_boxes(filename):
    result = []
    with filename.open('rb') as source:
        size = filename.stat().st_size
        while source.tell() + 8 <= size:
            start = source.tell()
            length, kind = struct.unpack('>I4s', source.read(8))
            if length == 1:
                length = struct.unpack('>Q', source.read(8))[0]
            elif length == 0:
                length = size - start
            if length < 8 or start + length > size:
                raise ValueError(f'Invalid MP4 box at byte {start}')
            result.append({'type': kind.decode('ascii', errors='replace'), 'offset': start, 'size': length})
            source.seek(start + length)
    return result

facts = {'input': str(video)}
try:
    check('MP4 exists and is non-empty', video.is_file() and video.stat().st_size > 1024)
    probe = json.loads(command(['ffprobe', '-v', 'error', '-count_frames', '-show_streams', '-show_format', '-of', 'json', str(video)], timeout=300))
    visual = next(s for s in probe['streams'] if s['codec_type'] == 'video')
    audio = next((s for s in probe['streams'] if s['codec_type'] == 'audio'), {})
    facts['probe'] = probe
    facts['sha256'] = hashlib.sha256(video.read_bytes()).hexdigest()
    facts['bytes'] = video.stat().st_size
    check('H.264 AVC video', visual.get('codec_name') == 'h264' and visual.get('codec_tag_string') == 'avc1')
    check('Portable 4:2:0 pixel format', visual.get('pix_fmt') == 'yuv420p')
    check('Portrait output resolution', visual['width'] == args.width and visual['height'] == args.height, {'width': visual['width'], 'height': visual['height']})
    numerator, denominator = map(int, visual['avg_frame_rate'].split('/'))
    check('Constant expected frame rate', numerator / denominator == args.fps and visual['r_frame_rate'] == visual['avg_frame_rate'], visual['avg_frame_rate'])
    check('Complete frame count', int(visual.get('nb_read_frames', 0)) == round(args.duration * args.fps), visual.get('nb_read_frames'))
    check('Exact complete duration', abs(float(probe['format']['duration']) - args.duration) < .001, probe['format']['duration'])
    check('AAC stereo 48 kHz audio', audio.get('codec_name') == 'aac' and audio.get('codec_tag_string') == 'mp4a' and audio.get('channels') == 2 and audio.get('sample_rate') == '48000')
    boxes = top_level_boxes(video)
    facts['mp4Boxes'] = boxes
    kinds = [box['type'] for box in boxes]
    check('Fast-start MP4 metadata before media', 'moov' in kinds and 'mdat' in kinds and kinds.index('moov') < kinds.index('mdat'))
    decoded = subprocess.run(['ffmpeg', '-v', 'error', '-err_detect', 'explode', '-i', str(video), '-map', '0:v:0', '-map', '0:a:0', '-f', 'null', '-'], cwd=ROOT, stdout=subprocess.DEVNULL, stderr=subprocess.PIPE, timeout=300)
    check('Complete video and audio decode without errors', decoded.returncode == 0 and not decoded.stderr.strip(), decoded.stderr.decode(errors='replace')[-1500:])
    tail_start = args.duration - .5
    tail = inspect_stream_bytes(['ffmpeg', '-v', 'error', '-ss', str(tail_start), '-i', str(video), '-map', '0:v:0', '-an', '-pix_fmt', 'rgb24', '-f', 'rawvideo', '-'])
    check('Every pixel of final 15 frames is black', tail['nonzeroBytes'] == 0 and tail['bytes'] == round(.5 * args.fps) * args.width * args.height * 3, tail)
    pcm = command(['ffmpeg', '-v', 'error', '-ss', str(tail_start), '-i', str(video), '-vn', '-ar', '48000', '-ac', '2', '-f', 's16le', '-acodec', 'pcm_s16le', '-'], timeout=30)
    check('Final half-second AAC audio is absolute silence', len(pcm) >= 48000 * 2 * 2 * .49 and not any(pcm), {'bytes': len(pcm), 'nonzeroBytes': len(pcm) - pcm.count(0)})
    thumbnails = []
    for t in [4.8, 8.8, 17.2, 21.2, 25.2, 29.2, 37.2, 45.6]:
        rgb = command(['ffmpeg', '-v', 'error', '-ss', str(t), '-i', str(video), '-frames:v', '1', '-vf', 'scale=108:192', '-pix_fmt', 'rgb24', '-f', 'rawvideo', '-'], timeout=30)
        mean = sum(rgb) / max(1, len(rgb))
        variance = sum((n - mean) ** 2 for n in rgb) / max(1, len(rgb))
        thumbnails.append({'t': t, 'mean': round(mean, 3), 'standardDeviation': round(math.sqrt(variance), 3), 'sha256': hashlib.sha256(rgb).hexdigest()})
    check('All eight major sequence samples contain visible imagery', all(f['standardDeviation'] > 5 for f in thumbnails), thumbnails)
    check('Major sequences are visually distinct', len({f['sha256'] for f in thumbnails}) == len(thumbnails))

    native_script = r'''
      import { createRenderer } from './scripts/render.mjs';
      import { createHash } from 'node:crypto';
      const renderer = await createRenderer(270, 480);
      const times = [1.2, 6.8, 14.4, 17.2, 21.2, 29.6, 37.2, 45.2, 49.9];
      const frameHash = t => {renderer.render(t); return createHash('sha256').update(renderer.canvas.data()).digest('hex');};
      const first = Object.fromEntries(times.map(t => [t, frameHash(t)]));
      const order = [...times].reverse().concat([21.2, 1.2, 45.2, 14.4, 49.9, 37.2, 6.8, 29.6, 17.2]);
      const repeats = order.map(t => ({t, expected: first[t], actual: frameHash(t)}));
      console.log(JSON.stringify({first, repeats, passed: repeats.every(r => r.actual === r.expected)}));
    '''
    deterministic = json.loads(command(['node', '--input-type=module', '-e', native_script], timeout=180))
    check('Exact same pixels for timestamp after out-of-order seeks', deterministic['passed'], deterministic)

    wav = ROOT / 'public/audio/soundtrack.wav'
    with wave.open(str(wav), 'rb') as source:
        wav_info = {'channels': source.getnchannels(), 'sampleRate': source.getframerate(), 'sampleWidth': source.getsampwidth(), 'frames': source.getnframes()}
        source.setpos(int((args.duration - .5) * source.getframerate()))
        wav_tail = source.readframes(int(.5 * source.getframerate()))
    check('Full-duration stereo 48 kHz source WAV', wav_info['channels'] == 2 and wav_info['sampleRate'] == 48000 and wav_info['frames'] == round(args.duration * 48000), wav_info)
    check('Source WAV final half-second is silent', not any(wav_tail))

    from fontTools.ttLib import TTFont
    source_chars = set()
    for filename in (ROOT / 'src').rglob('*'):
        if filename.suffix in ['.ts', '.tsx', '.css', '.html']:
            source_chars |= {ord(char) for char in filename.read_text() if '\u3400' <= char <= '\u9fff' or char in '，。；：？！—·×÷±∑∫∞→←↑↓⊕πθλΔΩμ√≈≤≥²³∂∇'}
    source_chars |= {ord(char) for char in (ROOT / 'index.html').read_text() if '\u3400' <= char <= '\u9fff' or char in '，。；：？！—·×÷±∑∫∞→←↑↓⊕πθλΔΩμ√≈≤≥²³∂∇'}
    font_details = []
    for weight in ['Regular', 'Bold']:
        fontfile = ROOT / f'public/fonts/FilmSans-{weight}.ttf'
        cmap = TTFont(str(fontfile)).getBestCmap()
        font_details.append({'weight': weight, 'missingCharacters': ''.join(chr(code) for code in sorted(source_chars - set(cmap)))})
    check('Bundled fonts cover all Chinese and on-screen mathematical glyphs', all(not item['missingCharacters'] for item in font_details), font_details)

    render_report = video.with_name(video.stem + '-render.json')
    if render_report.exists():
        manifest = json.loads(render_report.read_text())
        changed = [filename for filename, digest in manifest['sourceHashes'].items() if not (ROOT / filename).is_file() or hashlib.sha256((ROOT / filename).read_bytes()).hexdigest() != digest]
        check('Export used the current source and font inputs', not changed, changed)
        check('Completed render manifest matches final MP4', manifest.get('status') == 'complete' and manifest.get('sha256') == facts['sha256'])
        check('Exported audio matches current source WAV', manifest.get('audioSha256') == hashlib.sha256(wav.read_bytes()).hexdigest())
    else:
        check('Render provenance manifest exists', False, str(render_report))
except Exception as error:
    check('Verification completed without internal errors', False, f'{type(error).__name__}: {error}')

report = {'passed': all(item['passed'] for item in checks), 'passedChecks': sum(item['passed'] for item in checks), 'totalChecks': len(checks), 'checks': checks, 'facts': facts}
report_path.parent.mkdir(parents=True, exist_ok=True)
report_path.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding='utf-8')
print(json.dumps({'passed': report['passed'], 'checks': f"{report['passedChecks']}/{report['totalChecks']}", 'report': str(report_path)}))
sys.exit(0 if report['passed'] else 1)
