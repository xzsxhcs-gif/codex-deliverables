import { type Ctx, type Vec2, W, H, P, clamp, lerp, smooth, easeInOut, easeOut, pulse, line, ring, text, backdrop, poly } from '../core';
import { getGlyphPoints, getWordmarkPoints, drawGene, drawPackage } from '../visuals/brand';

const TAU = Math.PI * 2;
const SAMPLE_COUNT = 64;
const INKS = [P.white, P.red, P.electric, P.white, P.electric, P.red, P.white, P.electric];
const GLYPH_NAMES = 'SNICKERS';
const genes: Vec2[][] = Array.from({length: 8}, (_, i) => getGlyphPoints(i, SAMPLE_COUNT));
const packageWidth = 870;
const projectedLogoScale = packageWidth / 900 * 1750 / 1714;
const targets = getWordmarkPoints(603 * projectedLogoScale, 137 * projectedLogoScale, SAMPLE_COUNT)
  .map(gene => gene.map(point => ({x:540 + point.x, y:960 + point.y})));

function trace(ctx: Ctx, points: Vec2[], color: string, width: number, alpha = 1, close = false) {
  if (!points.length || alpha <= 0) return;
  ctx.save(); ctx.globalAlpha *= alpha; ctx.strokeStyle = color; ctx.lineWidth = width;
  ctx.beginPath(); ctx.moveTo(points[0].x, points[0].y);
  for (let i = 1; i < points.length; i++) ctx.lineTo(points[i].x, points[i].y);
  if (close) ctx.closePath(); ctx.stroke(); ctx.restore();
}

function corner(ctx: Ctx, x: number, y: number, scale: number, color: string) {
  line(ctx, x - scale, y, x + scale, y, color, 2);
  line(ctx, x, y - scale, x, y + scale, color, 2);
}

function caption(ctx: Ctx, word: string, index: string, light = false) {
  const ink = light ? P.ink : P.paper;
  text(ctx, word, 69, 134, 28, ink, 'left', 600);
  text(ctx, index, 1008, 134, 20, ink, 'right', 500);
  line(ctx, 70, 175, 1010, 175, ink, 1.5, .26);
}

function stageLabel(ctx: Ctx, name: string, x: number, y: number, alpha = 1) {
  ctx.save(); ctx.globalAlpha *= alpha;
  text(ctx, name, x, y, 15, P.muted, 'center', 500); ctx.restore();
}

function genealogy(ctx: Ctx, t: number) {
  const local = t - 32;
  const expansion = smooth(local / 1.2);
  const fold = easeInOut((local - 1.3) / 1.9);
  const rotation = -.12 * smooth(local / 3.2);
  const entrance = smooth(local / .26);
  const beatFold = pulse(t, 6) * entrance;
  const cx = 540, cy = lerp(920, 966, expansion);
  const rx = lerp(340, 442, expansion), ry = lerp(430, 610, expansion);
  caption(ctx, 'RECURSION', '08 / 01');
  ctx.save(); ctx.translate(cx, cy); ctx.rotate(rotation);
  const archive = 1 - smooth((local - 2.65) / .55);
  ctx.globalAlpha = .64 * entrance * archive;
  for (let r = 0; r < 4; r++) {
    ctx.save(); ctx.scale(1, 1.32);
    ring(ctx, 0, 0, 180 + r * 92, r % 2 ? P.electric : P.paper, r === 2 ? 4.8 : 2);
    for (let j = 0; j < 32; j++) {
      const a = j * TAU / 32;
      const radius = 180 + r * 92;
      const reach = j % 4 ? 6 : 17;
      line(ctx, Math.cos(a) * radius, Math.sin(a) * radius, Math.cos(a) * (radius + reach), Math.sin(a) * (radius + reach), P.paper, 1);
    }
    ctx.restore();
  }
  ctx.restore();
  const nodes: Vec2[] = [];
  for (let i = 0; i < 8; i++) {
    const a = i * TAU / 8 - Math.PI / 2 + rotation;
    const x = cx + Math.cos(a) * rx, y = cy + Math.sin(a) * ry;
    nodes.push({x, y});
    const hinge = smooth((local - 1.45 - i * .065) / 1.1);
    const paneWidth = 212 * (1 - .78 * hinge) * (1 - beatFold * .38);
    const paneHeight = 308 + 190 * hinge + 42 * beatFold;
    const panelCream = i % 3 === 0;
    const panelColor = panelCream ? P.paper : i % 3 === 1 ? P.red : P.blue;
    const panelInk = panelCream ? P.ink : P.paper;
    const bevel = 18 + beatFold * 28;
    const panelAngle = hinge * (i % 2 ? .45 : -.45) + beatFold * (i % 2 ? -.12 : .12);
    ctx.save(); ctx.translate(x, y); ctx.rotate(panelAngle);
    ctx.globalAlpha = entrance * (1 - fold * .22);
    poly(ctx, [{x:-paneWidth / 2,y:-paneHeight / 2},{x:paneWidth / 2,y:-paneHeight / 2-38*hinge},{x:paneWidth / 2+bevel,y:-paneHeight / 2-38*hinge+bevel},{x:-paneWidth / 2+bevel,y:-paneHeight / 2+bevel}], P.white);
    poly(ctx, [{x:paneWidth / 2,y:-paneHeight / 2-38*hinge},{x:paneWidth / 2+bevel,y:-paneHeight / 2-38*hinge+bevel},{x:paneWidth / 2+bevel,y:paneHeight / 2+bevel},{x:paneWidth / 2,y:paneHeight / 2}], i % 2 ? '#771b26' : '#182c75');
    poly(ctx, [{x:-paneWidth / 2, y:-paneHeight / 2},{x:paneWidth / 2,y:-paneHeight / 2-38*hinge},{x:paneWidth / 2,y:paneHeight / 2},{x:-paneWidth / 2,y:paneHeight / 2+38*hinge}], panelColor, panelInk, 2.8);
    for (let r = 0; r < 3; r++) line(ctx, -paneWidth * .35, 101 + r * 12, paneWidth * .35, 101 + r * 12, panelInk, 2, .6);
    ctx.restore();
    const glyphSize = lerp(128, 201, expansion) + 14 * beatFold;
    const glyphAngle = fold * .12 * Math.sin(i);
    drawGene(ctx, i, x, y, glyphSize, glyphAngle, INKS[i], 1 - entrance);
    ctx.save(); ctx.translate(x, y); ctx.rotate(glyphAngle);
    const contour = genes[i].map(p => ({x:p.x * glyphSize,y:p.y * glyphSize}));
    trace(ctx, contour, P.paper, 8.2, entrance, true);
    trace(ctx, contour, panelInk, 5.3, entrance, true);
    ctx.restore();
    drawGene(ctx, i, x, y, glyphSize, glyphAngle, panelInk, entrance);
    stageLabel(ctx, `0${i + 1}  ${GLYPH_NAMES[i]}`, x, y + 188, expansion * (1 - fold));
  }
  ctx.save(); ctx.globalAlpha = .58 * entrance * (1 - fold * .7);
  for (let i = 0; i < 8; i++) {
    const a = nodes[i], b = nodes[(i + 3) % 8];
    const bend = {x: lerp(a.x, cx, .56), y: lerp(a.y, cy, .56)};
    trace(ctx, [a, bend, {x:bend.x, y:b.y}, b], i % 2 ? P.red : P.electric, 2.6);
  }
  ctx.restore();
  ctx.save(); ctx.globalAlpha = entrance * .95;
  const diameter = 252 + beatFold * 48;
  ctx.translate(cx, cy); ctx.rotate(Math.PI / 4);
  poly(ctx, [{x:-diameter/2,y:-diameter/2},{x:diameter/2,y:-diameter/2},{x:diameter/2,y:diameter/2},{x:-diameter/2,y:diameter/2}], P.blue, P.paper, 5);
  ctx.restore();
  if (entrance > .05) {
    const remaining = Math.max(1, 8 - Math.floor((local + 1e-7) / .4));
    ctx.save(); ctx.globalAlpha = entrance;
    text(ctx, String(remaining).padStart(2, '0'), cx, cy - 17, 133, P.white, 'center', 800);
    text(ctx, '→ 01', cx, cy + 91, 28, P.white, 'center', 600);
    ctx.restore();
  }
  // The diagrams close along their own eight spokes, never into an unrelated particle cloud.
  if (local > 2.7) {
    const shutter = easeInOut((local - 2.7) / .5);
    ctx.fillStyle = P.black;
    ctx.fillRect(0, 0, W, H * .5 * shutter);
    ctx.fillRect(0, H - H * .5 * shutter, W, H * .5 * shutter);
    line(ctx, 0, H / 2 - 2, W, H / 2 - 2, P.red, 4, shutter);
  }
}

function macroCuts(ctx: Ctx, t: number) {
  const local = t - 35.2;
  const shot = Math.min(3, Math.floor(local / .8));
  const u = (local - shot * .8) / .8;
  const paper = shot % 2 === 0;
  backdrop(ctx, paper ? P.paper : P.ink);
  const foreground = paper ? P.ink : P.paper;
  caption(ctx, ['TRACE', 'MYTH', 'CODE', 'INVERSE'][shot], `0${shot * 2 + 1} + 0${shot * 2 + 2}`, paper);
  const sweep = smooth(u);
  const skew = (shot % 2 ? -1 : 1) * (.12 - .08 * sweep);
  ctx.save(); ctx.translate(540, 960); ctx.rotate(skew);
  const scale = 1.02 + .18 * easeOut(u);
  ctx.scale(scale, scale);
  for (let side = 0; side < 2; side++) {
    const i = shot * 2 + side;
    const y = side ? 324 : -324;
    const points = genes[i].map(p => ({x:p.x * 695, y:y + p.y * 695}));
    drawGene(ctx, i, 0, y, 695, 0, foreground, 1);
    ctx.save();
    ctx.beginPath(); ctx.rect(-600, y - 72, 1200, 144); ctx.clip();
    drawGene(ctx, i, 34 * (1 - easeOut(u * 3)), y, 695, 0, paper ? P.red : P.electric, 1);
    ctx.restore();
    // Sampling marks make the contour-to-civilization relationship visible at macro scale.
    for (let j = 0; j < points.length; j += 4) {
      const p = points[j];
      ctx.fillStyle = paper ? P.red : P.electric;
      ctx.fillRect(p.x - 4.5, p.y - 4.5, 9, 9);
      if (j % 16 === 0) {
        line(ctx, p.x, p.y, p.x + (j % 32 ? -72 : 72), p.y - 49, foreground, 1, .65);
        text(ctx, `${String(i + 1).padStart(2, '0')}.${String(j).padStart(2, '0')}`, p.x + (j % 32 ? -76 : 76), p.y - 60, 14, foreground, j % 32 ? 'right' : 'left', 500);
      }
    }
  }
  line(ctx, -600, 0, 600, 0, P.red, 8);
  ctx.restore();
  line(ctx, 70, 1699, 1010, 1699, foreground, 1.3, .35);
  text(ctx, 'S N I C K E R S', 540, 1758, 27, foreground, 'center', 700);
  const dashCount = 40;
  ctx.fillStyle = P.red;
  for (let i = 0; i < dashCount; i++) ctx.fillRect(70 + i * 24, 1787, i < (shot + u) * 10 ? 15 : 3, 9);
}

/** One sample is always one point from one of the eight actual letter contours. */
function contourPosition(i: number, j: number, t: number): Vec2 {
  const p = genes[i][j];
  const local = t - 38.4;
  const a = i * TAU / 8 - Math.PI / 2;
  const intro = smooth(local / 1.5);
  const spin = .52 * intro;
  const glyphRotation = a + Math.PI / 2 + .38 * intro;
  const cs = Math.cos(glyphRotation), sn = Math.sin(glyphRotation);
  const origin = {
    x: 540 + Math.cos(a + spin) * (405 + 75 * intro) + (p.x * cs - p.y * sn) * (230 + 90 * intro),
    y: 960 + Math.sin(a + spin) * (690 + 100 * intro) + (p.x * sn + p.y * cs) * (230 + 90 * intro),
  };
  const target = targets[i][j];
  const delay = i * .033 + (j / SAMPLE_COUNT) * .16;
  const gather = easeInOut((local - 1.6 - delay) / (3.15 - delay));
  const bridge = Math.sin(Math.PI * gather) * (1 - gather);
  const tangent = a + j / SAMPLE_COUNT * .65 + .52;
  return {
    x: lerp(origin.x, target.x, gather) + Math.cos(tangent + Math.PI / 2) * 235 * bridge,
    y: lerp(origin.y, target.y, gather) + Math.sin(tangent + Math.PI / 2) * 325 * bridge,
  };
}

function wrapStrips(ctx: Ctx, t: number) {
  const fold = easeInOut((t - 40.0) / 3.2);
  if (fold <= 0) return;
  ctx.save(); ctx.globalAlpha = clamp((t - 40) / .6) * (1 - smooth((t - 43.05) / .45));
  for (let side = 0; side < 2; side++) {
    const sign = side ? 1 : -1;
    for (let band = 0; band < 3; band++) {
      const y = lerp(sign > 0 ? H + 90 + band * 120 : -90 - band * 120, 960 + sign * [80, 92, 119][band], fold);
      const width = lerp(1250, [617, 642, 650][band], fold), skew = (1 - fold) * sign * 540;
      const thickness = lerp([70, 48, 90][band], 16, fold);
      poly(ctx, [{x:540-width/2+skew,y:y-thickness/2},{x:540+width/2+skew,y:y-thickness/2},{x:540+width/2-skew,y:y+thickness/2},{x:540-width/2-skew,y:y+thickness/2}], [P.white, P.red, P.brown][band]);
    }
    const brownX = lerp(sign < 0 ? -540 : W + 540, 540 + sign * 418, fold);
    poly(ctx, [{x:brownX-42,y:829},{x:brownX+42,y:815},{x:brownX+42,y:1105},{x:brownX-42,y:1091}], P.brown, P.gold, .8);
  }
  ctx.restore();
}

function convergence(ctx: Ctx, t: number) {
  const local = t - 38.4;
  const gather = smooth((local - 1.6) / 3.15);
  const resolve = smooth((t - 42.95) / .4);
  const finish = smooth((t - 43.2) / .8);
  backdrop(ctx, P.black);
  const atmosphere = ctx.createRadialGradient(540, 960, 90, 540, 960, 980);
  atmosphere.addColorStop(0, '#122247'); atmosphere.addColorStop(.42, '#0b152b'); atmosphere.addColorStop(1, P.black);
  ctx.fillStyle = atmosphere; ctx.fillRect(0, 0, W, H);
  const uiAlpha = 1 - smooth((t - 42.5) / .6);
  ctx.save(); ctx.globalAlpha = uiAlpha;
  caption(ctx, 'COLLAPSE', '08 → 01');
  text(ctx, `${String(Math.min(512, Math.floor(512 * gather))).padStart(3, '0')} / 512`, 540, 1747, 20, P.muted, 'center', 500);
  ctx.restore();
  wrapStrips(ctx, t);
  // Three nested, contracting tracks retain the package's blue/white/red stripe order.
  ctx.save(); ctx.globalAlpha = (1 - gather) * .46;
  for (let r = 0; r < 3; r++) {
    ctx.save(); ctx.translate(540, 960); ctx.scale(1, 1.48 - .48 * gather);
    ring(ctx, 0, 0, lerp(420 + r * 60, 320 + r * 12, gather), [P.electric, P.white, P.red][r], r === 1 ? 11 : 7, -Math.PI / 2, Math.PI * 1.5 - .15);
    ctx.restore();
  }
  ctx.restore();
  const contours = genes.map((gene, i) => gene.map((_, j) => contourPosition(i, j, t)));
  ctx.save(); ctx.globalAlpha = (1 - resolve) * .22 * (1 - gather * .85);
  ctx.strokeStyle = P.electric; ctx.lineWidth = 1;
  ctx.beginPath();
  for (let i = 0; i < 8; i++) {
    for (let j = 0; j < SAMPLE_COUNT; j += 8) {
      const p = contours[i][j], q = contours[(i + 3) % 8][(j + 16) % SAMPLE_COUNT];
      ctx.moveTo(p.x, p.y); ctx.lineTo(lerp(p.x, 540, .3), lerp(q.y, 960, .3)); ctx.lineTo(q.x, q.y);
    }
  }
  ctx.stroke(); ctx.restore();
  for (let i = 0; i < 8; i++) {
    const points = contours[i];
    const color = INKS[i];
    ctx.save(); ctx.globalAlpha = (1 - resolve) * lerp(.28, .12, gather);
    poly(ctx, points, color);
    ctx.restore();
    // Filled contour faces and two-scale edges stay legible after phone downsampling.
    trace(ctx, points, P.black, lerp(9.8, 11.5, gather), (1 - resolve), true);
    trace(ctx, points, color, lerp(4.5, 6.0, gather), (1 - resolve), true);
    if (i % 3 === 2) trace(ctx, points, P.paper, 1.8, (1 - resolve) * .55, true);
    ctx.save(); ctx.globalAlpha = (1 - resolve) * lerp(.95, .45, gather);
    ctx.fillStyle = color;
    for (let j = 0; j < points.length; j += 2) {
      const point = points[j], size = j % 8 === 0 ? 7.5 : 4.0;
      ctx.fillRect(point.x - size / 2, point.y - size / 2, size, size);
    }
    ctx.restore();
    if (local < 1.6) {
      const p = points[0];
      stageLabel(ctx, `0${i + 1} · ${GLYPH_NAMES[i]}`, p.x, p.y - 30, .65);
    }
  }
  if (gather > .85) {
    ctx.save(); ctx.globalAlpha = smooth((gather - .85) / .15) * (1 - resolve);
      const frame = [{x:219,y:867},{x:861,y:867},{x:868,y:1053},{x:212,y:1053}];
    poly(ctx, frame, undefined, P.red, 4);
    for (const p of frame) corner(ctx, p.x, p.y, 14, P.white);
    ctx.restore();
  }
  if (resolve > 0) {
    drawPackage(ctx, {x:540, y:960, width:packageWidth, angle:0, rotateX:0, rotateY:0, opacity:resolve, build:1, explode:0});
  }
  if (finish > 0) {
    ctx.save(); ctx.globalAlpha = finish;
    line(ctx, 180, 1273, 900, 1273, P.paper, 1, .2);
    text(ctx, '01', 540, 1350, 20, P.muted, 'center', 500);
    ctx.restore();
  }
}

export function drawReassembly(ctx: Ctx, t: number) {
  ctx.save();
  backdrop(ctx, P.black);
  if (t < 35.2) genealogy(ctx, t);
  else if (t < 38.4) macroCuts(ctx, t);
  else convergence(ctx, t);
  ctx.restore();
}
