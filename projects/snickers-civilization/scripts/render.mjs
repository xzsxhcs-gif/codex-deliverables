import { createCanvas, GlobalFonts, Path2D } from '@napi-rs/canvas';
import { build } from 'esbuild';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const DESIGN = { width: 1080, height: 1920, fps: 30, duration: 50 };
globalThis.Path2D ??= Path2D;

export function parseArgs(argv = process.argv.slice(2)) {
  const args = {};
  for (let i = 0; i < argv.length; i++) {
    const name = argv[i];
    if (!name.startsWith('--')) throw new Error(`Unexpected argument: ${name}`);
    const key = name.slice(2);
    if (['silent', 'help'].includes(key)) args[key] = true;
    else {
      if (!argv[i + 1] || argv[i + 1].startsWith('--')) throw new Error(`Missing value for ${name}`);
      args[key] = argv[++i];
    }
  }
  return args;
}

async function sourceHashes() {
  const hashes = {};
  async function walk(directory) {
    for (const entry of await fs.readdir(directory, { withFileTypes: true })) {
      const filename = path.join(directory, entry.name);
      if (entry.isDirectory()) await walk(filename);
      else hashes[path.relative(ROOT, filename)] = createHash('sha256').update(await fs.readFile(filename)).digest('hex');
    }
  }
  await walk(path.join(ROOT, 'src'));
  await walk(path.join(ROOT, 'public/fonts'));
  return hashes;
}

export async function createRenderer(width = DESIGN.width, height = DESIGN.height) {
  if (![width, height].every(v => Number.isInteger(v) && v > 0 && v <= 7680)) throw new Error('Invalid canvas dimensions.');
  await fs.mkdir(path.join(ROOT, '.cache'), { recursive: true });
  const bundle = path.join(ROOT, '.cache/film.mjs');
  await build({ entryPoints: [path.join(ROOT, 'src/film.ts')], outfile: bundle, bundle: true, platform: 'node', format: 'esm', target: 'node22', logLevel: 'warning' });
  for (const weight of ['Regular', 'Bold']) {
    const local = path.join(ROOT, `public/fonts/FilmSans-${weight}.ttf`);
    const fallback = `/usr/share/fonts/opentype/noto/NotoSansCJK-${weight}.ttc`;
    let font = local;
    try { await fs.access(font); } catch { font = fallback; }
    if (!GlobalFonts.registerFromPath(font, 'FilmSans')) throw new Error(`Unable to register font ${font}`);
  }
  const { renderFilm } = await import(`${pathToFileURL(bundle).href}?build=${Date.now()}`);
  if (typeof renderFilm !== 'function') throw new Error('src/film.ts must export renderFilm(ctx, t).');
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');
  const render = t => {
    if (!Number.isFinite(t) || t < 0 || t > DESIGN.duration) throw new Error(`Invalid timestamp: ${t}`);
    ctx.reset();
    ctx.fillStyle = '#000'; ctx.fillRect(0, 0, width, height);
    ctx.save(); ctx.scale(width / DESIGN.width, height / DESIGN.height);
    renderFilm(ctx, t);
    ctx.restore();
    return canvas;
  };
  return { canvas, ctx, render, width, height };
}

export async function renderMain(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    console.log('npm run render -- [--width 1080 --height 1920 --fps 30 --duration 50 --crf 20 --preset fast --output output/snickers-civilization.mp4]\nExact still: npm run render -- --frame 23.2 --output output/frame-23.2.png\nUse --silent only for visual work in progress.');
    return;
  }
  const width = Number(args.width ?? DESIGN.width), height = Number(args.height ?? DESIGN.height);
  const fps = Number(args.fps ?? DESIGN.fps), duration = Number(args.duration ?? DESIGN.duration);
  if (!(Number.isInteger(fps) && fps > 0 && fps <= 120 && duration > 0 && duration <= DESIGN.duration)) throw new Error('Invalid frame rate or duration.');
  if (Math.abs(Math.round(fps * duration) - fps * duration) > 1e-6) throw new Error('Duration must contain a whole number of frames.');
  const output = path.resolve(ROOT, args.output ?? (args.frame !== undefined ? `output/frame-${args.frame}.png` : 'output/snickers-civilization.mp4'));
  await fs.mkdir(path.dirname(output), { recursive: true });
  const renderer = await createRenderer(width, height);
  if (args.frame !== undefined) {
    const t = Number(args.frame);
    renderer.render(t);
    await fs.writeFile(output, await renderer.canvas.encode('png'));
    console.log(JSON.stringify({ file: output, t, width, height, bytes: (await fs.stat(output)).size }));
    return;
  }
  if (width % 2 || height % 2) throw new Error('H.264 yuv420p export requires even dimensions.');
  const count = Math.round(duration * fps);
  const audio = path.join(ROOT, 'public/audio/soundtrack.wav');
  if (!args.silent) await fs.access(audio).catch(() => { throw new Error('Missing soundtrack. Run npm run audio, or use --silent for a work-in-progress video.'); });
  const temporary = output.replace(/\.mp4$/i, '') + '.rendering.mp4';
  const progressFile = output.replace(/\.mp4$/i, '') + '-render.json';
  const options = ['-hide_banner', '-loglevel', 'warning', '-y', '-f', 'rawvideo', '-pix_fmt', 'rgba', '-video_size', `${width}x${height}`, '-framerate', String(fps), '-i', 'pipe:0'];
  if (!args.silent) options.push('-i', audio);
  options.push('-map', '0:v:0');
  if (!args.silent) options.push('-map', '1:a:0');
  options.push('-c:v', 'libx264', '-preset', args.preset ?? 'fast', '-crf', String(args.crf ?? 20), '-profile:v', 'high', '-pix_fmt', 'yuv420p', '-threads', '2', '-r', String(fps), '-g', String(fps * 2), '-keyint_min', String(fps), '-sc_threshold', '40');
  if (width * height <= 1080 * 1920 && fps <= 30) options.push('-level:v', '4.0');
  if (duration >= 49.5) options.push('-force_key_frames', '49.5');
  options.push('-vf', 'scale=in_range=pc:out_range=tv:out_color_matrix=bt709', '-color_range', 'tv', '-color_primaries', 'bt709', '-color_trc', 'bt709', '-colorspace', 'bt709');
  if (!args.silent) options.push('-c:a', 'aac', '-b:a', '192k', '-ar', '48000', '-ac', '2', '-af', `apad,atrim=duration=${duration},asetpts=PTS-STARTPTS`);
  options.push('-frames:v', String(count), '-t', String(duration), '-movflags', '+faststart', '-metadata', 'title=SNICKERS：文明的底层代码', '-metadata', 'comment=Original procedural vector animation. No product images or video footage.', temporary);
  const ffmpeg = spawn(process.env.FFMPEG ?? 'ffmpeg', options, { cwd: ROOT, stdio: ['pipe', 'ignore', 'pipe'] });
  let stderr = '', processError = null;
  ffmpeg.stderr.on('data', data => { stderr = (stderr + data.toString()).slice(-12000); });
  ffmpeg.on('error', error => { processError = error; });
  ffmpeg.stdin.on('error', error => { processError = error; });
  const exited = new Promise(resolve => ffmpeg.once('close', (code, signal) => resolve({ code, signal })));
  const started = Date.now();
  const manifest = { status: 'rendering', output, width, height, fps, duration, frames: count, completedFrames: 0, silent: !!args.silent, sourceHashes: await sourceHashes(), command: ['ffmpeg', ...options] };
  await fs.writeFile(progressFile, JSON.stringify(manifest, null, 2));
  try {
    for (let frame = 0; frame < count; frame++) {
      if (processError) throw processError;
      renderer.render(frame / fps);
      const data = renderer.canvas.data();
      if (!ffmpeg.stdin.write(data)) await once(ffmpeg.stdin, 'drain');
      if (frame % fps === 0 || frame === count - 1) {
        manifest.completedFrames = frame + 1;
        manifest.elapsedSeconds = (Date.now() - started) / 1000;
        await fs.writeFile(progressFile, JSON.stringify(manifest, null, 2));
        console.log(`${frame + 1}/${count} frames · ${((frame + 1) / fps).toFixed(2)}s · ${manifest.elapsedSeconds.toFixed(1)}s elapsed`);
      }
    }
    ffmpeg.stdin.end();
    const result = await exited;
    if (result.code !== 0 || processError) throw new Error(`FFmpeg failed (${result.code}, ${result.signal}): ${stderr}\n${processError ?? ''}`);
    await fs.rename(temporary, output);
    manifest.status = 'complete';
    manifest.bytes = (await fs.stat(output)).size;
    manifest.sha256 = createHash('sha256').update(await fs.readFile(output)).digest('hex');
    manifest.elapsedSeconds = (Date.now() - started) / 1000;
    if (!args.silent) manifest.audioSha256 = createHash('sha256').update(await fs.readFile(audio)).digest('hex');
    await fs.writeFile(progressFile, JSON.stringify(manifest, null, 2));
    console.log(JSON.stringify({ output, bytes: manifest.bytes, sha256: manifest.sha256, elapsedSeconds: manifest.elapsedSeconds }));
  } catch (error) {
    ffmpeg.kill('SIGTERM');
    manifest.status = 'failed'; manifest.error = String(error);
    await fs.writeFile(progressFile, JSON.stringify(manifest, null, 2));
    throw error;
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  renderMain().catch(error => { console.error(error); process.exitCode = 1; });
}
