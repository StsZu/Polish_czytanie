#!/usr/bin/env python3
"""build/tts-plan.json → ElevenLabs → content/audio/<voice>/NN-<section>.mp3 + .align.json (FR-51).

Every piece is synthesised on its own and joined here with silence between, so a word, a line or a
sentence can be played without catching the start of the next one:
  gama   — every word separately (cached by word: the same word sounds the same in every exercise);
  pasaże — every line separately, with timestamps;
  utwór  — every unit (sentence or dialogue line) with timestamps, the neighbours as context.
align.json keeps the format of the course: ''.join(characters) == the section text, so scripts/data.ts
reads it unchanged. Characters between pieces get the time of the boundary.
Idempotent: a section whose text and parameters did not change is skipped.

    npm run data -- --tts-plan                          # build/tts-plan.json
    ELEVENLABS_API_KEY=… python3 scripts/audio.py [--voice alex,beata] [--only 07,21] [--dry-run] [--force]
"""
import argparse, array, base64, hashlib, json, os, subprocess, sys, threading, time, urllib.error, urllib.request
from concurrent.futures import ThreadPoolExecutor

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PLAN = os.path.join(ROOT, 'build', 'tts-plan.json')
OUT = os.path.join(ROOT, 'content', 'audio')
CACHE = os.path.join(ROOT, 'build', 'tts-cache')

VOICES = {
    'alex': 'H5xTcsAIeS5RAykjz57a',   # «Alex – Professional Narration», the main voice
    'beata': 'W0sqKm1Sfw1EzlCH14FQ',  # «Beata Pro – Polish», the second voice
}
MODEL_ID = 'eleven_multilingual_v2'
VOICE_SETTINGS = {'stability': 0.6, 'similarity_boost': 0.8, 'style': 0.0}
WORD_SPEED = 0.85
SPEED = {1: 0.8, 2: 0.9, 3: 1.0}
# Seconds of silence: between gama words / gama lines, pasaże lines, utwór units / utwór lines.
PAUSE = {'gama': (0.45, 0.9), 'pasaze': (0.7, 0.7), 'utwor': (0.35, 0.6)}
SR = 44100
EDGE = int(0.03 * SR)           # silence kept at both ends of a trimmed piece
THRESHOLD = 110                 # ≈ −50 dBFS in 16-bit samples
WORKERS = 3
TRIM = 2                        # version of the trimming rule: a change rebuilds the sections from the cache
KEY = os.environ.get('ELEVENLABS_API_KEY', '')
chars_sent = 0
lock = threading.Lock()


def md5(text):
    return hashlib.md5(text.encode('utf-8')).hexdigest()


def request(voice, text, speed, timestamps, prev='', nxt=''):
    global chars_sent
    body = {'text': text, 'model_id': MODEL_ID, 'language_code': 'pl', 'voice_settings': dict(VOICE_SETTINGS, speed=speed)}
    if prev: body['previous_text'] = prev
    if nxt: body['next_text'] = nxt
    url = f'https://api.elevenlabs.io/v1/text-to-speech/{VOICES[voice]}' + ('/with-timestamps' if timestamps else '') + '?output_format=mp3_44100_128'
    for attempt in range(6):
        req = urllib.request.Request(url, json.dumps(body).encode(), {'xi-api-key': KEY, 'Content-Type': 'application/json'})
        try:
            with urllib.request.urlopen(req, timeout=120) as r:
                data = r.read()
            with lock:
                chars_sent += len(text)
            return json.loads(data) if timestamps else data
        except urllib.error.HTTPError as e:
            if e.code in (429, 500, 502, 503, 504) and attempt < 5:
                time.sleep(3 * (attempt + 1))
                continue
            raise RuntimeError(f'HTTP {e.code}: {e.read()[:200]!r}') from None
        except (urllib.error.URLError, TimeoutError):
            if attempt < 5:
                time.sleep(3 * (attempt + 1))
                continue
            raise


def pcm(mp3_bytes):
    out = subprocess.run(['ffmpeg', '-v', 'error', '-i', 'pipe:0', '-f', 's16le', '-ac', '1', '-ar', str(SR), 'pipe:1'],
                         input=mp3_bytes, capture_output=True, check=True).stdout
    a = array.array('h')
    a.frombytes(out)
    return a


def voiced(samples):
    """[first, last) of the samples louder than the threshold, in 10 ms windows."""
    win = SR // 100
    loud = [i for i in range(0, len(samples), win) if max((abs(x) for x in samples[i:i + win]), default=0) > THRESHOLD]
    if not loud:
        return 0, len(samples)
    return loud[0], min(len(samples), loud[-1] + win)


def word_clip(voice, word):
    """A gama word: synthesised once per voice, trimmed to the voice with EDGE of silence; cached."""
    path = os.path.join(CACHE, voice, f'w-{md5(word.lower() + f"@{WORD_SPEED}")}.pcm')
    if os.path.exists(path):
        a = array.array('h')
        with open(path, 'rb') as f:
            a.frombytes(f.read())
        return a
    s = pcm(request(voice, word, WORD_SPEED, False))
    a, b = voiced(s)
    clip = s[max(0, a - EDGE):min(len(s), b + EDGE)]
    os.makedirs(os.path.dirname(path), exist_ok=True)
    tmp = f'{path}.{threading.get_ident()}.tmp'   # the same word may be in a line twice: one file per thread
    with open(tmp, 'wb') as f:
        f.write(clip.tobytes())
    os.replace(tmp, path)
    return clip


def timed_clip(voice, text, speed, prev, nxt):
    """A line or a sentence with its character times; trimmed like a word, times shifted with it."""
    key = md5(f'{text}@{speed}@{prev}@{nxt}')
    path = os.path.join(CACHE, voice, f't-{key}.json')
    if os.path.exists(path):
        with open(path) as f:
            r = json.load(f)
    else:
        r = request(voice, text, speed, True, prev, nxt)
        al = r.get('alignment') or {}
        if ''.join(al.get('characters', [])) != text:
            raise RuntimeError(f'символи alignment ≠ шматок {text[:40]!r}')
        r = {'audio_base64': r['audio_base64'], 'alignment': al}
        os.makedirs(os.path.dirname(path), exist_ok=True)
        tmp = f'{path}.{threading.get_ident()}.tmp'
        with open(tmp, 'w') as f:
            json.dump(r, f)
        os.replace(tmp, path)
    s = pcm(base64.b64decode(r['audio_base64']))
    al = r['alignment']
    a, b = voiced(s)
    # Never cut into the first or the last character: a quiet «W» at the start would lose its time.
    first = int(al['character_start_times_seconds'][0] * SR)
    last = int(al['character_end_times_seconds'][-1] * SR)
    start = max(0, min(a, first) - EDGE)
    end = min(len(s), max(b, last) + EDGE)
    shift = start / SR
    length = (end - start) / SR
    clamp = lambda t: min(length, max(0.0, t - shift))
    return s[start:end], [clamp(t) for t in al['character_start_times_seconds']], [clamp(t) for t in al['character_end_times_seconds']]


def build_section(voice, sec):
    text, kind, pieces = sec['text'], sec['kind'], sec['pieces']
    speed = SPEED[sec['level']]
    # Synthesis first (in parallel), then the join in order.
    def make(i):
        s, k = pieces[i]
        if kind == 'gama':
            return word_clip(voice, text[s:k]), None, None
        prev = text[pieces[i - 1][0]:pieces[i - 1][1]] if kind == 'utwor' and i > 0 else ''
        nxt = text[pieces[i + 1][0]:pieces[i + 1][1]] if kind == 'utwor' and i + 1 < len(pieces) else ''
        return timed_clip(voice, text[s:k], speed, prev, nxt)
    with ThreadPoolExecutor(WORKERS) as pool:
        clips = list(pool.map(make, range(len(pieces))))

    out = array.array('h')
    starts = [None] * len(text)
    ends = [None] * len(text)
    t = 0.0
    for i, ((s, k), (clip, cs, ce)) in enumerate(zip(pieces, clips)):
        if i:
            gap = text[pieces[i - 1][1]:s]
            pause = PAUSE[kind][1] if '\n' in gap else PAUSE[kind][0]
            out.extend(array.array('h', bytes(2 * int(pause * SR))))
            t = len(out) / SR
        dur = len(clip) / SR
        if cs is None:
            # A gama word: its letters spread evenly over the voiced part.
            a, b = EDGE / SR, max(EDGE / SR, dur - EDGE / SR)
            n = k - s
            for j in range(n):
                starts[s + j] = t + a + (b - a) * j / n
                ends[s + j] = t + a + (b - a) * (j + 1) / n
        else:
            for j in range(k - s):
                starts[s + j] = t + cs[j]
                ends[s + j] = t + ce[j]
        out.extend(clip)
        t = len(out) / SR
    # Characters between pieces (", ", ".\\n", dialogue dashes): the time of the boundary before them.
    last = 0.0
    for j in range(len(text)):
        if starts[j] is None:
            starts[j] = ends[j] = last
        else:
            last = ends[j]
    total = len(out) / SR
    mp3 = subprocess.run(['ffmpeg', '-v', 'error', '-f', 's16le', '-ar', str(SR), '-ac', '1', '-i', 'pipe:0',
                          '-codec:a', 'libmp3lame', '-b:a', '128k', '-f', 'mp3', 'pipe:1'],
                         input=out.tobytes(), capture_output=True, check=True).stdout
    r3 = lambda x: round(min(x, total), 3)
    align = {'characters': list(text), 'character_start_times_seconds': [r3(x) for x in starts],
             'character_end_times_seconds': [r3(x) for x in ends]}
    return mp3, align


def params(voice, sec):
    return md5(json.dumps([sec['text'], sec['pieces'], VOICES[voice], MODEL_ID, VOICE_SETTINGS, WORD_SPEED, SPEED[sec['level']], PAUSE[sec['kind']], EDGE, THRESHOLD, TRIM]))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--voice', default=','.join(VOICES))
    ap.add_argument('--only')
    ap.add_argument('--dry-run', action='store_true')
    ap.add_argument('--force', action='store_true')
    args = ap.parse_args()
    if not os.path.exists(PLAN):
        sys.exit('Немає build/tts-plan.json: спершу npm run data -- --tts-plan')
    with open(PLAN) as f:
        plan = json.load(f)
    only = set(args.only.split(',')) if args.only else None
    voices = args.voice.split(',')
    todo = []
    for voice in voices:
        if voice not in VOICES:
            sys.exit(f'Невідомий голос {voice}: {", ".join(VOICES)}')
        for sec in plan:
            if only and sec['stem'][:2] not in only:
                continue
            base = os.path.join(OUT, voice, sec['stem'])
            p = params(voice, sec)
            if not args.force and os.path.exists(base + '.mp3') and os.path.exists(base + '.align.json'):
                with open(base + '.align.json') as f:
                    if json.load(f).get('param_md5') == p:
                        continue
            todo.append((voice, sec, base, p))
    print(f'секцій до генерації: {len(todo)}')
    if args.dry_run:
        for voice, sec, _, _ in todo:
            print(f'  {voice} {sec["stem"]}: {len(sec["pieces"])} шматків')
        return
    if not KEY:
        sys.exit('Немає ELEVENLABS_API_KEY у середовищі')
    errors = []
    for voice, sec, base, p in todo:
        try:
            mp3, align = build_section(voice, sec)
        except Exception as e:  # noqa: BLE001 — one failed section must not stop the others
            errors.append(f'{voice} {sec["stem"]}: {e}')
            print(f'  ✗ {voice} {sec["stem"]}: {e}', flush=True)
            continue
        os.makedirs(os.path.dirname(base), exist_ok=True)
        with open(base + '.mp3', 'wb') as f:
            f.write(mp3)
        align.update({'tekst_md5': md5(sec['text']), 'param_md5': p, 'voice_id': VOICES[voice], 'model_id': MODEL_ID})
        with open(base + '.align.json', 'w') as f:
            json.dump(align, f, ensure_ascii=False)
        print(f'  ✓ {voice} {sec["stem"]} · {align["character_end_times_seconds"][-1]:.1f} с · знаків надіслано: {chars_sent}', flush=True)
    print(f'надіслано знаків: {chars_sent}; помилок: {len(errors)}')
    sys.exit(1 if errors else 0)


if __name__ == '__main__':
    main()
