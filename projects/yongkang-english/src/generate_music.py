#!/usr/bin/env python3
# SPDX-License-Identifier: MIT
"""Original, deterministic, understated music; no samples or external assets.

Output is intended as a quiet narration bed, not a foreground soundtrack.
Python 3 + NumPy + SciPy. See docs/MUSIC.md for the license and mix notes.
"""
from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path
import wave

import numpy as np
from scipy.signal import butter, sosfilt

SR = 48_000
BPM = 82.0
SEED = 20261022


def hz(midi: float) -> float:
    return 440.0 * 2.0 ** ((midi - 69.0) / 12.0)


def add_stereo(target: np.ndarray, signal: np.ndarray, at: float, pan: float = 0.0) -> None:
    start = int(round(at * SR))
    if start >= len(target):
        return
    signal = signal[max(0, -start):]
    start = max(0, start)
    length = min(len(signal), len(target) - start)
    if length <= 0:
        return
    pan = float(np.clip(pan, -1, 1))
    gains = np.array([np.cos((pan + 1) * np.pi / 4), np.sin((pan + 1) * np.pi / 4)], dtype=np.float32)
    target[start:start + length] += signal[:length, None] * gains[None, :]


def soft_key(midi: int, length: float, rng: np.random.Generator) -> np.ndarray:
    """A softly struck, inharmonic key with a rounded transient and long decay."""
    t = np.arange(int(length * SR), dtype=np.float32) / SR
    fundamental = hz(midi)
    result = np.zeros_like(t)
    partials = ((1.0, 1.0, 2.2), (2.002, .23, 1.15), (3.009, .075, .75), (4.018, .025, .45))
    for ratio, gain, decay in partials:
        phase = rng.uniform(-.02, .02)
        result += gain * np.sin(2 * np.pi * fundamental * ratio * t + phase) * np.exp(-t / decay)
    # Slightly slower attack than an acoustic piano: no hard digital click.
    envelope = (1 - np.exp(-t / .014)) * np.minimum(1.0, np.maximum(0.0, (length - t) / .24))
    result *= envelope
    return result.astype(np.float32)


def warm_pad(midi: int, length: float, rng: np.random.Generator) -> np.ndarray:
    t = np.arange(int(length * SR), dtype=np.float32) / SR
    frequency = hz(midi)
    result = np.zeros_like(t)
    for detune, amount in ((-.0035, .24), (0, .52), (.0030, .24)):
        phase = rng.uniform(0, 2 * np.pi)
        result += amount * np.sin(2 * np.pi * frequency * (1 + detune) * t + phase)
        result += .045 * np.sin(2 * np.pi * frequency * 2 * (1 + detune) * t + phase * .7)
    attack = np.sin(np.minimum(t / 1.05, 1) * np.pi / 2) ** 2
    release = np.sin(np.minimum(np.maximum((length - t) / 1.6, 0), 1) * np.pi / 2) ** 2
    drift = .96 + .04 * np.sin(2 * np.pi * .075 * t + rng.uniform(0, 6))
    return (result * attack * release * drift).astype(np.float32)


def low_note(midi: int, length: float) -> np.ndarray:
    t = np.arange(int(length * SR), dtype=np.float32) / SR
    fundamental = hz(midi)
    result = np.sin(2 * np.pi * fundamental * t) + .12 * np.sin(2 * np.pi * 2 * fundamental * t)
    envelope = (1 - np.exp(-t / .055)) * np.exp(-t / 1.3)
    envelope *= np.minimum(1.0, np.maximum((length - t) / .2, 0))
    return (result * envelope).astype(np.float32)


def brush(length: float, rng: np.random.Generator) -> np.ndarray:
    n = int(length * SR)
    t = np.arange(n, dtype=np.float32) / SR
    noise = rng.standard_normal(n).astype(np.float32)
    # Airy, short brush, with neither a sharp click nor a bright shaker hiss.
    noise = sosfilt(butter(2, [1400, 3600], btype='bandpass', fs=SR, output='sos'), noise).astype(np.float32)
    return noise * np.sin(np.minimum(t / .012, 1) * np.pi / 2) ** 2 * np.exp(-t / .035)


def compose(duration: float, output: Path) -> dict:
    rng = np.random.default_rng(SEED)
    audio = np.zeros((int(round(duration * SR)), 2), dtype=np.float32)
    beat = 60 / BPM
    bar = 4 * beat
    # Original voicings and event sequence. Chord names describe harmony only.
    progression = (
        ('D6/9', 38, [57, 62, 64, 66, 71]),
        ('Bm7', 35, [57, 59, 62, 66, 69]),
        ('Gmaj7', 43, [55, 59, 62, 66, 69]),
        ('Aadd9', 45, [57, 59, 61, 64, 69]),
        ('Em7/9', 40, [55, 59, 62, 66, 69]),
        ('Gmaj7', 43, [55, 59, 62, 66, 71]),
        ('Dmaj7/F#', 42, [57, 61, 62, 66, 69]),
        ('Asus2', 45, [57, 59, 64, 69, 71]),
    )
    # Two bars per chord, sparse upper figure, with silences between phrases.
    step = 2 * bar
    chord_count = int(np.ceil((duration + step) / step))
    for section in range(chord_count):
        _, bass, chord = progression[section % len(progression)]
        start = section * step
        if start >= duration:
            break
        for index, note in enumerate(chord[:4]):
            pad = warm_pad(note - 12, step + 1.9, rng)
            add_stereo(audio, pad * .013, start - .65, -.52 + index * .34)
        # Rounded low end never behaves like an impact or a dance kick.
        add_stereo(audio, low_note(bass, 3.8) * .030, start + .02)
        add_stereo(audio, low_note(bass, 3.5) * .022, start + bar + .025)
        # Uneven phrase density avoids a rigid repeated up/down arpeggio.
        pattern = ((.0, 1), (1.5, 3), (2.5, 2), (4.0, 0), (5.0, 2), (6.5, 4))
        if section % 4 == 3:
            pattern = ((0.0, 1), (2.5, 2), (4.0, 0), (6.0, 3))
        for event, (beat_offset, index) in enumerate(pattern):
            when = start + beat_offset * beat + rng.uniform(-.010, .010)
            note = chord[index] + (12 if (section + event) % 5 == 0 else 0)
            velocity = .055 + rng.uniform(-.008, .006)
            if section == 0:
                velocity *= .8
            key = soft_key(note, 4.2, rng) * velocity
            pan = (-.27, .22, -.12, .3, -.23, .14)[event % 6]
            add_stereo(audio, key, when, pan)
            # Damped stereo echo gives space without an obvious delay effect.
            add_stereo(audio, key * .15, when + .31, -pan)
            add_stereo(audio, key * .055, when + .63, pan * .5)
        # Very quiet brush on a few weak beats; the narration remains the rhythm.
        if section > 1:
            for offset in (1.0, 3.0, 5.0, 7.0):
                add_stereo(audio, brush(.22, rng) * .008, start + offset * beat, rng.uniform(-.3, .3))
    # A dark, smooth top end is deliberate for intelligible English speech.
    audio = sosfilt(butter(2, 3600, fs=SR, output='sos'), audio, axis=0).astype(np.float32)
    audio = sosfilt(butter(2, 38, btype='highpass', fs=SR, output='sos'), audio, axis=0).astype(np.float32)
    t = np.arange(len(audio), dtype=np.float32) / SR
    fade_in = np.sin(np.minimum(t / 4.5, 1) * np.pi / 2) ** 2
    fade_out = np.sin(np.minimum(np.maximum((duration - t) / 7.0, 0), 1) * np.pi / 2) ** 2
    audio *= (fade_in * fade_out)[:, None]
    peak_before = float(np.max(np.abs(audio)))
    # Stable ceiling; never increase a quiet score simply to fill the waveform.
    if peak_before > .29:
        audio *= .29 / peak_before
    pcm = np.rint(np.clip(audio, -.999, .999) * 32767).astype('<i2')
    output.parent.mkdir(parents=True, exist_ok=True)
    with wave.open(str(output), 'wb') as wav:
        wav.setnchannels(2)
        wav.setsampwidth(2)
        wav.setframerate(SR)
        wav.writeframes(pcm.tobytes())
    return {
        'file': str(output.name), 'duration_seconds': duration, 'sample_rate': SR,
        'channels': 2, 'sample_format': 'signed 16-bit PCM', 'bpm': BPM, 'seed': SEED,
        'peak': float(np.max(np.abs(audio))),
        'rms': float(np.sqrt(np.mean(audio ** 2))),
        'clipped_samples': int(np.count_nonzero(np.abs(audio) >= 1)),
        'sha256': hashlib.sha256(output.read_bytes()).hexdigest(),
        'license': 'CC BY-SA 4.0',
        'external_audio_or_samples': False,
    }


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--duration', type=float, default=140.0)
    parser.add_argument('--output', type=Path, default=Path(__file__).resolve().parents[1] / 'assets/audio/music-original.wav')
    args = parser.parse_args()
    if not 10 <= args.duration <= 600:
        parser.error('duration must be between 10 and 600 seconds')
    report = compose(args.duration, args.output)
    args.output.with_suffix('.json').write_text(json.dumps(report, indent=2) + '\n')
    print(json.dumps(report, indent=2))


if __name__ == '__main__':
    main()
