"""Deterministic browser frames -> resumable H.264 chunks -> audio-muxed film.

No recording clock is used: frame n always evaluates renderAt(n / fps).
Completed chunks are retained under a source/content fingerprint; changed source
gets a separate cache directory rather than deleting a previous render.
"""
from __future__ import annotations

import argparse
from contextlib import suppress
from functools import partial
import hashlib
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
import json
import math
import os
from pathlib import Path
import shutil
import subprocess
import sys
import threading
import time
from urllib.parse import urlparse

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / 'source'


def save_json(path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_name(path.name + '.tmp')
    temporary.write_text(json.dumps(value, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    temporary.replace(path)


def sha256(path):
    digest = hashlib.sha256()
    with path.open('rb') as reader:
        for block in iter(lambda: reader.read(1024 * 1024), b''):
            digest.update(block)
    return digest.hexdigest()


def source_fingerprint(settings):
    digest = hashlib.sha256(json.dumps(settings, sort_keys=True).encode())
    extensions = {'.js', '.mjs', '.html', '.css', '.json', '.py', '.glsl', '.vert',
                  '.frag', '.woff', '.woff2', '.ttf', '.otf', '.png', '.jpg', '.svg', '.webp'}
    excluded = {'node_modules', '.venv', '__pycache__', '.git', 'work', 'stems', '.render-cache'}
    paths = [ROOT / 'notes.json', ROOT / 'final_music.wav']
    paths += [p for p in SOURCE.rglob('*') if p.is_file() and p.suffix.lower() in extensions
              and not any(part in excluded for part in p.relative_to(SOURCE).parts)]
    if (ROOT / 'index.html').exists():
        paths.append(ROOT / 'index.html')
    for path in sorted(set(paths)):
        if path.exists():
            digest.update(str(path.relative_to(ROOT)).replace('\\', '/').encode())
            digest.update(bytes.fromhex(sha256(path)))
    return digest.hexdigest()


class QuietHandler(SimpleHTTPRequestHandler):
    def log_message(self, *_):
        pass


class BrowserFrames:
    def __init__(self, args):
        self.args = args
        self.server = self.browser = self.context = self.playwright = None
        self.errors, self.failed_requests = [], []

    def __enter__(self):
        try:
            from playwright.sync_api import sync_playwright
            handler = partial(QuietHandler, directory=str(ROOT))
            self.server = ThreadingHTTPServer(('127.0.0.1', 0), handler)
            self.server.daemon_threads = True
            self.thread = threading.Thread(target=self.server.serve_forever, kwargs={'poll_interval': .1}, daemon=True)
            self.thread.start()
            self.playwright = sync_playwright().start()
            chromium = shutil.which('chromium') or shutil.which('chromium-browser')
            launch = ['--disable-dev-shm-usage', '--autoplay-policy=no-user-gesture-required']
            if sys.platform.startswith('linux'):
                launch.append('--no-sandbox')
            self.software = self.args.softwaregl or (sys.platform.startswith('linux') and not self.args.hardwaregl)
            if self.software:
                launch += ['--use-angle=swiftshader', '--enable-unsafe-swiftshader']
            options = dict(headless=True, args=launch)
            if self.args.browser:
                options['executable_path'] = self.args.browser
            elif chromium:
                options['executable_path'] = chromium
            self.browser = self.playwright.chromium.launch(**options)
            self.context = self.browser.new_context(viewport={'width': self.args.width, 'height': self.args.height},
                                                    device_scale_factor=1, locale='zh-CN', timezone_id='Asia/Shanghai')
            self.page = self.context.new_page()
            self.page.set_default_timeout(90000)
            self.page.on('pageerror', lambda error: self.errors.append(str(error)))
            def console_message(message):
                if message.type != 'error':
                    return
                location = message.location or {}
                url = location.get('url', '')
                if urlparse(url).path == '/favicon.ico' and '404' in message.text:
                    return
                self.errors.append(f'console.error: {message.text} ({url})')
            self.page.on('console', console_message)
            self.page.on('requestfailed', lambda request: self.failed_requests.append({'url': request.url, 'error': request.failure}))

            def local_only(route):
                url = urlparse(route.request.url)
                if url.scheme in {'data', 'blob'} or url.hostname in {'127.0.0.1', 'localhost'}:
                    route.continue_()
                else:
                    self.failed_requests.append({'url': route.request.url, 'error': 'External request blocked for offline rendering'})
                    route.abort()
            self.page.route('**/*', local_only)
            entry = 'index.html' if (ROOT / 'index.html').exists() else 'source/index.html'
            if not (ROOT / entry).exists():
                raise FileNotFoundError('Expected source/index.html (or project-root index.html).')
            self.page.goto(f'http://127.0.0.1:{self.server.server_port}/{entry}?render=1', wait_until='domcontentloaded')
            self.page.wait_for_function("window.readyPromise && typeof window.renderAt === 'function'")
            self.page.evaluate("""async () => {
                await Promise.race([
                    Promise.all([window.readyPromise, document.fonts.ready]),
                    new Promise((_, reject) => setTimeout(() => reject(new Error('Scene/font initialization timed out')), 90000))
                ]);
                return true;
            }""")
            self.draw(0)
            self.info = self.page.evaluate("""() => {
                const canvas = document.querySelector('canvas');
                const gl = canvas && (canvas.getContext('webgl2') || canvas.getContext('webgl'));
                const debug = gl && gl.getExtension('WEBGL_debug_renderer_info');
                return {gpu: debug ? gl.getParameter(debug.UNMASKED_RENDERER_WEBGL) : 'unavailable',
                    fonts: document.fonts.status, canvas: canvas ? [canvas.width, canvas.height] : null};
            }""")
            self.info.update(browser=self.browser.version, software_gl=self.software)
            print('Renderer:', json.dumps(self.info, ensure_ascii=False), flush=True)
            return self
        except BaseException:
            self.close()
            raise

    def draw(self, film_time):
        result = self.page.evaluate('(t) => window.renderAt(t)', float(film_time))
        if self.errors:
            raise RuntimeError('Browser scene error: ' + '; '.join(self.errors))
        return result

    def jpeg(self):
        return self.page.screenshot(type='jpeg', quality=95, timeout=90000)

    def close(self):
        for object_ in [self.context, self.browser, self.playwright]:
            if object_:
                with suppress(Exception):
                    object_.stop() if object_ is self.playwright else object_.close()
        if self.server:
            self.server.shutdown()
            self.server.server_close()
            self.thread.join(timeout=2)

    def __exit__(self, *_):
        self.close()


def media_info(path):
    command = ['ffprobe', '-v', 'error', '-select_streams', 'v:0', '-show_entries',
               'stream=width,height,nb_frames,r_frame_rate', '-of', 'json', str(path)]
    result = json.loads(subprocess.check_output(command, text=True))
    if not result.get('streams'):
        raise RuntimeError(f'No video stream in {path}')
    return result['streams'][0]


def chunk_valid(path, meta, count, args):
    if not path.exists() or not meta.exists():
        return False
    try:
        data = json.loads(meta.read_text(encoding='utf-8'))
        return (data['frames'] == count and data['bytes'] == path.stat().st_size
                and data['sha256'] == sha256(path) and data['width'] == args.width
                and data['height'] == args.height and data['fps'] == args.fps)
    except (ValueError, KeyError, OSError):
        return False


def encode_chunk(renderer, path, start, end, args, progress, total, started):
    temporary = path.with_name(path.stem + '.incomplete.mp4')
    log_path = path.with_suffix('.ffmpeg.log')
    command = ['ffmpeg', '-hide_banner', '-nostdin', '-loglevel', 'warning', '-y',
               '-f', 'image2pipe', '-framerate', str(args.fps), '-vcodec', 'mjpeg', '-i', 'pipe:0',
               '-an', '-vf', 'scale=in_range=full:out_range=tv:in_color_matrix=bt601:out_color_matrix=bt709,format=yuv420p',
               '-c:v', 'libx264', '-preset', args.preset, '-crf', str(args.crf),
               '-threads', str(args.encode_threads), '-r', str(args.fps), '-frames:v', str(end - start),
               '-color_primaries', 'bt709', '-color_trc', 'bt709', '-colorspace', 'bt709',
               '-video_track_timescale', '90000', '-movflags', '+faststart', str(temporary)]
    print(f'Chunk {start:06d}–{end:06d}: t={start / args.fps:.3f}–{end / args.fps:.3f}s', flush=True)
    last_report = 0.0
    with log_path.open('wb') as log:
        process = subprocess.Popen(command, stdin=subprocess.PIPE, stdout=subprocess.DEVNULL, stderr=log)
        try:
            for frame in range(start, end):
                diagnostics = renderer.draw(frame / args.fps)
                process.stdin.write(renderer.jpeg())
                now = time.monotonic()
                if (frame + 1) % 30 == 0 or frame + 1 == end or now - last_report >= 12:
                    value = dict(frame=frame, next_frame=frame + 1, frame_count=total,
                                 time_seconds=frame / args.fps, elapsed_seconds=round(now - started, 2),
                                 active_chunk=[start, end], diagnostics=diagnostics)
                    save_json(progress, value)
                    print(f'  frame {frame + 1}/{total}, t={frame / args.fps:.3f}s, elapsed={now - started:.1f}s', flush=True)
                    last_report = now
            process.stdin.close()
            if process.wait() != 0:
                raise RuntimeError(f'FFmpeg encoding failed; see {log_path}')
        except BaseException:
            with suppress(Exception):
                process.stdin.close()
            if process.poll() is None:
                process.terminate()
                try:
                    process.wait(timeout=10)
                except subprocess.TimeoutExpired:
                    process.kill()
                    process.wait()
            raise
    info = media_info(temporary)
    if (int(info.get('nb_frames', -1)) != end - start
            or info['width'] != args.width or info['height'] != args.height):
        raise RuntimeError(f'Encoded chunk has unexpected frame count or size: {info}')
    temporary.replace(path)
    save_json(path.with_suffix('.json'), dict(start_frame=start, end_frame=end, frames=end - start,
              width=args.width, height=args.height, fps=args.fps, bytes=path.stat().st_size,
              sha256=sha256(path), source_fingerprint=progress.parent.name))


def assemble(paths, cache, destination, frames, args):
    listing = cache / 'concat.txt'
    listing.write_text(''.join("file '" + p.resolve().as_posix().replace("'", "'\\''") + "'\n" for p in paths), encoding='utf-8')
    silent = cache / 'picture.mp4'
    subprocess.run(['ffmpeg', '-hide_banner', '-nostdin', '-loglevel', 'warning', '-y', '-f', 'concat',
                    '-safe', '0', '-i', str(listing), '-c', 'copy', str(silent)], check=True)
    destination.parent.mkdir(parents=True, exist_ok=True)
    temporary = destination.with_name(destination.stem + '.incomplete.mp4')
    subprocess.run(['ffmpeg', '-hide_banner', '-nostdin', '-loglevel', 'warning', '-y',
                    '-i', str(silent), '-i', str(ROOT / 'final_music.wav'), '-map', '0:v:0', '-map', '1:a:0',
                    '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k', '-ar', '48000', '-ac', '2',
                    '-af', 'apad', '-t', f'{frames / args.fps:.9f}', '-movflags', '+faststart', str(temporary)], check=True)
    info = media_info(temporary)
    if int(info.get('nb_frames', -1)) != frames:
        raise RuntimeError(f'Final MP4 frame count mismatch: {info}')
    temporary.replace(destination)
    print(f'COMPLETE: {destination} ({frames} frames, {frames / args.fps:.6f}s)', flush=True)


def parse_times(values):
    return [float(item) for word in values for item in word.replace(',', ' ').split()]


def arguments():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--width', type=int)
    parser.add_argument('--height', type=int)
    parser.add_argument('--fps', type=int, default=30)
    parser.add_argument('--frames', type=int, help='Override the whole timeline frame count (for short tests).')
    parser.add_argument('--chunk-frames', type=int, default=180)
    parser.add_argument('--start-frame', type=int, default=0, help='Partition start; must align to a chunk boundary.')
    parser.add_argument('--end-frame', type=int, help='Partition end; chunk-aligned, or the final frame count.')
    parser.add_argument('--preview', action='store_true', help='Render the complete timeline at 640×360 / CRF22.')
    parser.add_argument('--stills', action='store_true', help='Save PNGs at exact requested timestamps, without encoding video.')
    parser.add_argument('--times', nargs='+', default=['0', '1.4', '3.5', '5', '12', '24', '36', '48', '58', '66', '74', '82', '90', '93.5'])
    parser.add_argument('--benchmark', action='store_true', help='Measure deterministic scene/capture cost at --times.')
    parser.add_argument('--output', type=Path, help='Alternative MP4 path, relative to the project root.')
    parser.add_argument('--browser', help='Optional Chromium executable path.')
    gl = parser.add_mutually_exclusive_group()
    gl.add_argument('--softwaregl', action='store_true', help='Force SwiftShader (default on Linux cloud).')
    gl.add_argument('--hardwaregl', action='store_true', help='Use the browser GPU backend (default on Windows).')
    parser.add_argument('--crf', type=int)
    parser.add_argument('--preset', default='medium')
    parser.add_argument('--encode-threads', type=int, default=2)
    args = parser.parse_args()
    args.width = args.width or (640 if args.preview else 1920)
    args.height = args.height or (360 if args.preview else 1080)
    args.crf = args.crf if args.crf is not None else (22 if args.preview else 18)
    if min(args.width, args.height, args.fps, args.chunk_frames, args.encode_threads) <= 0 or args.width % 2 or args.height % 2:
        parser.error('Positive dimensions/fps/chunk sizes are required; H.264 dimensions must be even.')
    if not 0 <= args.crf <= 51:
        parser.error('CRF must be between 0 and 51.')
    if args.frames is not None and args.frames <= 0:
        parser.error('--frames must be positive.')
    return args


def main():
    args = arguments()
    for tool in ['ffmpeg', 'ffprobe']:
        if not shutil.which(tool):
            raise RuntimeError(f'{tool} is not on PATH. Install FFmpeg and reopen the terminal.')
    notes_path = ROOT / 'notes.json'
    if not notes_path.exists():
        raise FileNotFoundError('notes.json is missing. Run: python source/prepare_music.py')
    notes = json.loads(notes_path.read_text(encoding='utf-8'))
    video = notes.get('video', {})
    native_fps = notes.get('fps', video.get('fps', 30))
    native_count = notes.get('frame_count', notes.get('frameCount', video.get('frame_count', notes.get('meta', {}).get('frame_count'))))
    total = args.frames or (int(native_count) if native_count and args.fps == native_fps
                           else math.ceil(float(notes.get('total', 2812 / 30)) * args.fps - 1e-7))
    end = total if args.end_frame is None else args.end_frame
    if not 0 <= args.start_frame < end <= total:
        raise ValueError('Require 0 <= start-frame < end-frame <= timeline frame count.')
    if args.start_frame % args.chunk_frames or (end != total and end % args.chunk_frames):
        raise ValueError('Render partitions must align to chunk boundaries; use --frames for a short standalone test.')
    if not args.stills and not args.benchmark and not (ROOT / 'final_music.wav').exists():
        raise FileNotFoundError('final_music.wav is missing. Run: python source/prepare_music.py')
    started = time.monotonic()
    with BrowserFrames(args) as renderer:
        if args.stills or args.benchmark:
            rows = []
            for t in parse_times(args.times):
                if not 0 <= t < total / args.fps:
                    raise ValueError(f'Still timestamp {t} is outside the film.')
                stamp = time.monotonic()
                diagnostic = renderer.draw(t)
                draw_end = time.monotonic()
                if args.stills:
                    path = ROOT / 'previews' / f'frame-{t:07.3f}s.png'
                    path.parent.mkdir(parents=True, exist_ok=True)
                    data = renderer.page.screenshot(path=str(path), type='png', timeout=90000)
                    print('STILL:', path, flush=True)
                else:
                    data = renderer.jpeg()
                row = dict(time_seconds=t, draw_ms=(draw_end - stamp) * 1000,
                           capture_ms=(time.monotonic() - draw_end) * 1000, bytes=len(data), diagnostics=diagnostic)
                rows.append(row)
                print(f'  t={t:.3f}s draw={row["draw_ms"]:.1f}ms capture={row["capture_ms"]:.1f}ms', flush=True)
            save_json(ROOT / 'previews' / ('stills-manifest.json' if args.stills else 'benchmark.json'),
                      dict(renderer=renderer.info, frames=rows, failed_requests=renderer.failed_requests))
            return
        settings = dict(width=args.width, height=args.height, fps=args.fps, frames=total,
                        chunk_frames=args.chunk_frames, crf=args.crf, preset=args.preset,
                        browser=renderer.info['browser'], software_gl=renderer.software)
        fingerprint = source_fingerprint(settings)
        cache = ROOT / '.render-cache' / (('preview-' if args.preview else 'film-') + fingerprint[:20])
        cache.mkdir(parents=True, exist_ok=True)
        save_json(cache / 'settings.json', dict(**settings, source_fingerprint=fingerprint, renderer=renderer.info))
        paths = []
        for start in range(0, total, args.chunk_frames):
            stop = min(total, start + args.chunk_frames)
            path = cache / f'frames-{start:06d}-{stop:06d}.mp4'
            paths.append(path)
            if start < args.start_frame or stop > end:
                continue
            if chunk_valid(path, path.with_suffix('.json'), stop - start, args):
                print(f'RESUME: {start:06d}–{stop:06d} already verified.', flush=True)
                continue
            encode_chunk(renderer, path, start, stop, args, cache / 'progress.json', total, started)
        missing = [p for p in paths if not chunk_valid(p, p.with_suffix('.json'),
                   min(total, int(p.stem.split('-')[1]) + args.chunk_frames) - int(p.stem.split('-')[1]), args)]
        if missing:
            print(f'Partition complete; {len(missing)} chunks remain. Run without --start-frame/--end-frame to finish.', flush=True)
            return
        destination = args.output or (ROOT / 'previews/preview.mp4' if args.preview else ROOT / 'final_video.mp4')
        if not destination.is_absolute():
            destination = ROOT / destination
        assemble(paths, cache, destination, total, args)
        save_json(destination.with_suffix('.render.json'), dict(settings=settings, source_fingerprint=fingerprint,
                  output=str(destination.relative_to(ROOT)) if destination.is_relative_to(ROOT) else str(destination),
                  output_sha256=sha256(destination), frame_count=total, duration_seconds=total / args.fps,
                  elapsed_seconds=round(time.monotonic() - started, 2), renderer=renderer.info,
                  failed_requests=renderer.failed_requests, chunks=len(paths)))


if __name__ == '__main__':
    try:
        main()
    except KeyboardInterrupt:
        print('\nStopped. Completed chunks are retained; repeat the same command to resume.', file=sys.stderr)
        sys.exit(130)
    except Exception as error:
        print(f'RENDER ERROR: {error}', file=sys.stderr)
        sys.exit(1)
