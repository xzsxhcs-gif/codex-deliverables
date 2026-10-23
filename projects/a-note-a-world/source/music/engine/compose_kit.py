# 【免费分享声明】
# 创作者：reaesteve
# 本项目（技能说明、作曲引擎代码、示例曲与项目文档）由创作者 reaesteve 免费分享，仅供个人学习与非商业使用。
# 禁止以任何名义出售、转售或打包售卖本项目，禁止通过付费下载、付费会员、付费课程、付费社群、
# “打赏/关注后获取”、引流收费等任何形式收取费用或设置付费门槛。
# 可以免费转发与修改，但必须注明出处、保留本声明，并以相同许可免费分享。
# 用本技能创作的音乐归创作者本人所有；以上限制针对的是本项目本身。
# 许可：知识共享 署名-非商业性使用-相同方式共享 4.0 国际（CC BY-NC-SA 4.0）
# https://creativecommons.org/licenses/by-nc-sa/4.0/deed.zh-hans
# 第三方组件（GeneralUser GS 音色库、TinySoundFont）沿用其各自的原始许可。
# 如果你是付费获得本项目的，请注意：它本来就是免费的。
#
# [Free-sharing notice]
# This project (skill guide, composition engine code, example song and project documents) is shared by its creator, reaesteve, free of
# charge for personal, non-commercial use. Selling, reselling or bundling it for sale is prohibited, as is
# charging for access in any form or under any pretext: paid downloads, memberships, courses, paid groups,
# "tip/follow to unlock", or lead-generation paywalls. You may share and adapt it for free, with credit,
# keeping this notice, under the same licence. Music you create with it belongs to you; these limits apply
# to the project itself.
# Licence: Creative Commons Attribution-NonCommercial-ShareAlike 4.0 (CC BY-NC-SA 4.0)
# https://creativecommons.org/licenses/by-nc-sa/4.0/
# Third-party components (GeneralUser GS SoundFont, TinySoundFont) keep their own original licences.
# If you paid for this project, you were charged for something that is free.

"""
compose_kit — write music as code, render it with a SoundFont.

A song script imports this module, declares channels (instruments), a tempo map,
then writes notes with the helpers below and finally calls export().

export() writes, into the current folder:
  events_chNN.txt   one timed event list per channel, for the renderer (render.c)
  mix.json          channel names and mix settings, for mix_kit.py
  notes.json        every note with start/end seconds, bar and beat times (for visuals)
  song.mid          a Standard MIDI file with the tempo map
"""
import json, random, struct, itertools, math

SHORT_NOTICE = '免费分享 · 禁止售卖 · 禁止以任何名义收费（CC BY-NC-SA 4.0，创作者 reaesteve） | Shared free · Not for sale · No paid access of any kind (CC BY-NC-SA 4.0, creator: reaesteve)'

# ---------------------------------------------------------------- pitch
_NOTE = {'C': 0, 'D': 2, 'E': 4, 'F': 5, 'G': 7, 'A': 9, 'B': 11}


def p(name):
    """'C#5' -> MIDI number (C4 = 60)."""
    n, i = _NOTE[name[0]], 1
    while i < len(name) and name[i] in '#b':
        n += 1 if name[i] == '#' else -1
        i += 1
    return n + 12 * (int(name[i:]) + 1)


CHORD_Q = {'': [0, 4, 7], 'm': [0, 3, 7], '7': [0, 4, 7, 10], 'maj7': [0, 4, 7, 11], 'm7': [0, 3, 7, 10],
           'sus2': [0, 2, 7], 'sus4': [0, 5, 7], 'add9': [0, 4, 7, 14], 'm9': [0, 3, 7, 10, 14], 'dim': [0, 3, 6]}


def chord_pcs(sym):
    """'Am7/G' -> (bass pitch class, root pc, list of pcs)."""
    main, _, bass = sym.partition('/')
    i = 2 if len(main) > 1 and main[1] in '#b' else 1
    root = (_NOTE[main[0]] + (1 if main[1:2] == '#' else -1 if main[1:2] == 'b' else 0)) % 12
    pcs = [(root + iv) % 12 for iv in CHORD_Q[main[i:]]]
    bpc = root if not bass else (_NOTE[bass[0]] + (1 if bass[1:2] == '#' else -1 if bass[1:2] == 'b' else 0)) % 12
    return bpc, root, pcs


# ---------------------------------------------------------------- song state
CHANNELS = {}      # ch -> dict(name, program, bank, gain, pan, reverb, hpf, haas)
TEMPO = [(0, 1e9, 100, 100)]
INTRO = 0.0        # seconds of silence before beat 0
TAIL = 4.0         # seconds after the last beat
NOTES, CC = [], []
SEED = 1
_rng = random.Random(SEED)


def channel(ch, name, program, bank=0, gain=1.0, pan=0.0, reverb=0.25, hpf=0, haas=0):
    """Declare an instrument. program = General MIDI number (0-based). ch 9 is the drum channel (program = kit)."""
    CHANNELS[ch] = dict(name=name, program=program, bank=bank, gain=gain, pan=pan, reverb=reverb, hpf=hpf, haas=haas)


def tempo(segments, intro=0.0, tail=4.0, seed=1):
    """segments: list of (start_beat, end_beat, bpm_start, bpm_end); linear ramps, beats outside hold the last bpm."""
    global TEMPO, INTRO, TAIL, _rng
    TEMPO, INTRO, TAIL, _rng = sorted(segments), intro, tail, random.Random(seed)


def bpm_at(b):
    for b0, b1, v0, v1 in TEMPO:
        if b0 <= b < b1:
            return v0 + (v1 - v0) * (b - b0) / (b1 - b0)
    last = [s for s in TEMPO if s[0] <= b]
    return last[-1][3] if last else TEMPO[0][2]


def beat2sec(b, step=1 / 64):
    """Integrate linear BPM ramps exactly; step remains for API compatibility."""
    if not math.isfinite(b):
        raise ValueError('Beat position must be finite')
    lo, hi = min(0.0, b), max(0.0, b)
    edges = sorted({lo, hi} | {x for seg in TEMPO for x in seg[:2] if lo < x < hi})
    elapsed = 0.0
    for start, end in zip(edges, edges[1:]):
        midpoint = (start + end) / 2
        active = next((seg for seg in TEMPO if seg[0] <= midpoint < seg[1]), None)
        if active is None:
            rate, slope = bpm_at(midpoint), 0.0
        else:
            b0, b1, v0, v1 = active
            slope = (v1 - v0) / (b1 - b0)
            rate = v0 + slope * (start - b0)
        if rate <= 0 or rate + slope * (end - start) <= 0:
            raise ValueError('Tempo must remain strictly positive')
        if abs(slope) < 1e-12:
            elapsed += 60.0 * (end - start) / rate
        else:
            elapsed += 60.0 / slope * math.log1p(slope * (end - start) / rate)
    return INTRO + (elapsed if b >= 0 else -elapsed)


def bar(n, beats_per_bar=4):
    return beats_per_bar * (n - 1)


# ---------------------------------------------------------------- writing notes
def note(ch, pitch, b0, dur, vel, hum=0.01, tag=None):
    """One note. pitch: MIDI number or name; b0/dur in beats; hum = random timing spread in beats (seeded)."""
    if isinstance(pitch, str):
        pitch = p(pitch)
    NOTES.append(dict(ch=ch, pitch=pitch, b0=b0 + _rng.uniform(-hum, hum), b1=b0 + dur,
                      vel=max(1, min(127, int(vel + _rng.uniform(-4, 4)))), tag=tag))


def melody(ch, start_beat, items, vel=80, legato=0.06, tag=None):
    """items: list of (pitch name or None for a rest, beats). Accents the downbeat; slightly overlaps notes."""
    b = start_beat
    for i, (nm, d) in enumerate(items):
        if nm is not None:
            nxt = items[i + 1][0] if i + 1 < len(items) else None
            v = vel + (6 if b % 4 == 0 else 3 if b % 4 == 2 else 0)
            note(ch, nm, b, d + (legato if nxt else 0), v, tag=tag)
        b += d
    return b


_prev = [None]


def voicing(sym, lo=55, hi=76, n=4):
    """Close, smoothly voice-led chord tones for sym within [lo, hi]."""
    bpc, root, pcs = chord_pcs(sym)
    use = list(dict.fromkeys(pcs))
    if len(use) > n and (root + 7) % 12 in use:
        use.remove((root + 7) % 12)
    best, cost = None, 1e9
    for extra in [root] + [pc for pc in pcs if pc != root]:      # which tone to double when n > chord size
        cand = (use + [extra] * n)[:n]
        for combo in itertools.product(*[[m for m in range(lo, hi + 1) if m % 12 == pc] for pc in cand]):
            v = sorted(combo)
            if len(set(v)) < n or v[-1] - v[0] > 16:
                continue
            c = sum(abs(a - b) for a, b in zip(v, _prev[0])) if _prev[0] else v[-1] - v[0]
            c += 9 * sum(1 for a in v for b in v if b - a in (1, 13))
            if c < cost:
                best, cost = v, c
        if best:
            break
    if best is None:                                              # range too narrow: fewer voices
        return voicing(sym, lo, hi, n - 1) if n > 1 else [next(m for m in range(lo, hi + 13) if m % 12 == root)]
    _prev[0] = best
    return best


def chords(ch, start_beat, progression, vel=60, lo=55, hi=76, n=4, style='block'):
    """progression: list of (symbol, beats). style: 'block' (held) or 'arp' (eighth-note arpeggio)."""
    b = start_beat
    for sym, d in progression:
        tones = voicing(sym, lo, hi, n)
        if style == 'arp':
            k = 0
            while k < d * 2:
                note(ch, tones[[0, 1, 2, 3, 2, 1][k % 6] % len(tones)], b + k / 2, 0.7, vel - (0 if k % 2 == 0 else 8))
                k += 1
        else:
            for m in tones:
                note(ch, m, b, d + 0.05, vel, hum=0)
        b += d
    return b


def bass(ch, start_beat, progression, vel=72, lo=36, hi=50, pattern=None):
    """Root (or slash bass) of each chord. pattern: list of (offset beats, length) per chord, default one held note."""
    b = start_beat
    for sym, d in progression:
        bpc = chord_pcs(sym)[0]
        m = next(x for x in range(lo, hi + 1) if x % 12 == bpc)
        for off, ln in (pattern or [(0, d)]):
            if off < d:
                note(ch, m, b + off, min(ln, d - off), vel, hum=0)
        b += d
    return b


DRUM = dict(kick=36, snare=38, rim=37, clap=39, hat=42, ohat=46, ride=51, crash=49, tom_lo=45, tom_hi=50)


def drums(start_beat, bars_, pattern, vel=90):
    """pattern: dict name -> 16-step string per bar, e.g. {'kick': 'x...x...x...x...'}; 'X' = accent."""
    for k in range(bars_):
        for name, steps in pattern.items():
            for i, c in enumerate(steps):
                if c in 'xX':
                    note(9, DRUM[name], start_beat + 4 * k + i / 4, 0.25, vel + (12 if c == 'X' else 0), hum=0.004)


def expression(ch, b0, b1, v0, v1, step=0.25):
    """CC11 swell from v0 to v1 between beats b0 and b1."""
    n = max(1, int((b1 - b0) / step))
    for i in range(n + 1):
        CC.append((b0 + i * (b1 - b0) / n, ch, 11, int(v0 + (v1 - v0) * i / n)))


# ---------------------------------------------------------------- export
def export(end_beat):
    total = beat2sec(end_beat) + TAIL
    ev = []
    for ch, c in CHANNELS.items():
        ev += [(0.0, 'P', ch, c['bank'], c['program']), (0.0, 'C', ch, 7, 110), (0.0, 'C', ch, 11, 100), (0.0, 'C', ch, 10, 64)]
    for n in NOTES:
        t0, t1 = max(0.0, beat2sec(max(0, n['b0']))), beat2sec(n['b1'])
        n['t0'], n['t1'] = round(t0, 5), round(t1, 5)
        ev += [(t0, 'N', n['ch'], n['pitch'], n['vel']), (t1, 'O', n['ch'], n['pitch'], 0)]
    for b, ch, c, v in CC:
        ev.append((beat2sec(b) - 0.001, 'C', ch, c, v))
    ev.sort(key=lambda e: (e[0], 0 if e[1] in 'PC' else 1 if e[1] == 'O' else 2))
    for ch in CHANNELS:
        with open(f'events_ch{ch:02d}.txt', 'w') as f:
            for e in ev:
                if e[2] == ch:
                    f.write('%.5f %s %d %d %d\n' % e)
    json.dump(dict(total=total, channels={str(k): v for k, v in CHANNELS.items()}), open('mix.json', 'w'), indent=1)
    json.dump(dict(total=total, bars=[round(beat2sec(b), 4) for b in range(0, int(end_beat) + 1, 4)],
                   beats=[round(beat2sec(b), 4) for b in range(int(end_beat) + 1)],
                   notes=[dict(ch=n['ch'], p=n['pitch'], t0=n['t0'], t1=n['t1'], v=n['vel'], tag=n['tag']) for n in NOTES]),
              open('notes.json', 'w'), separators=(',', ':'))
    _midi(end_beat)
    print(SHORT_NOTICE)
    print(f'{len(NOTES)} notes, {len(CHANNELS)} channels, {total:.2f} s')
    return total


def _midi(end_beat, tpq=480, key_signature=None, time_signature=(4, 4)):
    """SMF mirrors event timing, silence, expression and orchestral positioning.

    Tempo values are interval averages of the exact tempo integral. Keeping the
    ramp intervals below 1/64 beat avoids the original left-sampled MIDI drift.
    key_signature, when supplied, is (sharps_or_flats, minor): D major = (2, 0).
    Track ends retain the WAV's release window without adding artificial notes.
    """
    def vlq(x):
        if x < 0:
            raise ValueError('MIDI delta times must be non-negative')
        out = [x & 0x7F]
        x >>= 7
        while x:
            out.insert(0, (x & 0x7F) | 0x80)
            x >>= 7
        return bytes(out)

    def meta(kind, payload):
        return bytes([0xFF, kind]) + vlq(len(payload)) + payload

    def track(events, end_tick):
        events.sort(key=lambda e: (e[0], e[1]))
        data, last = bytearray(), 0
        for tick, priority, msg in events:
            data.extend(vlq(tick - last) + msg)
            last = tick
        data.extend(vlq(max(last, end_tick) - last) + b'\xff\x2f\x00')
        return b'MTrk' + struct.pack('>I', len(data)) + bytes(data)

    if tpq <= 0 or tpq > 32767 or INTRO < 0:
        raise ValueError('MIDI requires positive PPQ and a non-negative intro')
    initial_us = round(60_000_000 / bpm_at(0))
    offset = round(INTRO * 1_000_000 * tpq / initial_us)
    tk = lambda b: offset + round(max(0.0, b) * tpq)
    last_beat = max([end_beat] + [n['b1'] for n in NOTES] + [e[0] for e in CC])
    end_tick = tk(last_beat)
    music_ticks = max(0, end_tick - offset)
    numerator, denominator = time_signature
    if denominator <= 0 or denominator & (denominator - 1):
        raise ValueError('MIDI time-signature denominator must be a power of two')
    tempo_ev = [(0, 0, meta(3, b'Tempo and form')),
                (0, 0, meta(0x58, bytes([numerator, denominator.bit_length() - 1, 24, 8]))),
                (0, 1, meta(0x51, initial_us.to_bytes(3, 'big')))]
    if key_signature is not None:
        sharps, minor = key_signature
        if not -7 <= sharps <= 7 or minor not in (0, 1):
            raise ValueError('Invalid MIDI key signature')
        tempo_ev.append((0, 0, meta(0x59, bytes([sharps & 255, minor]))))
    boundaries = {0, music_ticks}
    boundaries.update(round(i * tpq / 64) for i in range(math.ceil(last_beat * 64) + 1)
                      if round(i * tpq / 64) <= music_ticks)
    boundaries.update(round(x * tpq) for seg in TEMPO for x in seg[:2]
                      if 0 <= x <= last_beat)
    previous_us = initial_us
    points = sorted(boundaries)
    for start, end in zip(points, points[1:]):
        seconds = beat2sec(end / tpq) - beat2sec(start / tpq)
        us = round(seconds * 1_000_000 * tpq / (end - start))
        if not 1 <= us <= 0xFFFFFF:
            raise ValueError('Tempo is outside Standard MIDI File range')
        if us != previous_us:
            tempo_ev.append((offset + start, 1, meta(0x51, us.to_bytes(3, 'big'))))
            previous_us = us
    tail_seconds = max(0.0, beat2sec(end_beat) + TAIL - beat2sec(last_beat))
    end_tick += round(tail_seconds * 1_000_000 * tpq / previous_us)
    tracks = [track(tempo_ev, end_tick)]
    for ch, c in CHANNELS.items():
        if not 0 <= ch <= 15 or not 0 <= c['bank'] <= 16383:
            raise ValueError('Invalid MIDI channel or bank')
        pan = max(0, min(127, round(64 + 63 * c['pan'])))
        # TinySoundFont's controller gain is cubic; approximate the mixer trim.
        volume = max(0, min(127, round(110 * max(0.0, c['gain']) ** (1 / 3))))
        controller = lambda number, value: bytes([0xB0 | ch, number, value])
        ev = [(0, 0, meta(3, c['name'].encode('utf-8'))),
              (0, 1, controller(0, c['bank'] >> 7)),
              (0, 1, controller(32, c['bank'] & 127)),
              (0, 2, bytes([0xC0 | ch, c['program'] & 0x7F])),
              (0, 3, controller(7, volume)),
              (0, 3, controller(11, 100)),
              (0, 3, controller(10, pan))]
        for b, cc_ch, number, value in CC:
            if cc_ch == ch:
                ev.append((tk(b), 4, controller(number, value)))
        for n in NOTES:
            if n['ch'] == ch:
                ev.append((tk(n['b0']), 6, bytes([0x90 | ch, n['pitch'], n['vel']])))
                ev.append((tk(n['b1']), 5, bytes([0x80 | ch, n['pitch'], 0])))
        tracks.append(track(ev, end_tick))
    with open('song.mid', 'wb') as f:
        f.write(b'MThd' + struct.pack('>IHHH', 6, 1, len(tracks), tpq) + b''.join(tracks))
