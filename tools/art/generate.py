#!/usr/bin/env python3
"""Text-to-image race portraits from tools/art/races.json using an open SDXL pipeline (Hugging Face diffusers).
NOT RUN IN THE DEV SANDBOX (model hosts are blocked there) — written for a machine with a GPU and internet.
   pip install torch diffusers transformers accelerate safetensors pillow
   python3 tools/art/generate.py --race silicoid --n 8                # 8 candidates -> tools/art/out/silicoid_seed*.png
   python3 tools/art/generate.py --race all --n 4 --upscale           # + a 2x img2img pass for finer detail (2048x2688)
Pick the best candidate per race by eye; re-run with --seed to reproduce or --prompt-extra "..." to steer."""
import argparse, json, os, sys
HERE = os.path.dirname(os.path.abspath(__file__))
ap = argparse.ArgumentParser()
ap.add_argument('--race', default='all'); ap.add_argument('--n', type=int, default=4); ap.add_argument('--seed', type=int, default=None)
ap.add_argument('--model', default='stabilityai/stable-diffusion-xl-base-1.0'); ap.add_argument('--steps', type=int, default=40); ap.add_argument('--cfg', type=float, default=6.5)
ap.add_argument('--upscale', action='store_true'); ap.add_argument('--prompt-extra', default=''); ap.add_argument('--out', default=os.path.join(HERE, 'out'))
a = ap.parse_args()
import torch
from diffusers import StableDiffusionXLPipeline, StableDiffusionXLImg2ImgPipeline
cfg = json.load(open(os.path.join(HERE, 'races.json')))
races = list(cfg['races']) if a.race == 'all' else [a.race]
dev = 'cuda' if torch.cuda.is_available() else 'cpu'; dt = torch.float16 if dev == 'cuda' else torch.float32
pipe = StableDiffusionXLPipeline.from_pretrained(a.model, torch_dtype=dt, use_safetensors=True).to(dev)
refine = StableDiffusionXLImg2ImgPipeline.from_pipe(pipe) if a.upscale else None
os.makedirs(a.out, exist_ok=True); W, H = cfg['size']
for r in races:
    spec = cfg['races'][r]; prompt = f"{spec['prompt']} {a.prompt_extra} Style: {cfg['style']}. Palette: {spec['palette']}."
    for i in range(a.n):
        seed = (a.seed if a.seed is not None else 1000 * (races.index(r) + 1)) + i; g = torch.Generator(dev).manual_seed(seed)
        img = pipe(prompt=prompt, negative_prompt=cfg['negative'], width=W, height=H, num_inference_steps=a.steps, guidance_scale=a.cfg, generator=g).images[0]
        path = os.path.join(a.out, f'{r}_seed{seed}.png'); img.save(path); print('wrote', path, flush=True)
        if refine:   # 2x: Lanczos upscale then a light denoise pass to add real texture instead of blur
            big = img.resize((W * 2, H * 2)); img2 = refine(prompt=prompt, negative_prompt=cfg['negative'], image=big, strength=0.3, num_inference_steps=30, guidance_scale=a.cfg, generator=g).images[0]
            img2.save(path.replace('.png', '_2x.png')); print('wrote', path.replace('.png', '_2x.png'), flush=True)
