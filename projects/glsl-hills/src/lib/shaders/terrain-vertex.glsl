/*
 * 3D simplex noise adapted from Ashima Arts / Ian McEwan and Stefan Gustavson.
 * https://github.com/ashima/webgl-noise
 * Copyright (C) 2011 Ashima Arts. Copyright (C) 2011-2016 Stefan Gustavson.
 * MIT License: Permission is hereby granted, free of charge, to any person
 * obtaining a copy of this software and associated documentation files
 * (the "Software"), to deal in the Software without restriction, including
 * without limitation the rights to use, copy, modify, merge, publish,
 * distribute, sublicense, and/or sell copies of the Software, and to permit
 * persons to whom the Software is furnished to do so, subject to the following
 * conditions: The above copyright notice and this permission notice shall be
 * included in all copies or substantial portions of the Software.
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
 * FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OF THE SOFTWARE.
 * Analytic gradient and terrain composition added for Hills.
 */
precision highp float;

uniform float uTime;
uniform float uAmplitude;
uniform float uFineDetail;

varying vec3 vWorldPosition;
varying vec3 vSmoothNormal;
varying vec2 vLocalXZ;
varying float vHeight;

vec3 mod289(vec3 x) { return x - floor(x / 289.0) * 289.0; }
vec4 mod289(vec4 x) { return x - floor(x / 289.0) * 289.0; }
vec4 permute(vec4 x) { return mod289((x * 34.0 + 1.0) * x); }
vec4 invSqrtApprox(vec4 r) {
  return 1.79284291400159 - 0.85373472095314 * r;
}

// Returns value, then derivatives with respect to the three input coordinates.
vec4 simplexD(vec3 v) {
  const vec2 C = vec2(1.0 / 6.0, 1.0 / 3.0);
  const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);
  vec3 i = floor(v + dot(v, C.yyy));
  vec3 x0 = v - i + dot(i, C.xxx);
  vec3 g = step(x0.yzx, x0.xyz);
  vec3 l = 1.0 - g;
  vec3 i1 = min(g.xyz, l.zxy);
  vec3 i2 = max(g.xyz, l.zxy);
  vec3 x1 = x0 - i1 + C.xxx;
  vec3 x2 = x0 - i2 + C.yyy;
  vec3 x3 = x0 - D.yyy;

  i = mod289(i);
  vec4 p = permute(permute(permute(
    i.z + vec4(0.0, i1.z, i2.z, 1.0))
    + i.y + vec4(0.0, i1.y, i2.y, 1.0))
    + i.x + vec4(0.0, i1.x, i2.x, 1.0));

  vec3 ns = (1.0 / 7.0) * D.wyz - D.xzx;
  vec4 j = p - 49.0 * floor(p * ns.z * ns.z);
  vec4 x_ = floor(j * ns.z);
  vec4 y_ = floor(j - 7.0 * x_);
  vec4 x = x_ * ns.x + ns.yyyy;
  vec4 y = y_ * ns.x + ns.yyyy;
  vec4 h = 1.0 - abs(x) - abs(y);
  vec4 b0 = vec4(x.xy, y.xy);
  vec4 b1 = vec4(x.zw, y.zw);
  vec4 s0 = floor(b0) * 2.0 + 1.0;
  vec4 s1 = floor(b1) * 2.0 + 1.0;
  vec4 sh = -step(h, vec4(0.0));
  vec4 a0 = b0.xzyw + s0.xzyw * sh.xxyy;
  vec4 a1 = b1.xzyw + s1.xzyw * sh.zzww;
  vec3 p0 = vec3(a0.xy, h.x);
  vec3 p1 = vec3(a0.zw, h.y);
  vec3 p2 = vec3(a1.xy, h.z);
  vec3 p3 = vec3(a1.zw, h.w);
  vec4 norm = invSqrtApprox(vec4(
    dot(p0, p0), dot(p1, p1), dot(p2, p2), dot(p3, p3)));
  p0 *= norm.x;
  p1 *= norm.y;
  p2 *= norm.z;
  p3 *= norm.w;

  vec4 m = max(0.6 - vec4(
    dot(x0, x0), dot(x1, x1), dot(x2, x2), dot(x3, x3)), 0.0);
  vec4 m2 = m * m;
  vec4 m3 = m2 * m;
  vec4 m4 = m2 * m2;
  vec4 px = vec4(dot(p0, x0), dot(p1, x1), dot(p2, x2), dot(p3, x3));
  vec3 gradient = m4.x * p0 + m4.y * p1 + m4.z * p2 + m4.w * p3
    - 8.0 * (m3.x * px.x * x0 + m3.y * px.y * x1
    + m3.z * px.z * x2 + m3.w * px.w * x3);
  return 42.0 * vec4(dot(m4, px), gradient);
}

void main() {
  // Geometry must be rotated onto XZ before upload; keep mesh scale uniform.
  // Work in a broad terrain domain: retain the three characteristic noise
  // frequencies without turning the landscape into a dense field of spikes.
  const float domainScale = 0.32;
  vec2 p = position.xz * domainScale;
  float t = uTime;
  vec4 a = simplexD(vec3(p * 0.08, t * 0.055));
  vec4 b = simplexD(vec3(p * 0.06 + vec2(17.1, -9.2), t * 0.037 + 4.0));
  vec4 c = simplexD(vec3(p * 0.40 + vec2(-3.0, 8.0), t * 0.045));
  vec2 da = a.yz * 0.08;
  vec2 db = b.yz * 0.06;
  vec2 dc = c.yz * 0.40;
  float phase = dot(p, vec2(0.034, 0.024)) + t * 0.08 + 0.55 * a.x;
  vec2 dPhase = vec2(0.034, 0.024) + 0.55 * da;
  float q = dot(p, vec2(0.016, -0.012)) + t * 0.035;
  float envelope = 0.8 + 0.2 * sin(q);
  vec2 dEnvelope = 0.2 * cos(q) * vec2(0.016, -0.012);
  float ridge = sin(phase) * sin(phase) - 0.5;
  float fine = 0.35 * uFineDetail;
  float height = 11.0 * a.x + 5.0 * b.x + fine * c.x
    + 6.0 * envelope * ridge;
  vec2 dh = 11.0 * da + 5.0 * db + fine * dc
    + 6.0 * (dEnvelope * ridge + envelope * sin(2.0 * phase) * dPhase);
  height *= uAmplitude;
  dh *= uAmplitude * domainScale;

  vec3 displaced = vec3(position.x, position.y + height, position.z);
  vec3 localNormal = normalize(vec3(-dh.x, 1.0, -dh.y));
  vWorldPosition = (modelMatrix * vec4(displaced, 1.0)).xyz;
  vSmoothNormal = normalize(mat3(modelMatrix) * localNormal);
  vLocalXZ = position.xz;
  vHeight = height;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(displaced, 1.0);
}

