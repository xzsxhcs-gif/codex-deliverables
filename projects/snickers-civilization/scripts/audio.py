#!/usr/bin/env python3
"""Original, deterministic score. Requires Python 3, numpy, scipy, and FFmpeg.

No samples, sound libraries, speech models, or network requests are used.
The 150 BPM clock is also the visual editor's clock (one beat = 12 frames).
"""
from __future__ import annotations

import argparse
import hashlib
import json
import math
import re
import subprocess
from pathlib import Path

import numpy as np
from scipy import signal
from scipy.io import wavfile

SR = 48_000
DURATION = 50
BEAT = 0.4
N = SR * DURATION
ROOT = Path(__file__).resolve().parents[1]
RNG = np.random.default_rng(0x534E4943)
TAU = 2 * np.pi
STEMS = {name: np.zeros((N, 2), dtype=np.float32)
         for name in ('drums', 'bass', 'music', 'space', 'fx')}
EVENTS: list[dict] = []
KICKS: list[float] = []


def clock(length: float) -> np.ndarray:
    return np.arange(max(1, round(length * SR)), dtype=np.float64) / SR


def hz(note: float) -> float:
    return 440 * 2 ** ((note - 69) / 12)


def taper(x: np.ndarray, attack: float = .002, release: float = .015) -> np.ndarray:
    y = x.copy()
    a, r = min(len(y), int(attack * SR)), min(len(y), int(release * SR))
    if a:
        y[:a] *= np.sin(np.linspace(0, np.pi / 2, a)) ** 2
    if r:
        y[-r:] *= np.cos(np.linspace(0, np.pi / 2, r)) ** 2
    return y.astype(np.float32)


def filt(x: np.ndarray, cutoff, kind='lowpass', order=2) -> np.ndarray:
    return signal.sosfilt(signal.butter(order, cutoff, btype=kind, fs=SR, output='sos'), x)


def noise(t: np.ndarray) -> np.ndarray:
    return RNG.normal(0, 1, len(t))


def add(stem: str, when: float, sound: np.ndarray, gain=1., pan=0., label=None):
    start = round(when * SR)
    if start >= N:
        return
    sound = np.asarray(sound, dtype=np.float32)
    if start < 0:
        sound = sound[-start:]
        start = 0
    size = min(len(sound), N - start)
    if size <= 0:
        return
    if sound.ndim == 1:
        angle = (np.clip(pan, -1, 1) + 1) * np.pi / 4
        STEMS[stem][start:start+size, 0] += sound[:size] * gain * np.cos(angle)
        STEMS[stem][start:start+size, 1] += sound[:size] * gain * np.sin(angle)
    else:
        STEMS[stem][start:start+size] += sound[:size] * gain
    if label:
        EVENTS.append({'t': round(when, 5), 'kind': label, 'gain': round(gain, 4)})


def kick(when: float, strength=1.):
    t = clock(.42)
    f = 48 + 116 * np.exp(-t * 30)
    phase = TAU * np.cumsum(f) / SR
    core = np.sin(phase) * np.exp(-t * 11.5)
    body = .22 * np.sin(phase * 2.003) * np.exp(-t * 24)
    click = .14 * filt(noise(t), [1200, 6800], 'bandpass') * np.exp(-t * 165)
    add('drums', when, taper(np.tanh(1.7 * (core + body)) / 1.25 + click), .72 * strength)
    KICKS.append(when)


def snare(when: float, strength=1., pan=0.):
    t = clock(.28)
    skin = np.sin(TAU * (166 * t + 15 * (1 - np.exp(-t * 32)) / 32)) * np.exp(-t * 22)
    upper = np.sin(TAU * 337 * t) * np.exp(-t * 34)
    wire = filt(noise(t), [1050, 9800], 'bandpass')
    snap = filt(noise(t), [2400, 11500], 'bandpass') * np.exp(-t * 145)
    x = .42 * skin + .14 * upper + .54 * wire * np.exp(-t * 20) + .24 * snap
    add('drums', when, taper(np.tanh(1.6 * x)), .55 * strength, pan)


def hat(when: float, strength=.6, opened=False, pan=.25):
    t = clock(.25 if opened else .065)
    metal = sum(np.sign(np.sin(TAU * f * t)) for f in (401, 487, 613, 787, 1043, 1397)) / 6
    metallic = filt(metal + noise(t) * .44, [6000, 15500], 'bandpass')
    decay = 20 if opened else 77
    add('drums', when, taper(metallic * np.exp(-t * decay), .0007, .008), .24 * strength, pan)


def tom(when: float, note: float, strength=1., pan=0.):
    t = clock(.42)
    f = hz(note) * (1 + .22 * np.exp(-t * 18))
    p = TAU * np.cumsum(f) / SR
    x = (np.sin(p) + .21 * np.sin(p * 1.58)) * np.exp(-t * 12)
    x += .10 * filt(noise(t), [500, 3900], 'bandpass') * np.exp(-t * 70)
    add('drums', when, taper(x), .37 * strength, pan)


def crash(when: float, gain=.2):
    t = clock(1.6)
    n = filt(noise(t), [2500, 14000], 'bandpass')
    shimmer = .4 + .6 * np.sin(TAU * 19.4 * t) ** 2
    add('space', when, taper(n * np.exp(-t * 3.7) * shimmer), gain, -.25)
    add('space', when + .027, taper(n * np.exp(-t * 4.1)), gain * .3, .8)


def bass(when: float, note: float, length=.18, gain=.25):
    t = clock(length + .08)
    f = hz(note)
    # Low harmonics retain a fundamental on phone speakers without an all-sub mix.
    x = np.sin(TAU * f * t) + .32 * np.sin(TAU * 2 * f * t) + .19 * np.sin(TAU * 3 * f * t)
    x += .12 * signal.sawtooth(TAU * f * t)
    x = filt(np.tanh(x * 1.8), 1350)
    env = np.exp(-t * 1.6) * np.minimum(1, np.maximum(0, (length + .08 - t) / .07))
    add('bass', when, taper(x * env, .005, .015), gain)


def pluck(when: float, note: float, length=.43, gain=.14, pan=0., electric=False):
    t = clock(length)
    f = hz(note)
    x = np.zeros_like(t)
    for harmonic in range(1, 13 if electric else 9):
        decay = 4.3 + harmonic * (1.6 if electric else 2.3)
        amp = (1 / harmonic ** (1.05 if electric else 1.7))
        x += amp * np.sin(TAU * f * harmonic * t + .002 * np.sin(TAU * 5.1 * t)) * np.exp(-t * decay)
    if electric:
        x = filt(np.tanh(2.1 * x), 6500)
    add('music', when, taper(x, .003, .03), gain, pan)
    add('space', when + .3, taper(x, .003, .03), gain * .2, -pan)


def chord(when: float, notes: list[float], length: float, gain=.13, choir=False):
    t = clock(length + .35)
    stereo = np.zeros((len(t), 2))
    for ni, note in enumerate(notes):
        for side, detune in enumerate((-.045, .045)):
            fundamental = hz(note + detune)
            x = np.zeros_like(t)
            for h in range(1, 23):
                if choir:
                    formant = (.15 + 2.3 * np.exp(-((h * fundamental - 650) / 225) ** 2)
                               + 1.0 * np.exp(-((h * fundamental - 1250) / 360) ** 2))
                    amplitude = formant / h ** 1.45
                else:
                    amplitude = .9 / h ** 1.25
                x += amplitude * np.sin(TAU * fundamental * h * t + ni * .7)
            stereo[:, side] += x / len(notes)
    attack = .32 if choir else .025
    env = np.minimum(1, t / attack) * np.minimum(1, np.maximum(0, (length + .35 - t) / .4))
    if not choir:
        stereo = np.tanh(stereo * 1.6)
        env *= .55 + .45 * np.exp(-t * 3)
    stereo *= env[:, None]
    add('music', when, stereo, gain, label='harmonic-bed')


def tick(when: float, note=86, gain=.12, pan=0.):
    t = clock(.065)
    x = (np.sin(TAU * hz(note) * t) * np.exp(-t * 74)
         + .19 * filt(noise(t), 4200, 'highpass') * np.exp(-t * 220))
    add('fx', when, taper(x, .001, .01), gain, pan)


def impact(when: float, gain=.5, note=38):
    t = clock(1.5)
    f = hz(note) * (1 + .65 * np.exp(-t * 13))
    p = TAU * np.cumsum(f) / SR
    x = (np.sin(p) + .23 * np.sin(p * 2)) * np.exp(-t * 6)
    n = filt(noise(t), [140, 5500], 'bandpass')
    x += .15 * n * np.exp(-t * 12)
    add('fx', when, taper(x), gain, label='structural-impact')


def rise(when: float, length: float, gain=.18):
    t = clock(length)
    u = t / length
    n = filt(noise(t), [700, 7800], 'bandpass')
    p = TAU * np.cumsum(130 + 900 * u ** 2) / SR
    tonal = np.sin(p) * .18 + np.sin(p * 2.006) * .05
    x = (n * .35 + tonal) * u ** 1.6
    add('fx', when, taper(x, .04, .012), gain, -.15, label='convergence-riser')


def music():
    # Construction: independent pulses grow into the rhythmic language of the score.
    chord(0, [50, 57, 62], 5.9, .035, choir=True)
    for i in range(32):
        when = i * .2
        if i < 8 and i % 2:
            continue
        tick(when, (74, 81, 86, 89, 93, 86, 81, 77)[i % 8], .055 + .002 * i, math.sin(i * 1.7) * .7)
        if i % 8 == 0:
            bass(when, 38, .32, .12 + .012 * i)
    for when in (1.6, 3.2, 4.8):
        impact(when, .16)
    rise(4.8, 1.6, .25)
    for i in range(4):
        snare(6.0 + i * .1, .25 + .12 * i, (i - 1.5) * .2)

    # Main clock. Kick/snare breaks have four patterns and phrase-ending fills.
    for bar in range(24):
        start = 6.4 + bar * 1.6
        if start >= 44.8:
            break
        phase = 0 if start < 16 else (1 if start < 32 else 2)
        patterns = ((0, .6, .8, 1.4), (0, .7, 1.0, 1.3), (0, .4, .9, 1.2), (0, .3, .8, 1.1, 1.4))
        kicks = patterns[bar % 4]
        for at in kicks:
            if start + at >= 44.8:
                continue
            kick(start + at, .95 if at == 0 else .72)
        for at in (.4, 1.2):
            snare(start + at, 1 if phase != 2 else 1.08)
        if bar % 4 == 3:
            snare(start + 1.1, .24, -.3)
            snare(start + 1.5, .38, .3)
        for i in range(8):
            hat(start + i * .2, .52 if i % 2 == 0 else .78, opened=i == 7, pan=.35 if i % 2 else -.22)
        if phase == 2 or bar % 4 == 3:
            for at in (1.3, 1.5):
                hat(start + at, .34, pan=-.45)
        if phase == 2 and bar % 2:
            for i in range(4):
                snare(start + 1.2 + i * .1, .25 + .09 * i, -.5 + i / 3)
        if bar % 4 == 0:
            crash(start, .14)

        root = (38, 34, 41, 36)[bar % 4]
        degrees = (0, 0, 12, 7, 0, 12, 7, 10)
        for i, d in enumerate(degrees):
            bass(start + .2 * i, root + d, .145 if i % 2 else .17, .23)
        # Open fifths tie every historical timbre to the same hidden harmonic gene.
        chord(start, [root + 24, root + 31, root + 36], 1.42, .12 if phase == 0 else .09)

    motif = (74, 77, 81, 86, 84, 81, 79, 77)
    # A recognisable hook, with rests. Later epochs reuse its pitch order.
    for phrase in range(6):
        start = 6.4 + phrase * 1.6
        for i, n in enumerate(motif):
            if i == 3 and phrase % 2 == 0:
                continue
            pluck(start + .2 * i, n if phrase % 4 < 2 else n - 5, .34, .105, math.sin(i * .9) * .42, True)

    # Eight five-beat epochs: historical changes are transformations of the hook.
    for epoch in range(8):
        start = 16 + epoch * 2
        impact(start, .29 + epoch * .016)
        EVENTS.append({'t': start, 'kind': 'civilization-epoch', 'epoch': epoch})
        if epoch == 0:  # Totem: pitched skin, five-beat grouping.
            for i, off in enumerate((0, .3, .6, .8, 1.0, 1.4, 1.6, 1.8)):
                tom(start + off, (38, 45, 50, 45)[i % 4], .92 if i % 2 == 0 else .6, -.55 + (i % 3) * .55)
            chord(start, [50, 57, 62], 1.65, .09, True)
        elif epoch == 1:  # Ornament: synthesised vowel formants, no voice recording.
            chord(start, [62, 65, 69, 74], 1.7, .24, True)
            for i in range(5):
                pluck(start + i * .4, motif[i], .8, .10, -.6 + i * .3)
        elif epoch in (2, 3):  # Geometry and orbit: one hook becomes phase-shifted constellations.
            for i in range(10):
                pluck(start + i * .2, motif[(i + epoch) % 8] + (12 if i % 5 == 4 else 0), .5, .105, math.sin(i * 1.4) * .75)
            chord(start, [58, 65, 70], 1.7, .11, True)
        elif epoch == 4:  # Heraldic brass: tighter harmonic attack.
            for off in (0, .6, 1.2, 1.6):
                chord(start + off, [62, 69, 74], .3, .24)
            for i in range(5):
                tom(start + i * .4, 45 + i % 3 * 5, .65, -.3)
        elif epoch == 5:  # Formula: the same motif subdivides into exact permutations.
            for i in range(16):
                pluck(start + i * .125, motif[(i * 3) % 8], .22, .087, ((i % 4) - 1.5) * .35, True)
        else:  # Circuit and digital civilization: increasing event density.
            for i in range(20):
                pluck(start + i * .1, motif[(i * (3 if epoch == 6 else 5)) % 8] - 12, .16, .075, math.sin(i) * .6, True)
                if i % 3 == 0:
                    tick(start + i * .1, 86 + i % 5, .047, -math.sin(i) * .6)
            rise(start + .8, 1.2, .17 + .03 * (epoch - 6))

    # Fold-back: hook returns in increasing subdivisions, with deliberate tiny rests.
    for phrase in range(5):
        start = 32 + 1.6 * phrase
        for i in range(8):
            pluck(start + .2 * i, motif[7 - i] - (12 if phrase % 2 else 0), .28, .14, math.sin(i * .8) * .55, True)
        impact(start, .42)
        # A 30–45 ms gated gap creates an edit accent without adding a random effect.
        if phrase in (1, 3):
            a = round((start + 1.51) * SR)
            b = round((start + 1.555) * SR)
            for name in ('music', 'space'):
                STEMS[name][a:b] *= np.linspace(1, 0, b - a)[:, None]

    rise(40, 3.19, .39)
    for i in range(32):
        at = 40 + i * .1
        pluck(at, 62 + (0, 3, 7, 10, 12, 15, 19, 22)[i % 8] + (12 if i >= 24 else 0), .22, .105, math.sin(i * .75) * .62, True)
        if i >= 20:
            snare(at, .32 + (i - 20) * .025, math.sin(i) * .4)
    # Brief vacuum leads to the resolved object, then one sustained final chord.
    for stem in STEMS.values():
        a, b = round(43.12 * SR), round(43.2 * SR)
        stem[a:b] *= np.linspace(1, .04, b - a)[:, None]
    impact(43.2, .85)
    kick(43.2, 1.1)
    crash(43.2, .26)
    chord(43.2, [50, 57, 62, 65, 69, 74], 1.5, .42)
    pluck(43.2, 86, 1.4, .22, 0, True)

    # All epic machinery disappears at the exact edit. Keep a small physical joke.
    cutoff = round(44.8 * SR)
    for stem in STEMS.values():
        stem[cutoff-480:cutoff] *= np.linspace(1, 0, 480)[:, None]
        stem[cutoff:] = 0
    for when, gain, length in ((45.25, .028, .17), (45.51, .019, .095), (46.15, .012, .11)):
        t = clock(length)
        paper = filt(noise(t), [2600, 12000], 'bandpass')
        paper *= (.2 + .8 * np.sin(TAU * (41 * t + 70 * t*t)) ** 8) * np.exp(-t * 24)
        add('fx', when, taper(paper, .004, .01), gain, .15, label='tiny-procedural-wrapper')
    pluck(47.2, 62, .72, .019, 0)
    room_t = clock(4.5)
    add('space', 44.8, taper(filt(noise(room_t), [180, 1200], 'bandpass'), .2, .3), .0005)


def mix() -> np.ndarray:
    # Kick side-chain preserves clarity without turning the score into an EDM pump.
    duck = np.ones(N, np.float32)
    for when in KICKS:
        a = round(when * SR)
        t = clock(.16)
        d = 1 - .26 * np.exp(-t * 22)
        end = min(N, a + len(d))
        duck[a:end] = np.minimum(duck[a:end], d[:end-a])
    STEMS['bass'] *= duck[:, None]
    STEMS['music'] *= (.75 + .25 * duck)[:, None]
    # Short decorrelated room reflections. Long echoes would blur the edit clock.
    bus = (STEMS['music'] + STEMS['fx']) * .22
    for delay, gain, cross in ((.023, .22, False), (.061, .19, True), (.113, .14, False), (.179, .095, True)):
        offset = round(delay * SR)
        reflected = bus[:-offset, ::-1] if cross else bus[:-offset]
        STEMS['space'][offset:] += gain * reflected
    result = sum(STEMS.values())
    result = np.tanh(result * .93) * .78
    result = signal.sosfilt(signal.butter(2, 27, 'highpass', fs=SR, output='sos'), result, axis=0)
    # Effects must not leave delayed energy across the comedic hard cut or black.
    c = round(44.8 * SR)
    result[c:c+240] *= np.linspace(0, 1, 240)[:, None]
    result[c:round(44.98*SR)] *= .02
    end = round(49.3 * SR)
    final = round(49.5 * SR)
    result[end:final] *= np.linspace(1, 0, final-end)[:, None]
    result[final:] = 0
    return result.astype(np.float32)


def run(args: list[str]) -> subprocess.CompletedProcess:
    p = subprocess.run(args, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
    if p.returncode:
        raise RuntimeError(p.stderr)
    return p


def loudness(path: Path) -> dict:
    proc = run(['ffmpeg', '-hide_banner', '-nostdin', '-i', str(path), '-af',
                'loudnorm=I=-14:TP=-1.8:LRA=9:print_format=json', '-f', 'null', '-'])
    found = re.findall(r'\{\s*"input_i".*?\}', proc.stderr, re.S)
    if not found:
        raise RuntimeError('FFmpeg did not report loudness statistics')
    return json.loads(found[-1])


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output', type=Path, default=ROOT / 'public' / 'audio')
    args = parser.parse_args()
    out = args.output.resolve()
    out.mkdir(parents=True, exist_ok=True)
    music()
    raw = mix()
    raw_path = out / '.soundtrack-unmastered.wav'
    wavfile.write(raw_path, SR, raw)
    measure = loudness(raw_path)
    normalizer = ('loudnorm=I=-14:TP=-1.8:LRA=9:linear=true:'
                  f'measured_I={measure["input_i"]}:measured_TP={measure["input_tp"]}:'
                  f'measured_LRA={measure["input_lra"]}:measured_thresh={measure["input_thresh"]}:'
                  f'offset={measure["target_offset"]}:print_format=json')
    wav = out / 'soundtrack.wav'
    run(['ffmpeg', '-hide_banner', '-nostdin', '-y', '-i', str(raw_path), '-af', normalizer +
         ',afade=t=out:st=49.3:d=0.2,volume=0:enable=gte(t\\,49.5)', '-ar', str(SR), '-ac', '2',
         '-c:a', 'pcm_s24le', '-t', str(DURATION), str(wav)])
    aac = out / 'soundtrack.m4a'
    run(['ffmpeg', '-hide_banner', '-nostdin', '-y', '-i', str(wav), '-c:a', 'aac', '-b:a', '128k',
         '-ar', str(SR), '-ac', '2', '-movflags', '+faststart', str(aac)])
    run(['ffmpeg', '-hide_banner', '-nostdin', '-v', 'error', '-xerror', '-i', str(aac), '-f', 'null', '-'])
    aac_probe = json.loads(run(['ffprobe', '-v', 'error', '-show_streams', '-show_format', '-of', 'json', str(aac)]).stdout)
    actual_sr, pcm = wavfile.read(wav)
    decoded = pcm.astype(np.float64) / 2**31
    lufs = loudness(wav)
    peak = float(np.max(np.abs(decoded)))
    # Spectral coverage distinguishes a full arrangement from a sine + percussion loop.
    frequency, density = signal.welch(decoded[round(6.4*SR):round(44.8*SR)].mean(axis=1), SR, nperseg=8192)
    bands = {}
    total = float(np.sum(density))
    for low, high in ((27, 120), (120, 500), (500, 2000), (2000, 8000), (8000, 16000)):
        bands[f'{low}-{high}Hz'] = round(float(np.sum(density[(frequency>=low)&(frequency<high)])) / total, 5)
    metrics = {
        'sample_rate': int(actual_sr), 'samples_per_channel': int(len(pcm)), 'channels': int(pcm.shape[1]),
        'duration': len(pcm) / actual_sr, 'bpm': 150, 'beat_seconds': BEAT, 'seed': '0x534e4943',
        'peak_dbfs': round(20*np.log10(peak), 4),
        'integrated_lufs': float(lufs['input_i']), 'true_peak_dbtp': float(lufs['input_tp']),
        'loudness_range_lu': float(lufs['input_lra']),
        'final_half_second_exact_digital_zero': bool(np.all(pcm[round(49.5*SR):] == 0)),
        'stereo_difference_rms': float(np.sqrt(np.mean((decoded[:,0]-decoded[:,1])**2))),
        'frequency_energy_fractions': bands,
        'sha256': hashlib.sha256(wav.read_bytes()).hexdigest(),
        'aac': {
            'codec': aac_probe['streams'][0]['codec_name'],
            'duration': float(aac_probe['format']['duration']),
            'bytes': aac.stat().st_size,
            'full_decode_without_errors': True,
        },
        'provenance': 'Original deterministic numpy/scipy synthesis; no downloaded or sampled audio.',
        'physical_audition': 'Not performed; numerical and FFmpeg checks only.',
        'events': sorted(EVENTS, key=lambda event: event['t']),
    }
    (out / 'audio-validation.json').write_text(json.dumps(metrics, ensure_ascii=False, indent=2) + '\n')
    raw_path.unlink()
    summary = {k:v for k,v in metrics.items() if k != 'events'}
    print(json.dumps(summary, ensure_ascii=False, indent=2))
    assert len(pcm) == N and pcm.shape[1] == 2 and actual_sr == SR
    assert metrics['true_peak_dbtp'] <= -1.5
    assert -15.2 <= metrics['integrated_lufs'] <= -13.0
    assert metrics['final_half_second_exact_digital_zero']


if __name__ == '__main__':
    main()
