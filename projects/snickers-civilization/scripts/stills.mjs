import { createCanvas, loadImage } from '@napi-rs/canvas';
import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { createRenderer, parseArgs, ROOT } from './render.mjs';

const args = parseArgs();
const width = Number(args.width ?? 720), height = Math.round(width * 16 / 9);
const output = path.resolve(ROOT, args.output ?? 'output/review');
await fs.mkdir(output, { recursive: true });
const times = args.times ? args.times.split(',').map(Number) : [0.8, 2.2, 4.8, 6.0, 7.2, 9.0, 11.6, 14.4, 16.4, 17.4, 18.8, 20.8, 22.8, 24.8, 26.8, 28.8, 30.8, 32.0, 33.2, 34.8, 36.4, 38.0, 39.6, 41.2, 42.8, 44.0, 45.0, 46.4, 48.0, 49.2, 49.8];
const renderer = await createRenderer(width, height);
const columns = 5, thumbWidth = 216, thumbHeight = 384, labelHeight = 35, gap = 12;
const sheet = createCanvas(columns * (thumbWidth + gap) + gap, Math.ceil(times.length / columns) * (thumbHeight + labelHeight + gap) + gap);
const ctx = sheet.getContext('2d');
ctx.fillStyle = '#151824'; ctx.fillRect(0, 0, sheet.width, sheet.height);
const manifest = [];
for (const [i, t] of times.entries()) {
  renderer.render(t);
  const png = await renderer.canvas.encode('png');
  const filename = `frame-${t.toFixed(3).replace('.', '-')}.png`;
  await fs.writeFile(path.join(output, filename), png);
  const x = gap + (i % columns) * (thumbWidth + gap), y = gap + Math.floor(i / columns) * (thumbHeight + labelHeight + gap);
  ctx.drawImage(await loadImage(png), x, y, thumbWidth, thumbHeight);
  ctx.fillStyle = '#fff7e8'; ctx.font = '16px FilmSans'; ctx.textBaseline = 'middle';
  ctx.fillText(`${t.toFixed(2)}s · #${Math.round(t * 30)}`, x + 5, y + thumbHeight + labelHeight / 2);
  manifest.push({ t, frame: Math.round(t * 30), file: filename, width, height, bytes: png.length, sha256: createHash('sha256').update(png).digest('hex') });
}
await fs.writeFile(path.join(output, 'contact-sheet.png'), await sheet.encode('png'));
await fs.writeFile(path.join(output, 'stills.json'), JSON.stringify(manifest, null, 2));
console.log(JSON.stringify({ directory: output, frames: times.length, contactSheet: path.join(output, 'contact-sheet.png') }));
