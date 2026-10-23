# Upstream engine audit and local corrections

Upstream: https://github.com/maxtinnate/AI_MUSIC_CREATOR  
Pinned commit: `9604264dc134df72eda7e8b51eb2b8341b783635`

The original checkout under `/workspace/references/AI_MUSIC_CREATOR` was left unchanged. All corrections are in this independent production copy. The original creator's bilingual notices and licence statements remain intact. The engine is by **reaesteve**, shared under **CC BY-NC-SA 4.0**; its free-sharing restrictions apply to the engine and related project materials. Its notice states that music created with it belongs to its creator. TinySoundFont retains its MIT licence. GeneralUser GS retains its own SoundFont licence, which explicitly permits musical recordings.

## Files reviewed

The complete contents of `compose_kit.py`, `mix_kit.py`, `render.c`, `build.sh`, `build.bat`, and all 2,079 lines of `tsf.h` were read. The production lead also reviewed the complete README, SKILL, composition example and licensing documents before using the engine. No downloaded installation script was run. The production uses the existing Python/C toolchain and the repository's own SoundFont.

## Corrected in this copy of compose_kit.py

1. The original Standard MIDI File header omitted the mandatory four-byte header-length field. The exported file now has the required `MThd`, length `6`, format, track count and PPQ fields.
2. The original MIDI export discarded the initial silence, bank selection, channel names, expression automation and pan settings. The corrected file includes those items, initial CC7 volume, CC11 expression, CC10 pan, time signature and optional key signature. D major can be written with `_midi(end_beat, key_signature=(2, 0))` after the ordinary export call.
3. The original MIDI tempo ramps sampled only the left edge of each quarter-beat interval and did not reproduce the audio timeline closely. Beat-to-second conversion now integrates each linear BPM ramp analytically. MIDI tempo intervals are approximately 1/64 beat long and store the average microseconds per quarter over each exact interval. Constant tempo values are deduplicated.
4. MIDI note-offs precede retriggers at the same tick. Explicit end-of-track events preserve the musical duration and the configured release window, without adding artificial notes. Initial CC7 also approximates the post-mix instrument gain using TinySoundFont's cubic controller curve; it cannot reproduce the final mixer's spatial or dynamic processing exactly.

`python -m unittest discover -s tests -v` checks the analytic integral against a separately written expression and parses emitted MIDI bytes independently. The fixture includes 513 notes, tempo acceleration and deceleration, initial silence, bank/pan metadata and 449 expression-controller events. Across **1,026 note boundaries**, maximum difference between MIDI and the exact audio timeline is **0.913 ms**, within the expected 480-PPQ quantisation. The tests also check the SMF header, key signature and track duration.

## Rendering and mixing considerations

In this production copy, `render.c` also checks input/output opens and preset selection, returns an error instead of silently using a wrong timbre, closes the synth and event buffer, and writes only the requested number of frames in the last block. The known-input allocation design otherwise remains upstream's minimal implementation. `mix_kit.py` adds an actual metrics JSON report, a gentler loudness target, lower hall send and a −1 dBFS sample-peak ceiling. All Haas values are zero in this score. `score.py` checks the SoundFont SHA-256 before any synthesis and orchestrates the existing components rather than using upstream's cleanup/install scripts.

- `build.bat` uses the wrong substring offset when deriving `ch00` from `events_ch00.txt`; this can produce incorrectly named Windows stems. The production's Python build wrapper should replace the batch-script workflow rather than modify the original checkout. The shell/batch scripts also install dependencies and remove local generated files; they were reviewed rather than executed blindly.
- TinySoundFont supports note release, sustain CC64, CC7, CC10 and CC11. Its volume controllers have a cubic response, so very low expression values can make a part effectively inaudible. CC1 vibrato and SoundFont modulator routing are not implemented. Reverb is provided by the repository mixer rather than SF2 effect sends.
- A failed bank/program selection in the minimal original renderer can silently retain the preceding preset. The production must check that requested presets exist and verify the resulting instrument stems.
- The original renderer processes 64-sample blocks: event timing is quantised by at most about 1.33 ms at 48 kHz. Its final block may contain up to 63 excess samples; the mixer trims to the requested duration. No claim of sample-exact MIDI-versus-audio rendering is made.
- The original C command-line wrapper needs stronger checks for missing input/output files and allocation failures. TinySoundFont is a compact local SF2 parser, not a hardened parser for hostile files. Use only the repository's reconstructed, checksum-verified SoundFont.
- The mixer applies gain/pan, generated hall reverb, bus dynamics and peak limiting. A different MIDI player will reproduce notes and controllers but will use its own synth/effects; it cannot duplicate this mastered WAV exactly.
- Haas widening first reduces an instrument to mono and delays one side. It should be disabled for this orchestral production to preserve the SoundFont's stereo information and avoid unnecessary mono-compatibility problems.
- The limiter constrains sample peaks but is not an oversampled true-peak limiter. Allow output headroom and inspect numerical peak, intersample peak estimate and limiting, rather than relying only on the final hard clip.
- `voicing()` shares its previous chord across channels; the score avoids this ambiguity by supplying deliberate per-instrument voicings. Seeded note humanisation alters start times and velocities, but not note ends; the score validates positive durations and instrument ranges.

## Security scope

The reviewed synthesis, composition and mix source performs local file access and numeric DSP; it contains no network exfiltration, credential access or hidden process execution. The build scripts contain ordinary dependency installation, compilation and generated-file cleanup, which are not needed for the reviewed Python-controlled workflow. This is a focused source review for the pinned repository and known SoundFont, not a general security certification of arbitrary third-party SF2 files.
