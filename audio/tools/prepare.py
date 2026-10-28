#!/usr/bin/env python3
"""Cut the game's sound takes from the source recordings.

    python3 -I audio/tools/prepare.py <sources dir> audio/tools/recipe.json

<sources dir> is the project's sound-sources library: each recipe `src` is a path inside it.

Each recipe entry names a source file and what to make of it:
  shot   one take from start to end, faded at both ends
  bed    a long take for crossfaded weaving (no loop point needed)
  cuts   explicit [start, end] pairs within the source, each its own take
  slice  cut every onset between start and end into its own take (exhaust beats, joints, bell strokes)
  loop   a sustain cut at matching phase so it can loop seamlessly (whistles, horns); written as WAV,
         since MP3 encoder padding would break the loop
A bed or shot can also be flattened (`flat`: seconds), which evens out a slow swell in level,
such as a locomotive drawing closer, so that random slices of it all sit at one level.
Everything is made mono, filtered as asked, and levelled to a common loudness so the
in-game trims (SND_GAIN) stay small. Needs ffmpeg and numpy.
"""
import json, os, subprocess, sys
import numpy as np

SR = 44100
OUT = os.path.join(os.path.dirname(__file__), '..')


def load(path, start=0, end=None, hp=None, lp=None):
    af = []
    if hp: af.append(f'highpass=f={hp}')
    if lp: af.append(f'lowpass=f={lp}')
    cmd = ['ffmpeg', '-loglevel', 'error', '-ss', str(start)] + (['-to', str(end)] if end else []) + ['-i', path, '-ac', '1', '-ar', str(SR)]
    if af: cmd += ['-af', ','.join(af)]
    raw = subprocess.run(cmd + ['-f', 'f32le', '-'], capture_output=True, check=True).stdout
    return np.frombuffer(raw, dtype=np.float32).copy()


def mavg(v, w):
    """moving average of v over w samples (same length), via a running sum"""
    c = np.concatenate([[0], np.cumsum(v, dtype=np.float64)])
    i = np.arange(len(v)); a = np.clip(i - w // 2, 0, len(v)); b = np.clip(i + w - w // 2, 0, len(v))
    return (c[b] - c[a]) / np.maximum(b - a, 1)


def level(x, db):
    """scale so the loudest 400 ms windows sit at db (RMS), without clipping"""
    w = int(0.4 * SR)
    if len(x) > w:
        r = np.sqrt(mavg(x * x, w))
        ref = np.percentile(r, 90)
    else:
        ref = np.sqrt(np.mean(x * x))
    g = 10 ** (db / 20) / max(ref, 1e-6)
    g = min(g, 0.97 / max(np.abs(x).max(), 1e-6))
    return x * g


def flatten(x, w):
    """divide out the level averaged over w seconds, so a take recorded as its source drew near holds steady"""
    r = np.sqrt(mavg(x * x, int(w * SR)))
    return x * (np.median(r) / np.maximum(r, np.median(r) * 0.05))


def fade(x, a=0.004, b=0.02):
    n, m = int(a * SR), int(b * SR)
    x = x.copy()
    if n: x[:n] *= np.linspace(0, 1, n)
    if m: x[-m:] *= np.linspace(1, 0, m)
    return x


def save(x, name, wav=False):
    path = os.path.join(OUT, name + ('.wav' if wav else '.mp3'))
    codec = ['-c:a', 'pcm_s16le'] if wav else ['-c:a', 'libmp3lame', '-q:a', '3']
    subprocess.run(['ffmpeg', '-loglevel', 'error', '-y', '-f', 'f32le', '-ar', str(SR), '-ac', '1', '-i', '-'] + codec + [path],
                   input=x.astype(np.float32).tobytes(), check=True)
    return os.path.basename(path)


def onsets(x, min_gap=0.08, rise=2.2):
    """sample positions where a short-window envelope jumps well above the one before it"""
    h = int(0.005 * SR)
    env = np.sqrt(mavg(x * x, h))
    slow = mavg(env, int(0.06 * SR))
    out, last = [], -10 * SR
    thr = np.percentile(env, 60)
    for i in range(int(0.06 * SR), len(x), h):
        if env[i] > rise * slow[i - int(0.03 * SR)] and env[i] > thr and i - last > min_gap * SR:
            out.append(max(0, i - 2 * h)); last = i
    return out


def best_loop(x, length):
    """a loop of about `length` s from the steadiest part of x, its end matched in phase to its start"""
    n = int(length * SR)
    w = int(0.25 * SR)
    r = np.sqrt(mavg(x * x, w))
    # steadiest window of n samples: least level variation
    best, bi = 1e9, 0
    for i in range(int(0.05 * SR), len(r) - n, int(0.05 * SR)):
        v = np.std(r[i:i + n]) / (np.mean(r[i:i + n]) + 1e-9)
        if v < best: best, bi = v, i
    seg = x[bi:bi + n + int(0.05 * SR)]
    head = seg[:int(0.02 * SR)]
    # search the end near n for the best match to the head
    lo, hi = n - int(0.02 * SR), n + int(0.02 * SR)
    sc = [np.dot(seg[j:j + len(head)], head) / (np.linalg.norm(seg[j:j + len(head)]) * np.linalg.norm(head) + 1e-9) for j in range(lo, hi)]
    e = lo + int(np.argmax(sc))
    loop = seg[:e].copy()
    k = int(0.03 * SR)
    t = np.linspace(0, 1, k)
    # the tail fades into the audio that originally led up to the start, so the seam is continuous
    loop[-k:] = loop[-k:] * np.cos(t * np.pi / 2) + x[bi - k:bi] * np.sin(t * np.pi / 2)
    return loop


def main(src_dir, recipe):
    files = {}
    for e in json.load(open(recipe)):
        x = load(os.path.join(src_dir, e['src']), e.get('start', 0), e.get('end'), e.get('hp'), e.get('lp'))
        name, kind, db = e['name'], e['kind'], e.get('db', -18)
        if e.get('flat'): x = flatten(x, e['flat'])
        lst = files.setdefault(name, [])
        if kind == 'cuts':   # explicit [start, end] pairs, in seconds from `start`
            for a, b in e['at']:
                y = x[int(a * SR):int(b * SR)]
                lst.append(save(fade(level(y, db), 0.003, min(0.06, (b - a) / 3)), f'{name}_{len(lst)}'))
        elif kind == 'slice':
            ons = onsets(x, e.get('gap', 0.08), e.get('rise', 2.2))
            dur = int(e.get('len', 0.6) * SR)
            # start each take just before its loudest moment, so every one opens on its attack
            h = int(0.005 * SR)
            env = np.sqrt(mavg(x * x, h))
            look = int(e.get('look', 0.12) * SR)
            ons = [max(0, o + int(np.argmax(env[o:o + look])) - int(0.012 * SR)) for o in ons]
            for i, o in enumerate(ons):
                if len(lst) >= e.get('max', 12): break
                end = min(len(x), o + dur, ons[i + 1] + int(0.01 * SR) if i + 1 < len(ons) and e.get('cut', True) else len(x))
                # keep only clean strikes: loudest at the start, then dying away
                w = int(0.025 * SR)
                r = [10 * np.log10(np.mean(x[j:j + w] ** 2) + 1e-12) for j in range(o, end - w, w)]
                if len(r) < 4 or np.argmax(r) > 2 or max(r[:3]) - np.median(r[len(r) // 2:]) < e.get('decay', 8): continue
                lst.append(save(fade(level(x[o:end], db), 0.002, min(0.08, (end - o) / SR / 3)), f'{name}_{len(lst)}'))
        elif kind == 'loop':
            lst.append(save(level(best_loop(x, e.get('len', 1.5)), db), f'{name}_{len(lst)}', wav=True))
        else:
            lst.append(save(fade(level(x, db), 0.004 if kind == 'shot' else 0.05, 0.03 if kind == 'shot' else 0.05), f'{name}_{len(lst)}'))
        print(name, kind, len(lst))
    # the manifest the game loads from, between the markers in src/09a_soundbank.js
    js = os.path.join(OUT, '..', 'src', '09a_soundbank.js')
    src = open(js).read()
    a, b = src.index('const SND_FILES = '), src.index('// end SND_FILES')
    body = ',\n'.join(f"  {k}: [{', '.join(repr(f) for f in v)}]" for k, v in files.items())
    open(js, 'w').write(src[:a] + 'const SND_FILES = {\n' + body + ',\n};\n' + src[b:])


if __name__ == '__main__':
    main(sys.argv[1], sys.argv[2])
