"""Generate the high-resolution bitmap PBR maps used by the Cycles scenes (numpy + Pillow only).
All maps are seamlessly tileable (spectral synthesis), so they box-project onto any mesh without UVs.
   python3 tools/render/make_textures.py [--res 4096] [--out tools/render/textures]
Writes: lava_{color,emit,rough,normal}.png  crystal_{tint,rough,normal,inclusion}.png  obsidian_{color,rough,normal}.png"""
import argparse, os, time
import numpy as np
from PIL import Image

ap = argparse.ArgumentParser(); ap.add_argument('--res', type=int, default=4096); ap.add_argument('--out', default=os.path.join(os.path.dirname(__file__), 'textures'))
ap.add_argument('--seed', type=int, default=11); a = ap.parse_args()
R = a.res; os.makedirs(a.out, exist_ok=True)
rng = np.random.default_rng(a.seed)
fx = np.fft.fftfreq(R)[None, :]; fy = np.fft.fftfreq(R)[:, None]
FR = np.sqrt(fx * fx + fy * fy); FR[0, 0] = 1.0

def fbm(beta=2.4, lo=0.0, hi=0.5):
    """Tileable fractal noise in 0..1; beta = spectral falloff (higher = smoother), lo/hi = band-pass limits (cycles/pixel)."""
    f = np.fft.fft2(rng.standard_normal((R, R)).astype(np.float32))
    filt = FR ** (-beta / 2.0); filt[(FR < lo) | (FR > hi)] = 0; filt[0, 0] = 0
    n = np.fft.ifft2(f * filt).real.astype(np.float32)
    n -= n.min(); n /= max(n.max(), 1e-6); return n

def blur(img, sigma):
    return np.fft.ifft2(np.fft.fft2(img) * np.exp(-2 * (np.pi * sigma) ** 2 * FR ** 2 * (FR > 0))).real.astype(np.float32)

def warp(img, wx, wy, amt):
    ix = (np.arange(R)[None, :] + ((wx - 0.5) * amt).astype(np.int32)) % R
    iy = (np.arange(R)[:, None] + ((wy - 0.5) * amt).astype(np.int32)) % R
    return img[iy, ix]

def smooth(x, a_, b_):
    t = np.clip((x - a_) / (b_ - a_), 0, 1); return t * t * (3 - 2 * t)

def normal_map(h, strength):
    gy, gx = np.gradient(h); gx = np.roll(gx, 0, 0)
    n = np.stack([-gx * strength, -gy * strength, np.ones_like(h)], -1)
    n /= np.linalg.norm(n, axis=-1, keepdims=True); return n * 0.5 + 0.5

def save(name, arr):
    arr = np.clip(arr, 0, 1)
    if arr.ndim == 2: arr = np.stack([arr] * 3, -1)
    Image.fromarray((arr * 255 + 0.5).astype(np.uint8)).save(os.path.join(a.out, name + '.png'), compress_level=3)
    print('  ', name, arr.shape, flush=True)

t0 = time.time()
# ---------------------------------------------------------------- lava crust: cooled basalt with glowing fracture network
print('lava…', flush=True)
base = fbm(3.0, 0.0008, 0.3)
def fractures(hi, beta, lo_t, hi_t, seed_warp):
    n = fbm(beta, 0.0006, hi)                         # smooth field: its 0.5 contour is a thin, continuous crack line
    n = warp(n, fbm(3.2, 0, 0.01), fbm(3.2, 0, 0.01), R * seed_warp)
    return smooth(1 - np.abs(2 * n - 1), lo_t, hi_t)
crack = fractures(0.012, 3.6, 0.972, 0.997, 0.06)
fine = fractures(0.05, 3.2, 0.975, 0.997, 0.03) * 0.8
mask = np.maximum(crack, fine)
glow = blur(mask, R * 0.004); glow /= max(glow.max(), 1e-6)
heat = np.clip(mask * 1.0 + glow * 1.4, 0, 1.6)
ramp = lambda t: np.stack([np.clip(t * 1.6, 0, 1), np.clip(t * t * 1.15 - 0.15, 0, 1), np.clip(t ** 4 - 0.25, 0, 1)], -1)
crust = fbm(2.2, 0.002, 0.5); ash = fbm(1.6, 0.01, 0.5)
col = np.stack([0.055 + 0.07 * crust, 0.05 + 0.055 * crust, 0.05 + 0.05 * crust], -1) * (0.7 + 0.6 * ash[..., None])
col = col * (1 - mask[..., None]) + ramp(np.clip(heat, 0, 1))[..., None, :].squeeze(-2) * mask[..., None] * 0.3
save('lava_color', col)
save('lava_emit', ramp(np.clip(heat, 0, 1.0)) * np.clip(heat, 0, 1)[..., None])
save('lava_rough', 0.62 + 0.3 * crust - 0.45 * mask)
h = base * 0.7 + blur(crust, 1.0) * 0.3; h = h * (1 - 0.8 * smooth(heat, 0.2, 0.9)); save('lava_normal', normal_map(blur(h, 1.2), R * 0.06))

# ---------------------------------------------------------------- crystal: zoning, frosted inclusions, micro-fractures
print('crystal…', flush=True)
zone = np.sin((fbm(3.0, 0, 0.01) * 14 + np.arange(R)[:, None] / R * 40)) * 0.5 + 0.5
incl = smooth(fbm(2.4, 0.003, 0.5), 0.55, 0.8) * smooth(fbm(3.2, 0, 0.02), 0.4, 0.7)
frac = 1 - np.abs(2 * warp(fbm(2.4, 0.002, 0.3), fbm(3, 0, 0.02), fbm(3, 0, 0.02), R * 0.03) - 1)
fracm = smooth(frac, 0.96, 0.995)
save('crystal_tint', np.stack([0.80 + 0.2 * zone, 0.88 + 0.12 * zone, 0.95 + 0.05 * zone], -1) * (1 - 0.18 * incl[..., None]))
save('crystal_rough', 0.03 + 0.55 * incl + 0.35 * fracm + 0.05 * fbm(2.0, 0.05, 0.5))
save('crystal_inclusion', incl)
save('crystal_normal', normal_map(blur(fracm * 0.5 + incl * 0.5, 1.0) + fbm(3.0, 0.02, 0.2) * 0.04, R * 0.06))

# ---------------------------------------------------------------- obsidian: flowing glass with fine scratches
print('obsidian…', flush=True)
flow = warp(fbm(2.8, 0, 0.02), fbm(3, 0, 0.01), fbm(3, 0, 0.01), R * 0.12)
sc = smooth(1 - np.abs(2 * fbm(1.2, 0.08, 0.5) - 1), 0.97, 0.995)
save('obsidian_color', np.stack([0.02 + 0.03 * flow, 0.022 + 0.03 * flow, 0.035 + 0.05 * flow], -1))
save('obsidian_rough', 0.08 + 0.25 * sc + 0.1 * flow)
save('obsidian_normal', normal_map(flow + sc * 0.08, R * 0.05))
print('done in %.0fs' % (time.time() - t0))
