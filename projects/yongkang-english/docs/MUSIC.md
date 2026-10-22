# Original procedural music

`assets/audio/music-original.wav` is an original synthetic recording made for the Yongkang English video. No third-party audio, samples, recordings, existing melody, commercial music generator, or paid API was used.

The mood is warm and curious: rounded keyboard notes, soft chord pads, a restrained low voice and occasional quiet brush pulses. The harmonic voicings and sparse event sequence are written in `src/generate_music.py`. Tempo is 82 BPM; the score is intentionally subordinate to narration. It is not an imitation of a named artist or track.

## Rights and attribution

The composition and generated audio are offered under **Creative Commons Attribution–ShareAlike 4.0 International (CC BY-SA 4.0)**: https://creativecommons.org/licenses/by-sa/4.0/

Suggested credit: **Original procedural score — Yongkang English video project (2026), CC BY-SA 4.0.**

The generator source code is offered under the MIT License. NumPy and SciPy are dependencies with their own licenses; they do not supply the musical content.

## Rebuild

The existing project Python environment supplies NumPy and SciPy. No model or sample download is needed.

```bash
python3 src/generate_music.py --duration 140
```

Optional output location:

```bash
python3 src/generate_music.py --duration 128 --output output/music-128.wav
```

All randomness is seeded with `20261022`. The same duration and library versions reproduce the same file. A neighboring `.json` file records sample format, levels, seed, hash and rights.

## Render and mix notes

- 48,000 Hz, two channels, signed 16-bit PCM.
- Default duration: exactly 140 seconds; 4.5-second entrance and 7-second ending fade.
- Peak amplitude: 0.135725 (about −17.35 dBFS); RMS amplitude 0.029129; zero clipped samples.
- WAV SHA-256: `4ed2268007d45b2c5751d2e2ddc6e0729a338855f196edadce39b80912e2305e`.
- The final editor should trim or regenerate to the actual film length and apply an ending fade. Do not truncate the musical ending abruptly.
- Suggested bed loudness under clear spoken English: approximately −30 LUFS, with gentle additional ducking if necessary. Normalize the voice separately; this file is not a finished dialogue mix.
- A waveform check and FFmpeg loudness measurement were performed. This does not substitute for the final film's listening check.

The generated WAV is approximately 26.9 MB and can be recreated from source; it need not be duplicated in every source archive.
