import { chromium } from 'playwright';
import fs from 'node:fs/promises';
import path from 'node:path';
import { parseArgs, ROOT } from './render.mjs';

const args = parseArgs();
const base = args.url ?? 'http://127.0.0.1:5173';
const output = path.resolve(ROOT, args.output ?? 'output/browser-review');
const videoUrl = new URL(args.video ?? '/output/snickers-civilization.mp4', base).href;
await fs.mkdir(output, { recursive: true });
const checks = [];
const errors = [];
const check = (name, passed, details) => {
  checks.push({ name, passed: !!passed, ...(details !== undefined ? { details } : {}) });
  console.log(`${passed ? 'PASS' : 'FAIL'} ${name}`);
};
const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROMIUM ?? '/usr/bin/chromium', args: ['--no-sandbox', '--disable-dev-shm-usage'] });
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 1080 }, deviceScaleFactor: 1 });
  page.on('pageerror', error => errors.push(String(error)));
  page.on('console', message => { if (message.type() === 'error' && !message.text().includes('favicon') && !message.location().url.includes('/favicon')) errors.push(message.text()); });
  await page.addInitScript(() => {
    const OriginalAudio = window.Audio;
    window.__qaAudioElements = [];
    window.Audio = class extends OriginalAudio {
      constructor(...values) { super(...values); window.__qaAudioElements.push(this); }
    };
  });
  await page.goto(new URL('?t=23.2', base).href, { waitUntil: 'networkidle', timeout: 60000 });
  await page.waitForFunction(() => window.film?.ready, { timeout: 30000 });
  const initial = await page.evaluate(() => {
    const canvas = document.querySelector('#film');
    return { width: canvas.width, height: canvas.height, clock: document.querySelector('#clock').value, language: document.documentElement.lang, duration: window.film.duration, fonts: document.fonts.status, regular: document.fonts.check('400 24px FilmSans'), bold: document.fonts.check('800 48px FilmSans') };
  });
  check('Browser canvas is full-resolution portrait', initial.width === 1080 && initial.height === 1920, initial);
  check('Exact timestamp URL and film API', initial.clock === '23.20 / 50.00' && initial.duration === 50);
  check('Chinese page and bundled regular/bold fonts loaded', initial.language === 'zh-CN' && initial.fonts === 'loaded' && initial.regular && initial.bold);
  await page.locator('#film').screenshot({ path: path.join(output, 'browser-23-2.png') });

  const deterministic = await page.evaluate(async () => {
    const canvas = document.querySelector('#film'), context = canvas.getContext('2d');
    const hashes = {};
    const first = [2.2, 7.2, 19.2, 29.2, 40.8, 46.0];
    const repeats = [];
    async function hashAt(t) {
      window.film.renderAt(t);
      const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
      const hash = await crypto.subtle.digest('SHA-256', pixels);
      return [...new Uint8Array(hash)].map(n => n.toString(16).padStart(2, '0')).join('');
    }
    for (const t of first) hashes[t] = await hashAt(t);
    for (const t of [40.8, 2.2, 46.0, 19.2, 7.2, 29.2]) repeats.push({ t, same: await hashAt(t) === hashes[t] });
    return { hashes, repeats, passed: repeats.every(item => item.same) };
  });
  check('Browser frame pixels are identical after out-of-order seeks', deterministic.passed, deterministic);

  await page.setViewportSize({ width: 390, height: 844 });
  const responsive = await page.evaluate(() => {
    const r = document.querySelector('#film').getBoundingClientRect();
    return { canvasWidth: r.width, canvasHeight: r.height, viewportWidth: innerWidth, documentWidth: document.documentElement.scrollWidth };
  });
  check('Mobile canvas preserves 9:16 without horizontal overflow', Math.abs(responsive.canvasWidth / responsive.canvasHeight - 9 / 16) < .0001 && responsive.documentWidth <= responsive.viewportWidth, responsive);
  await page.screenshot({ path: path.join(output, 'browser-mobile.png'), fullPage: true });
  await page.evaluate(() => window.film.renderAt(8));
  await page.locator('#play').click();
  await page.waitForFunction(() => window.__qaAudioElements.some(a => !a.paused && a.currentTime > 8.2), { timeout: 15000 });
  const playing = await page.evaluate(() => ({ clock: parseFloat(document.querySelector('#clock').value), audio: window.__qaAudioElements.map(a => ({ paused: a.paused, currentTime: a.currentTime, readyState: a.readyState, error: a.error?.message ?? null })) }));
  check('User play button advances preview with the soundtrack', playing.clock > 8 && playing.audio.some(a => !a.paused && a.currentTime > 8 && !a.error), playing);
  await page.locator('#play').click();
  const pauseStart = await page.evaluate(() => document.querySelector('#clock').value);
  await page.waitForTimeout(250);
  const paused = await page.evaluate(() => ({ clock: document.querySelector('#clock').value, allPaused: window.__qaAudioElements.every(a => a.paused) }));
  check('Pause freezes visual time and soundtrack', paused.allPaused && paused.clock === pauseStart, paused);

  if (args.video !== 'none') {
  const videoPage = await browser.newPage({ viewport: { width: 700, height: 1100 } });
  videoPage.on('pageerror', error => errors.push(String(error)));
  await videoPage.goto(base, { waitUntil: 'domcontentloaded' });
  const media = await videoPage.evaluate(async url => {
    window.film?.renderAt(0);
    document.body.replaceChildren();
    const video = document.createElement('video');
    video.id = 'final-video'; video.controls = true; video.preload = 'auto'; video.style.width = '540px';
    document.body.append(video);
    const loaded = new Promise((resolve, reject) => { video.onloadeddata = resolve; video.onerror = () => reject(new Error(video.error?.message ?? 'Video load error')); setTimeout(() => reject(new Error('Video metadata timeout')), 30000); });
    video.src = url;
    await loaded;
    return { duration: video.duration, width: video.videoWidth, height: video.videoHeight, canPlay: video.canPlayType('video/mp4; codecs="avc1.640028, mp4a.40.2"'), readyState: video.readyState };
  }, videoUrl);
  check('Final MP4 loads and decodes in real Chromium', media.duration === 50 && media.width === 1080 && media.height === 1920 && media.readyState >= 2 && !!media.canPlay, media);
  const seek = await videoPage.evaluate(async () => {
    const video = document.querySelector('#final-video');
    await new Promise((resolve, reject) => { video.onseeked = resolve; video.onerror = reject; video.currentTime = 43.2; });
    const canvas = document.createElement('canvas'); canvas.width = 1080; canvas.height = 1920;
    const context = canvas.getContext('2d'); context.drawImage(video, 0, 0);
    const data = context.getImageData(0, 0, 1080, 1920).data;
    let sum = 0; for (let i = 0; i < data.length; i += 4) sum += data[i] + data[i + 1] + data[i + 2];
    window.__videoProof = canvas;
    return { currentTime: video.currentTime, rgbSum: sum, error: video.error?.message ?? null };
  });
  check('Final MP4 seeks to actual reassembly imagery', Math.abs(seek.currentTime - 43.2) < .01 && seek.rgbSum > 10000 && !seek.error, seek);
  const proof = await videoPage.evaluate(() => window.__videoProof.toDataURL('image/png').split(',')[1]);
  await fs.writeFile(path.join(output, 'decoded-video-43-2.png'), Buffer.from(proof, 'base64'));
  await videoPage.evaluate(async () => { const video = document.querySelector('#final-video'); video.muted = true; await video.play(); });
  await videoPage.waitForFunction(() => document.querySelector('#final-video').currentTime > 43.4, { timeout: 15000 });
  const moving = await videoPage.evaluate(() => { const v = document.querySelector('#final-video'); const result = { currentTime: v.currentTime, error: v.error?.message ?? null, decodedFrames: v.getVideoPlaybackQuality().totalVideoFrames }; v.pause(); return result; });
  check('Final MP4 playback advances with decoded video frames', moving.currentTime > 43.4 && moving.decodedFrames > 0 && !moving.error, moving);
  const black = await videoPage.evaluate(async () => {
    const video = document.querySelector('#final-video');
    await new Promise(resolve => { video.onseeked = resolve; video.currentTime = 49.8; });
    const canvas = document.createElement('canvas'); canvas.width = 1080; canvas.height = 1920;
    const context = canvas.getContext('2d'); context.drawImage(video, 0, 0);
    const data = context.getImageData(0, 0, 1080, 1920).data;
    let nonzero = 0; for (let i = 0; i < data.length; i += 4) if (data[i] || data[i + 1] || data[i + 2]) nonzero++;
    return { currentTime: video.currentTime, nonzeroPixels: nonzero };
  });
  check('Browser-decoded final hold is completely black', black.nonzeroPixels === 0 && Math.abs(black.currentTime - 49.8) < .01, black);
  const decodedAudio = await videoPage.evaluate(async url => {
    const context = new AudioContext({ sampleRate: 48000 });
    const buffer = await context.decodeAudioData(await (await fetch(url)).arrayBuffer());
    const channel = buffer.getChannelData(0);
    let sum = 0, peak = 0;
    for (let i = 16 * buffer.sampleRate; i < 17 * buffer.sampleRate; i++) { sum += channel[i] ** 2; peak = Math.max(peak, Math.abs(channel[i])); }
    let tailPeak = 0; for (let i = Math.ceil(49.5 * buffer.sampleRate); i < channel.length; i++) tailPeak = Math.max(tailPeak, Math.abs(channel[i]));
    const result = { duration: buffer.duration, channels: buffer.numberOfChannels, sampleRate: buffer.sampleRate, musicRms: Math.sqrt(sum / buffer.sampleRate), musicPeak: peak, tailPeak };
    await context.close(); return result;
  }, videoUrl);
  check('Browser decodes real stereo soundtrack and silent ending', decodedAudio.channels === 2 && decodedAudio.sampleRate === 48000 && decodedAudio.musicRms > .001 && decodedAudio.tailPeak === 0, decodedAudio);
  }
  check('Preview and playback produce no JavaScript errors', errors.length === 0, errors);
} catch (error) {
  check('Browser verification completes without internal errors', false, String(error));
} finally {
  await browser.close();
  const report = { passed: checks.every(item => item.passed), passedChecks: checks.filter(item => item.passed).length, totalChecks: checks.length, base, videoUrl, checks };
  const file = path.join(output, 'browser-verification.json');
  await fs.writeFile(file, JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ passed: report.passed, checks: `${report.passedChecks}/${report.totalChecks}`, report: file }));
  if (!report.passed) process.exitCode = 1;
}
