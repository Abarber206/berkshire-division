#!/usr/bin/env python3
"""Build steam whistle takes for engines that have no public-domain recording of their own whistle.

    python3 -I audio/tools/whistle_synth.py [key,key...]

Writes, for each whistle key in VOICES, the three takes the game's recorded-whistle player uses:
  wh_<key>_0.wav       the sustain, a seamless loop (every modulation is periodic over its length)
  wh_<key>_on_0.mp3    the valve opening: steam first, then each chamber speaks, scooping up to pitch
  wh_<key>_off_0.mp3   the valve closing: the chord sags and breaks up into steam
and levels them like audio/tools/prepare.py does (-14 dB RMS), so SND_GAIN stays 1.

Nothing here is sampled from a recording. A chime whistle is a set of resonating chambers blown by one jet
of steam; each chamber is modelled as two slightly mistuned tones (the two edges of the bell's mouth beat
against each other), with the slow pitch wander and amplitude flutter of a turbulent jet, its own band of
breath noise, and upper partials, all over the broadband hiss of the steam itself. Chords are set per
engine in VOICES. Deterministic (fixed seeds), so a rebuild gives the same files. Needs ffmpeg and numpy.
"""
import ast, os, re, subprocess, sys
import numpy as np

SR = 44100
OUT = os.environ.get('WH_OUT') or os.path.join(os.path.dirname(__file__), '..')

# notes: chamber pitches (Hz) and levels (dB); harm: 2nd..nth partial levels (dB); split: mistuning of a
# chamber's two edges (fraction); wander: slow pitch wander (fraction, rms); flutter: amplitude flutter;
# jet: flutter of the steam supply, shared by all chambers; breath: noise band on each chamber (dB under its tone); hiss: steam noise (dB under the chord) and its
# centre (Hz); air: top roll-off (Hz); scoop: how far under pitch a chamber starts (fraction); speak: seconds over which the
# chambers find their voice; sag: pitch drop as the valve closes; loop: sustain length (s)
VOICES = {
    # Pere Marquette 1225: a bright five-chime with a faint sixth, G B D E F# with A above (the chord this
    # engine is known for, written down by ear from a reference listening; synthesized, not sampled)
    'pm6': dict(notes=[(387, -3.5), (491, 0), (582, -1.5), (655, -0.8), (756, -0.8), (859, -11)],
                harm=[-8, -12, -17, -23], split=0.012, wander=0.009, flutter=0.18, jet=0.16, breath=-10, hiss=(-12, 2400), air=7500,
                scoop=0.06, speak=0.09, sag=0.045, loop=3.0, seed=1225),
    # Nickel Plate 765: a deeper, mellower six-chime in a minor voicing, Bb Db Eb F Ab Bb (fewer upper
    # partials, a longer quill). No PD recording of the 765 exists, so this is a voice for it, not a copy
    'nkp6m': dict(notes=[(233, -2), (277, 0), (311, -1), (349, -1.5), (415, -2.5), (466, -5)],
                 harm=[-11, -21, -29], split=0.009, wander=0.0045, flutter=0.14, breath=-14, hiss=(-17, 2400), air=8000,
                 scoop=0.08, speak=0.13, sag=0.06, loop=3.0, seed=765),
    # C&O 1308: a three-chime "hooter", C# E G#, raspy and steamy, as C&O's heavy freight power carried
    'co3': dict(notes=[(277, 0), (330, -1), (415, -2)],
                harm=[-7, -14, -20, -26], split=0.016, wander=0.007, flutter=0.18, breath=-11, hiss=(-13, 2300), air=8500,
                scoop=0.07, speak=0.11, sag=0.07, loop=2.6, seed=1308),
}


def db(v):
    return 10 ** (v / 20)


def band_noise(n, rng, lo, hi, tilt=0.0):
    """periodic noise over n samples, flat between lo and hi Hz (tilt: dB per octave above lo), unit rms"""
    f = np.fft.rfftfreq(n, 1 / SR)
    spec = (rng.standard_normal(len(f)) + 1j * rng.standard_normal(len(f)))
    m = ((f >= lo) & (f <= hi)).astype(float)
    if tilt:
        m *= np.where(f > lo, (np.maximum(f, lo) / lo) ** (tilt / 6.02), 1)
    spec *= m
    spec[0] = 0
    x = np.fft.irfft(spec, n)
    return x / (np.sqrt(np.mean(x * x)) + 1e-12)


def reson_noise(n, rng, fc, bw):
    """periodic noise with a resonant (Lorentzian) peak at fc of width bw Hz, unit rms"""
    f = np.fft.rfftfreq(n, 1 / SR)
    spec = (rng.standard_normal(len(f)) + 1j * rng.standard_normal(len(f))) / (1 + ((f - fc) / (bw / 2)) ** 2)
    spec[0] = 0
    x = np.fft.irfft(spec, n)
    return x / (np.sqrt(np.mean(x * x)) + 1e-12)


def chord(V, n, rng, pitch_env=None, amp_env=None, periodic=True):
    """the whistle's tone over n samples. pitch_env/amp_env: per chamber arrays (or None for steady)."""
    t_len = n / SR
    out = np.zeros(n)
    jet = np.maximum(1 + V.get('jet', 0.1) * (0.6 * band_noise(n, rng, 0.5, 5) + 0.4 * band_noise(n, rng, 5, 14)), 0.3)   # the steam supply surging
    harm = [0.0] + list(V['harm'])
    for ci, (f0, lv) in enumerate(V['notes']):
        g = db(lv)
        wander = band_noise(n, rng, 0.3, 7) * V['wander'] + band_noise(n, rng, 15, 45) * V['wander'] * 0.25
        flut = 1 + V['flutter'] * (0.7 * band_noise(n, rng, 0.4, 4) + 0.3 * band_noise(n, rng, 6, 16))
        flut = np.maximum(flut, 0.2)
        tone = np.zeros(n)
        for side, (sf, sg) in enumerate([(1 - V['split'] / 2, 1.0), (1 + V['split'] / 2, 0.55)]):
            f = f0 * sf
            if periodic:   # a whole number of cycles in the loop so the seam is clean
                f = round(f * t_len) / t_len
            inst = f * (1 + wander * (1 if side == 0 else 0.8))
            if pitch_env is not None:
                inst = inst * pitch_env[ci]
            ph = 2 * np.pi * np.cumsum(inst) / SR + rng.uniform(0, 2 * np.pi)
            if periodic:   # integer cycles: remove the leftover drift of the wander so the phase closes
                total = ph[-1] - ph[0] + 2 * np.pi * inst[0] / SR
                cyc = round(total / (2 * np.pi))
                ph -= np.arange(n) / n * (total - 2 * np.pi * cyc)
            for k, hl in enumerate(harm):
                if f * (k + 1) > 9000:
                    break
                tone += sg * db(hl) * np.sin((k + 1) * ph + k * 0.7)
        breath = reson_noise(n, rng, f0, f0 * 0.035) * db(V['breath']) * 1.6
        voice = (tone + breath) * flut * g
        if amp_env is not None:
            voice *= amp_env[ci]
        out += voice
    return out * jet


def hiss(V, n, rng):
    lv, fc = V['hiss']
    h = 0.8 * band_noise(n, rng, fc * 0.4, fc * 3.2, tilt=-4.5) + 0.3 * band_noise(n, rng, 90, fc * 0.4, tilt=-3)
    return h * db(lv)


def norm_ref(x, ref):
    return x * (0.2 / (np.sqrt(np.mean(ref * ref)) + 1e-12))


def render(key):
    V = VOICES[key]
    nch = len(V['notes'])
    # ---- sustain loop (periodic, so it loops with no seam)
    n = int(V['loop'] * SR)
    rng = np.random.default_rng(V['seed'])
    tone = chord(V, n, rng)
    loop = tone + hiss(V, n, rng) * np.sqrt(np.mean(tone * tone))
    ref = loop.copy()

    # ---- opening: steam first, then the chambers speak one after another, scooping up to pitch
    n_on = int(1.3 * SR)
    t = np.arange(n_on) / SR
    rng = np.random.default_rng(V['seed'] + 1)
    order = rng.permutation(nch)
    pitch, amp = [], []
    for ci in range(nch):
        d = 0.018 + V['speak'] * (np.where(order == ci)[0][0] / max(nch - 1, 1)) * rng.uniform(0.6, 1.0)
        tt = np.maximum(t - d, 0)
        a = (1 - np.exp(-tt / (V['speak'] * 0.45))) * (t > d)
        a *= 1 + 0.12 * np.exp(-((t - d - 0.16) / 0.07) ** 2)          # the first bark of the jet
        pitch.append(1 - V['scoop'] * np.exp(-tt / 0.075) * rng.uniform(0.7, 1.1))
        amp.append(a)
    tone = chord(V, n_on, rng, pitch, amp, periodic=False)
    lev = np.sqrt(np.mean(chord(V, n_on, np.random.default_rng(9), periodic=False) ** 2))
    h_env = np.clip(t / 0.03, 0, 1) * (1 + 0.6 * np.exp(-t / 0.08))      # steam ahead of the tone
    on = tone + hiss(V, n_on, rng) * lev * h_env
    on[:int(0.004 * SR)] *= np.linspace(0, 1, int(0.004 * SR))
    on[-int(0.02 * SR):] *= np.linspace(1, 0, int(0.02 * SR))

    # ---- closing: from full voice, top chambers starve first, the chord sags, steam trails off
    n_off = int(1.1 * SR)
    t = np.arange(n_off) / SR
    rng = np.random.default_rng(V['seed'] + 2)
    pitch, amp = [], []
    hold = 0.07
    for ci, (f0, _) in enumerate(V['notes']):
        rank = ci / max(nch - 1, 1)
        tau = 0.11 * (1.25 - 0.55 * rank) * rng.uniform(0.85, 1.15)
        tt = np.maximum(t - hold, 0)
        amp.append(np.exp(-tt / tau))
        pitch.append(1 - V['sag'] * (1 - np.exp(-tt / 0.12)) * (0.8 + 0.4 * rank))
    tone = chord(V, n_off, rng, pitch, amp, periodic=False)
    h_env = np.exp(-np.maximum(t - hold, 0) / 0.22)
    off = tone + hiss(V, n_off, rng) * lev * h_env
    off[-int(0.3 * SR):] *= np.linspace(1, 0, int(0.3 * SR)) ** 2
    off[:int(0.002 * SR)] *= np.linspace(0, 1, int(0.002 * SR))

    # air between engine and ear: a gentle top roll-off, as the recordings have
    def soften(x):
        f = np.fft.rfftfreq(len(x), 1 / SR)
        return np.fft.irfft(np.fft.rfft(x) / np.sqrt(1 + (f / V['air']) ** 4) * np.sqrt(1 / (1 + (90 / np.maximum(f, 1)) ** 4)), len(x))
    loop, on, off = soften(loop), soften(on), soften(off)
    # level all three by the loop so the takes hand over without a jump (prepare.py's -14 dB RMS)
    g = db(-14) / np.sqrt(np.mean(loop * loop))
    peak = max(np.abs(loop * g).max(), np.abs(on * g).max(), np.abs(off * g).max())
    if peak > 0.97:
        g *= 0.97 / peak
    loop = loop * g
    # the loop is circular, so it can start anywhere: start it where two neighbouring samples sit closest
    d = np.abs(loop - np.roll(loop, 1))
    loop = np.roll(loop, -int(np.argmin(d + 4 * np.abs(loop))))
    return loop, on * g, off * g


def save(x, name, wav=False):
    path = os.path.join(OUT, name + ('.wav' if wav else '.mp3'))
    codec = ['-c:a', 'pcm_s16le'] if wav else ['-c:a', 'libmp3lame', '-q:a', '3']
    subprocess.run(['ffmpeg', '-loglevel', 'error', '-y', '-f', 'f32le', '-ar', str(SR), '-ac', '1', '-i', '-'] + codec + [path],
                   input=x.astype(np.float32).tobytes(), check=True)
    return path


def manifest():
    """the SND_FILES entries this tool makes (prepare.py keeps them on a full rebuild)"""
    out = {}
    for key in VOICES:
        out[f'wh_{key}'] = [f'wh_{key}_0.wav']
        out[f'wh_{key}_on'] = [f'wh_{key}_on_0.mp3']
        out[f'wh_{key}_off'] = [f'wh_{key}_off_0.mp3']
    return out


def write_manifest():
    js = os.path.join(os.path.dirname(__file__), '..', '..', 'src', '09a_soundbank.js')
    src = open(js).read()
    a, b = src.index('const SND_FILES = '), src.index('// end SND_FILES')
    old = {k: ast.literal_eval(v) for k, v in re.findall(r"^  (\w+): (\[.*\]),?$", src[a:b], re.M)}
    old.update(manifest())
    body = ',\n'.join(f"  {k}: [{', '.join(repr(f) for f in v)}]" for k, v in old.items())
    open(js, 'w').write(src[:a] + 'const SND_FILES = {\n' + body + ',\n};\n' + src[b:])


def main(only=None):
    for key in VOICES:
        if only and key not in only:
            continue
        loop, on, off = render(key)
        save(loop, f'wh_{key}_0', wav=True)
        save(on, f'wh_{key}_on_0')
        save(off, f'wh_{key}_off_0')
        print(key, f'loop {len(loop) / SR:.2f} s, on {len(on) / SR:.2f} s, off {len(off) / SR:.2f} s')
    if not os.environ.get('WH_OUT'):
        write_manifest()


if __name__ == '__main__':
    main(sys.argv[1].split(',') if len(sys.argv) > 1 else None)
