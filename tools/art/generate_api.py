#!/usr/bin/env python3
"""Race portraits from a hosted image API, using the prompts in races.json. Standard library only (urllib).
   export GEMINI_API_KEY=...      # "Nano Banana" = Google's Gemini image models (key from Google AI Studio)
   export OPENAI_API_KEY=...      # OpenAI gpt-image
   python3 tools/art/generate_api.py --provider gemini --race silicoid --n 4
   python3 tools/art/generate_api.py --provider openai --race all --n 2
   python3 tools/art/generate_api.py --provider gemini --race mrrshan --ref tools/render/out/mrrshan_clay.png   # optional reference image (Gemini)
Needs outbound access to generativelanguage.googleapis.com (Gemini) or api.openai.com (OpenAI).
Model ids and image sizes change often: override with --model / --size after checking the provider's current docs.
NOT YET RUN against the live APIs (blocked in the dev sandbox) — expect to adjust request fields on first use."""
import argparse, base64, json, os, sys, urllib.request, urllib.error
HERE = os.path.dirname(os.path.abspath(__file__))
ap = argparse.ArgumentParser()
ap.add_argument('--provider', choices=['gemini', 'openai'], required=True); ap.add_argument('--race', default='all'); ap.add_argument('--n', type=int, default=2)
ap.add_argument('--model', default=None, help="gemini default 'gemini-2.5-flash-image' (Nano Banana); for the higher-quality tier try the 'gemini-3-pro-image-preview' family; openai default 'gpt-image-1'")
ap.add_argument('--size', default=None, help="gemini: image size tier e.g. 2K/4K (Pro models only); openai: e.g. 1024x1536")
ap.add_argument('--ref', default=None, help='reference image to condition on (gemini)'); ap.add_argument('--prompt-extra', default=''); ap.add_argument('--out', default=os.path.join(HERE, 'out'))
a = ap.parse_args()
cfg = json.load(open(os.path.join(HERE, 'races.json')))
races = list(cfg['races']) if a.race == 'all' else [a.race]
os.makedirs(a.out, exist_ok=True)

def post(url, headers, body):
    req = urllib.request.Request(url, data=json.dumps(body).encode(), headers={'Content-Type': 'application/json', **headers})
    try:
        with urllib.request.urlopen(req, timeout=300) as r: return json.load(r)
    except urllib.error.HTTPError as e: sys.exit(f'HTTP {e.code}: {e.read().decode()[:800]}')
    except urllib.error.URLError as e: sys.exit(f'network error ({e.reason}) — is the API host allowed in this environment?')

def make_prompt(spec):
    return (f"{spec['prompt']} {a.prompt_extra} Style: {cfg['style']}. Palette: {spec['palette']}. "
            f"Portrait orientation, no text, no watermark, no frame. Avoid: {cfg['negative']}.")

def gemini(prompt):
    key = os.environ.get('GEMINI_API_KEY') or sys.exit('set GEMINI_API_KEY')
    model = a.model or 'gemini-2.5-flash-image'
    parts = [{'text': prompt}]
    if a.ref: parts.insert(0, {'inlineData': {'mimeType': 'image/png', 'data': base64.b64encode(open(a.ref, 'rb').read()).decode()}})
    img_cfg = {'aspectRatio': '3:4'}
    if a.size: img_cfg['imageSize'] = a.size
    r = post(f'https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent', {'x-goog-api-key': key},
             {'contents': [{'parts': parts}], 'generationConfig': {'responseModalities': ['IMAGE'], 'imageConfig': img_cfg}})
    for c in r.get('candidates', []):
        for p in c.get('content', {}).get('parts', []):
            d = p.get('inlineData') or p.get('inline_data')
            if d: return base64.b64decode(d['data'])
    sys.exit('no image in response: ' + json.dumps(r)[:600])

def openai(prompt):
    key = os.environ.get('OPENAI_API_KEY') or sys.exit('set OPENAI_API_KEY')
    r = post('https://api.openai.com/v1/images/generations', {'Authorization': 'Bearer ' + key},
             {'model': a.model or 'gpt-image-1', 'prompt': prompt, 'size': a.size or '1024x1536', 'quality': 'high', 'n': 1})
    return base64.b64decode(r['data'][0]['b64_json'])

gen = gemini if a.provider == 'gemini' else openai
for r in races:
    for i in range(a.n):
        data = gen(make_prompt(cfg['races'][r]))
        path = os.path.join(a.out, f'{r}_{a.provider}_{i + 1}.png'); open(path, 'wb').write(data); print('wrote', path, len(data) // 1024, 'KB', flush=True)
