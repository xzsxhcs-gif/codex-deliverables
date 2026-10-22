# English TTS and public video skills audit

Audit date: 2026-10-22. This is a source-and-license review, not an installation record. No new program, package installer, downloaded shell script, paid API, or cloud generation service was executed during this review.

## Recommended free local speech route

Use **Piper 1.8.0** from the Open Home Foundation, with the **en_US-ljspeech-high** ONNX voice. Piper runs locally through ONNX Runtime, includes its espeak-ng phonemizer, and needs no GPU or account. Its minimal published Python dependencies are `onnxruntime>=1,<2` and `pathvalidate>=3,<4`; the training, HTTP server, and other-language extras are unnecessary here. CPU timing and listening quality still need an actual short pilot; no speed or naturalness result is claimed from documentation alone.

Authoritative sources inspected:

- [Official Piper project](https://github.com/OHF-Voice/piper1-gpl)
- [Official release v1.8.0](https://github.com/OHF-Voice/piper1-gpl/releases/tag/v1.8.0)
- [Pinned package metadata and dependency declarations](https://github.com/OHF-Voice/piper1-gpl/blob/v1.8.0/setup.py)
- [Official command-line documentation](https://github.com/OHF-Voice/piper1-gpl/blob/main/docs/CLI.md)
- [LJSpeech voice model card](https://huggingface.co/rhasspy/piper-voices/blob/main/en/en_US/ljspeech/high/MODEL_CARD)
- [LJ Speech dataset owner’s license statement](https://keithito.com/LJ-Speech-Dataset/)

The engine is GPL-3.0-or-later. The voice repository is marked MIT, and this voice’s model card identifies its source dataset as public domain; the dataset owner separately confirms that its text, audio and annotations are public domain. Keep both the model card and the project license references in the credits record. Do not bundle the Piper engine binary into the project ZIP merely because the final movie is being distributed.

### Pinned Linux package

For the current Linux x86_64 / Python 3.12 environment, the official release provides an ABI3 wheel compatible with Python 3.9 and later:

```text
https://github.com/OHF-Voice/piper1-gpl/releases/download/v1.8.0/piper_tts-1.8.0-cp39-abi3-manylinux_2_17_x86_64.manylinux2014_x86_64.manylinux_2_28_x86_64.whl
SHA256: 25b4d3f31ff70c8fa7151908e00aaa5650cbdf16bca8fcf21299f3941b89a7d3
Release size: 34131442 bytes
```

The SHA-256 and size above were read from the official GitHub release asset record. Before executing Piper, download the wheel as data, verify the hash, inspect its ZIP file list, `.pth` files and Python entry points, and install in an isolated project environment. Obtain CPU-only dependency wheels from their official PyPI distributions with exact versions and hashes; use wheel-only installation to avoid unreviewed build hooks. Inspect dependency metadata before installation, and record the actual resolved dependency lock separately. No system-wide or elevated installation is needed.

### Pinned voice files

Voice revision: `bae641dcb5a608cff81ccaf7ff018baaca1a33e1` (the upstream commit introducing the voice).

Download base:

```text
https://huggingface.co/rhasspy/piper-voices/resolve/bae641dcb5a608cff81ccaf7ff018baaca1a33e1/en/en_US/ljspeech/high/
```

| Filename | SHA-256 | Verification in this audit |
| --- | --- | --- |
| `en_US-ljspeech-high.onnx` | `5d4f08ba6a2a48c44592eed3ce56bf85e9de3dd4e20df90541ae68a8310c029a` | Read from the upstream model’s LFS/Xet metadata; binary not downloaded by this auditor |
| `en_US-ljspeech-high.onnx.json` | `7e1f4634af596d83cca997fb7a931ba80b70f8a316a2655ee69c55365e0ace14` | Pinned file downloaded as data and hashed; 4970 bytes |
| `MODEL_CARD` | `fbdb9c09bd33e73f6876ba48fc2eeea120b9984d07763bfa21b3c8192fd4ba86` | Pinned file downloaded as text and hashed; 515 bytes |

The model file is about 114 MB. The JSON declares 22,050 Hz audio, one speaker, espeak phonemes, and US-English language metadata. Its espeak voice field is `en`. The pinned model card describes medium-quality training even though the filename says `high`; therefore “high” must not be presented as a measured audio-quality guarantee. Listen to a pilot before committing the full soundtrack.

Basic usage after the separate installation review:

```bash
python -m piper -m /path/to/en_US-ljspeech-high.onnx -f narration.wav -- 'Welcome to Yongkang.'
```

For the final production, keep one loaded Python `PiperVoice` instance for all segments rather than repeatedly invoking a new process per sentence. Segment-level synthesis provides exact start/end boundaries for clean subtitles without a second speech-recognition download. Check the names Yongkang, Jinhua, Zhejiang and Fangyan by listening; retain normal spellings in captions while pronunciation overrides, if needed, are confined to the synthesis input. Piper’s documented `[[ phonemes ]]` notation is available for overrides.

### Important rejected shortcut

Do not assume that **Lessac** is cleared simply because the overall voice repository shows MIT. The [Lessac model card](https://huggingface.co/rhasspy/piper-voices/blob/main/en/en_US/lessac/high/MODEL_CARD) explicitly points to a separate Lessac/Blizzard dataset agreement. That agreement was not cleared in this audit. LJSpeech avoids relying on that unresolved agreement.

## Alternative when the pilot is not good enough

**Kokoro 0.9.4 + official Kokoro-82M v1.0** is a plausible quality-focused local alternative. The [official Python project](https://github.com/hexgrad/kokoro) is Apache-2.0 and its [model owner’s card](https://huggingface.co/hexgrad/Kokoro-82M) also identifies Apache-2.0 weights. The model card publishes SHA-256 `496dba118d1a58f5f3db2efc88dbdc216e0483fc89fe6e47ee1f2c53f18ad1e4` for the v1.0 model, and `af_heart` is the owner’s sample voice.

The package requires Python 3.10–3.13 and introduces PyTorch, Transformers, `misaki[en]`, Hugging Face Hub and a phonemizer installation. This is a larger dependency and supply-chain surface than Piper. It can run locally without a paid API, but no measured CPU timing is claimed. If used, inspect the exact official model-loading code, require safe tensor loading, pin voice assets too, and keep inference local. Do not execute a notebook’s `!pip` or `!apt` cells verbatim. The model owner explicitly warns that websites with “kokoro” in their root domain are not affiliated; use the owner’s repository/model files rather than lookalike hosted services.

## Skills inspected, and fit for this film

[Remotion’s own Agent Skills documentation](https://www.remotion.dev/docs/ai/skills) confirms that `remotion-dev/skills` is its official public skill repository. The following complete skill files were read as text, version header 4.0.537:

- [remotion-best-practices](https://github.com/remotion-dev/skills/blob/main/skills/remotion-best-practices/SKILL.md): routes to project creation, animation, maps, captions and rendering.
- [remotion-create](https://github.com/remotion-dev/skills/blob/main/skills/remotion-create/SKILL.md): project setup, previews and multi-scene timelines.
- [remotion-render](https://github.com/remotion-dev/skills/blob/main/skills/remotion-render/SKILL.md): MP4 and still rendering commands.
- [remotion-captions](https://github.com/remotion-dev/skills/blob/main/skills/remotion-captions/SKILL.md): timestamped JSON captions and SRT workflows.
- [remotion-maps](https://github.com/remotion-dev/skills/blob/main/skills/remotion-maps/SKILL.md): geographic explainers; free MapLibre is among the alternatives, while Mapbox requires a key.

These skills are suitable if the project actually uses Remotion. They are not required to render a film made with the environment’s existing Python, Pillow and FFmpeg. For this assignment, retain the smaller existing stack: code-authored maps, typography, pan/zoom and transitions; local neural narration; subtitle files; FFmpeg H.264/AAC output. No `npx skills add`, npm scaffold, external rendering service or browser animation framework needs to be installed just to use a skill. The [Remotion license](https://github.com/remotion-dev/remotion/blob/main/LICENSE.md) allows an individual to use it free, but the tool is unnecessary here.

[FFmpeg’s own license page](https://www.ffmpeg.org/legal.html) was also read. It distinguishes LGPL configurations from optional GPL components; the current installed FFmpeg includes libx264, so preserve the installed-tool license context when documenting reproduction rather than describing every FFmpeg build as identically licensed.

## Cost and safety decision

- Already installed FFmpeg/Python/Pillow: no new service, account or runtime bill.
- New Piper/ONNX dependencies: review exact official files, hash and isolate before execution; no elevated privileges or remote installer shell.
- Narration inference: local CPU; no text uploaded to a hosted voice service.
- Connected AI Voice Generator and Descript: generation was not invoked because their credits, free export limits and billable behavior were not established.
- Plugins and skills: discover/read only; no new plugin installation or permission expansion was performed by this auditor.
- Licenses for photographs, footage, maps and music remain separate checks; a tool’s license does not clear the media fed into it.

The root production agent owns the final choice and installation log. This document records the audited option, not a claim that speech synthesis or the final video has already run.
