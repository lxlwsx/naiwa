"""Build naiwa pet sprite assets from the 1536x1024 three-view reference.

Pipeline per character:
  1. crop with pad, split away neighbours
  2. background classification from crop border (flood fill, near-white + low chroma)
  3. soft alpha from chroma ramp (protects cream belly, gives soft rim)
  4. dark core (eyes / mouth / AO) forced opaque, enclosed white pockets filled
  5. colour unmix against white to kill the white fringe, ~1px edge shrink
  6. common scale, common feet baseline, horizontal centring on 640x768 canvas
"""
import json
import os
import sys
from collections import deque

import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont

SRC = os.environ.get(
    'NAIWA_SRC',
    r'C:\Users\LXL\.dsh\attachments\v1\objects\d3\d3bfcc96fea5b4326777530418e18201332f230b54d08bb091b77f6ac2d03244',
)
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ASSETS = os.path.join(ROOT, 'naiwa-pet', 'assets')
DEBUG = os.path.join(ROOT, 'tools', 'debug')
CANVAS_W, CANVAS_H = 640, 768
MARGIN_X = 16
MARGIN_Y = 37
WHITE = 254.5

os.makedirs(ASSETS, exist_ok=True)
os.makedirs(DEBUG, exist_ok=True)

# crop boxes: gap midpoints between the three characters keep neighbours out
REGIONS = {
    'front': (0, 200, 550, 900),
    'side': (1053, 200, 1536, 900),
}


def gblur(arr, sigma, edge='reflect'):
    """Gaussian blur via FFT (no scipy available). Works on 2-D float arrays."""
    a = np.asarray(arr, dtype=np.float32)
    if a.ndim == 3:  # blur each channel of an RGB patch
        return np.stack([gblur(a[..., i], sigma, edge) for i in range(a.shape[2])], axis=2)
    if sigma <= 0.01:
        return a.copy()
    pad = int(np.ceil(3 * sigma))
    ap = np.pad(a, pad, mode=edge)
    h, w = ap.shape
    F = np.fft.rfft2(ap)
    ky = np.fft.fftfreq(h)[:, None]
    kx = np.fft.rfftfreq(w)[None, :]
    G = np.exp(-2.0 * (np.pi ** 2) * (sigma ** 2) * (kx ** 2 + ky ** 2))
    out = np.fft.irfft2(F * G, s=ap.shape)
    return np.clip(out[pad:pad + a.shape[0], pad:pad + a.shape[1]], -1e9, 1e9).astype(np.float32)


def flood_from_border(mask, fill_value, seed=128):
    """Fill the seed-connected component of `mask` (uint8 0/255)."""
    im = Image.fromarray(np.where(mask, 255, 0).astype(np.uint8), 'L').copy()
    ImageDraw.floodfill(im, (0, 0), seed)
    return np.asarray(im) == seed


def ramp(x, lo, hi):
    return np.clip((x - lo) / float(hi - lo), 0.0, 1.0)


def extract_view(box, name):
    x0, y0, x1, y1 = box
    crop = np.asarray(Image.open(SRC).convert('RGB'))[y0:y1, x0:x1].astype(np.float32)
    r, g, b = crop[..., 0], crop[..., 1], crop[..., 2]
    mx = crop.max(2); mn = crop.min(2)
    chroma = mx - mn
    lum = 0.299 * r + 0.587 * g + 0.114 * b

    # --- background: border-connected, near-white / neutral -----------------
    neutral_bg = (chroma < 30.0) & (np.abs(r - b) <= 17.0) & (mn > 150.0)
    outside_bg = flood_from_border(neutral_bg, 1)

    # --- soft alpha from a blurred chroma ramp ------------------------------
    chroma_s = gblur(chroma, 1.35)
    alpha = ramp(chroma_s, 26.0, 52.0)

    # dark core (pupils, mouth, contact AO) is opaque and must not be eroded
    dark = lum < 105.0
    # interior specular (white eye highlight) is near-white but enclosed by the
    # border-seeded flood fill, so it survives as an opaque hole in the body
    strong = alpha > 0.55
    enclosed = ~strong & ~flood_from_border(~strong, 1)

    alpha = np.maximum(alpha, dark.astype(np.float32))
    alpha[outside_bg] = 0.0
    alpha[enclosed] = 1.0

    # --- ~1px edge shrink + gentle ramp ------------------------------------
    alpha = gblur(alpha, 0.6)
    alpha = np.clip((alpha - 0.16) / 0.84, 0.0, 1.0)
    alpha[alpha < 0.045] = 0.0
    alpha[alpha > 0.996] = 1.0

    # --- enclosed translucent pockets (eye sclera / specular) -> opaque ----
    # the eye's bright low-chroma rim survives the flood fill but gets a low
    # chroma alpha; anything enclosed by solid body is part of the character
    support = alpha > 0.80
    reach = flood_from_border(~support, 1)
    holes = ~support & ~reach
    if holes.any():
        alpha[holes] = 1.0
        ys_h, xs_h = np.where(holes)
        print('[extract] %s sealed %d enclosed translucent px (bbox %d,%d-%d,%d)'
              % (name, int(holes.sum()), xs_h.min(), ys_h.min(), xs_h.max(), ys_h.max()))

    # --- colour unmix against white ----------------------------------------
    a_safe = np.clip(alpha, 0.045, 1.0)[..., None]
    rgb = WHITE + (crop - WHITE) / a_safe
    rgb = np.where((alpha >= 0.985)[..., None], crop, rgb)
    rgb = np.clip(rgb, 0.0, 255.0)
    rgb[alpha <= 0.0] = 0.0

    rgba = np.dstack([np.round(rgb), np.round(alpha * 255.0)]).astype(np.uint8)
    ys, xs = np.where(alpha > 0.02)
    bb = (int(xs.min()), int(ys.min()), int(xs.max()) + 1, int(ys.max()) + 1)
    img = Image.fromarray(rgba, 'RGBA').crop(bb)
    info = {'crop_box': list(box), 'bbox_in_crop': [bb[0], bb[1], bb[2] - bb[0], bb[3] - bb[1]],
            'bbox_abs': [box[0] + bb[0], box[1] + bb[1], bb[2] - bb[0], bb[3] - bb[1]],
            'w': bb[2] - bb[0], 'h': bb[3] - bb[1]}
    img.save(os.path.join(DEBUG, 'extract_%s.png' % name))
    print('[extract]', name, 'bbox', info['bbox_abs'], 'size', img.size)
    return img, info


def resize_rgba_premul(img, size):
    """High quality RGBA resize with premultiplied alpha (no dark/white fringe)."""
    arr = np.asarray(img).astype(np.float32)
    al = arr[..., 3:4] / 255.0
    pm = np.concatenate([arr[..., :3] * al, arr[..., 3:4]], axis=2)
    pm = np.clip(pm + 0.5, 0, 255).astype(np.uint8)
    out = Image.fromarray(pm, 'RGBA').resize(size, Image.LANCZOS)
    arr = np.asarray(out).astype(np.float32)
    al = arr[..., 3:4] / 255.0
    rgb = arr[..., :3] / np.maximum(al, 1e-4)
    rgb = np.where(al > 0.004, rgb, 0.0)
    return Image.fromarray(np.dstack([np.clip(rgb, 0, 255), arr[..., 3:4]]).astype(np.uint8), 'RGBA')


def bilateral(rgb, r=2, sigma_s=1.6, sigma_r=12.0):
    """Edge-preserving smoothing: removes plush micro-noise while keeping the
    silhouette, eye rims and features crisp."""
    h, w, _ = rgb.shape
    acc = np.zeros_like(rgb)
    wsum = np.zeros(rgb.shape[:2] + (1,), np.float32)
    for dy in range(-r, r + 1):
        for dx in range(-r, r + 1):
            ws = np.exp(-(dy * dy + dx * dx) / (2 * sigma_s * sigma_s))
            sh = np.zeros_like(rgb)
            ys0, ys1 = max(0, dy), min(h, h + dy)
            xs0, xs1 = max(0, dx), min(w, w + dx)
            sh[ys0:ys1, xs0:xs1] = rgb[ys0 - dy:ys1 - dy, xs0 - dx:xs1 - dx]
            d2 = ((sh - rgb) ** 2).sum(2, keepdims=True)
            wgt = ws * np.exp(-d2 / (2 * sigma_r * sigma_r))
            acc += sh * wgt
            wsum += wgt
    return acc / np.maximum(wsum, 1e-6)


def save_png_clean(img, path, sigma_r=12.0):
    """Save a visually lossless RGBA PNG: edge-preserving denoise (size control)
    then full 8-bit RGBA, optimised zlib. Returns the reloaded RGBA image."""
    arr = np.asarray(img.convert('RGBA')).astype(np.float32)
    alpha = arr[..., 3:4]
    sm = bilateral(arr[..., :3], 2, 1.6, sigma_r)
    out = np.dstack([np.clip(sm + 0.5, 0, 255), alpha]).astype(np.uint8)
    Image.fromarray(out, 'RGBA').save(path, optimize=True, compress_level=9)
    return Image.open(path).convert('RGBA')


def main():
    frames = {}
    infos = {}
    for name, box in REGIONS.items():
        frames[name], infos[name] = extract_view(box, name)

    max_w = max(f.width for f in frames.values())
    max_h = max(f.height for f in frames.values())
    scale = min((CANVAS_W - 2 * MARGIN_X) / max_w, (CANVAS_H - 2 * MARGIN_Y) / max_h)
    baseline = CANVAS_H - MARGIN_Y
    print('[layout] max', max_w, 'x', max_h, 'scale %.5f baseline %d' % (scale, baseline))

    composed = {}
    for name, img in frames.items():
        w = int(round(img.width * scale))
        h = int(round(img.height * scale))
        sc = resize_rgba_premul(img, (w, h))
        canvas = Image.new('RGBA', (CANVAS_W, CANVAS_H), (0, 0, 0, 0))
        x = int(round((CANVAS_W - w) / 2.0))
        y = baseline - h
        canvas.alpha_composite(sc, (x, y))
        # snap the alpha bbox to the shared feet baseline and exact centre
        arr = np.asarray(canvas)
        ys, xs = np.where(arr[..., 3] > 8)
        bb = (int(xs.min()), int(ys.min()), int(xs.max()) + 1, int(ys.max()) + 1)
        dx = CANVAS_W // 2 - (bb[0] + bb[2]) // 2
        dy = baseline - bb[3]
        if dx or dy:
            shifted = Image.new('RGBA', (CANVAS_W, CANVAS_H), (0, 0, 0, 0))
            shifted.alpha_composite(canvas, (dx, dy))
            canvas = shifted
            arr = np.asarray(canvas)
            ys, xs = np.where(arr[..., 3] > 8)
            bb = (int(xs.min()), int(ys.min()), int(xs.max()) + 1, int(ys.max()) + 1)
        composed[name] = canvas
        infos[name]['canvas_bbox'] = list(bb)
        infos[name]['canvas_bbox_w'] = bb[2] - bb[0]
        infos[name]['canvas_bbox_h'] = bb[3] - bb[1]
        infos[name]['paste'] = [x, y]
        print('[compose]', name, 'scaled', (w, h), 'paste', (x, y), '-> bbox', bb, 'shift', (dx, dy))

    # ---- closed eyes on the front frame -----------------------------------
    front = composed['front']
    closed, eye_info = close_eyes(front)
    composed['front_closed'] = closed
    infos['front_closed'] = dict(infos['front'])
    arr = np.asarray(closed)
    ys, xs = np.where(arr[..., 3] > 8)
    infos['front_closed']['canvas_bbox'] = [int(xs.min()), int(ys.min()), int(xs.max()) + 1, int(ys.max()) + 1]

    # ---- write sprites -----------------------------------------------------
    out_files = {
        'front': 'naiwa-front.png',
        'front_closed': 'naiwa-front-closed.png',
        'side': 'naiwa-side.png',
    }
    saved = {}
    final = {}
    for key, fname in out_files.items():
        p = os.path.join(ASSETS, fname)
        final[key] = save_png_clean(composed[key], p, sigma_r=12.0)
        saved[key] = os.path.getsize(p)
        print('[save] %-24s %8d bytes (%.1f KiB)' % (fname, saved[key], saved[key] / 1024.0))
        assert saved[key] <= 400 * 1024, '%s exceeds 400 KiB' % fname

    # ---- sprite.json -------------------------------------------------------
    all_bb = [infos[k]['canvas_bbox'] for k in out_files]
    meta = {
        'name': 'naiwa-pet sprites',
        'source': 'three-view reference (1536x1024); background removed per view with a border-seeded '
                  'flood fill (near-white / low-chroma) plus a soft chroma alpha ramp and colour unmix',
        'canvas': {'width': CANVAS_W, 'height': CANVAS_H},
        'subject_scale': round(float(scale), 5),
        'feet_baseline_y': baseline,
        'safe_margin_px': {
            'left': int(min(b[0] for b in all_bb)),
            'right': int(CANVAS_W - max(b[2] for b in all_bb)),
            'top': int(min(b[1] for b in all_bb)),
            'bottom': int(CANVAS_H - max(b[3] for b in all_bb)),
        },
        'frames': {},
    }
    for key, fname in out_files.items():
        i = infos[key]
        bb = i['canvas_bbox']
        entry = {
            'file': fname,
            'canvas': [CANVAS_W, CANVAS_H],
            'bbox': {'x': bb[0], 'y': bb[1], 'w': bb[2] - bb[0], 'h': bb[3] - bb[1]},
            'subject_height': bb[3] - bb[1],
            'feet_baseline_y': bb[3] - 1,
            'bytes': saved[key],
            'facing': 'left' if key == 'side' else 'front',
            'eyes_closed': key == 'front_closed',
        }
        if key in ('front', 'front_closed'):
            entry['eye_centers_px'] = [[round(c[0], 1), round(c[1], 1)] for c in eye_info['centers']]
            entry['eye_centers_pct'] = [[round(c[0] / CANVAS_W * 100, 2), round(c[1] / CANVAS_H * 100, 2)]
                                        for c in eye_info['centers']]
            entry['eye_boxes_px'] = [[int(v) for v in bx] for bx in eye_info['boxes']]
        meta['frames'][key] = entry
    with open(os.path.join(ASSETS, 'sprite.json'), 'w', encoding='utf-8') as f:
        json.dump(meta, f, indent=2, ensure_ascii=False)
        f.write('\n')
    print('[save] sprite.json')

    # ---- icon --------------------------------------------------------------
    make_icon(composed['front'])
    # ---- contact sheet -----------------------------------------------------
    make_contact_sheet(final)
    print('[done]')


# ---------------------------------------------------------------------------
# eyes
# ---------------------------------------------------------------------------
def detect_eyes(img):
    """Detect the two eyes in a composed front frame (RGBA)."""
    arr = np.asarray(img).astype(np.float32)
    r, g, b = arr[..., 0], arr[..., 1], arr[..., 2]
    lum = 0.299 * r + 0.587 * g + 0.114 * b
    mx = arr[..., :3].max(2); mn = arr[..., :3].min(2)
    chroma = mx - mn
    h, w = lum.shape
    body = arr[..., 3] > 200
    # search the upper part of the body, ignore the transparent surround
    band = np.zeros_like(lum, bool)
    band[: int(h * 0.62)] = True
    eye = band & body & ((lum < 115) | ((g > r + 8) & (b > r + 4) & (chroma > 28) & (lum < 215)))
    ys, xs = np.where(eye)
    comps = []
    visited = np.zeros(eye.shape, bool)
    for y, x in zip(ys, xs):
        if visited[y, x]:
            continue
        q = deque([(y, x)]); visited[y, x] = True
        pts = []
        while q:
            cy, cx = q.popleft(); pts.append((cy, cx))
            for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                ny, nx = cy + dy, cx + dx
                if 0 <= ny < h and 0 <= nx < w and eye[ny, nx] and not visited[ny, nx]:
                    visited[ny, nx] = True; q.append((ny, nx))
        if len(pts) > 400:
            pa = np.array(pts)
            comps.append((len(pts), pa[:, 1].min(), pa[:, 1].max(), pa[:, 0].min(), pa[:, 0].max()))
    # eyes are the two biggest compact blobs in the face band
    comps = [c for c in comps if (c[2] - c[1]) < 200 and (c[4] - c[3]) < 200]
    comps.sort(key=lambda c: -c[0])
    assert len(comps) >= 2, 'expected two eyes, got %r' % (comps,)
    comps = comps[:2]
    comps.sort(key=lambda c: c[1])
    boxes = []
    centers = []
    for size, ex0, ex1, ey0, ey1 in comps:
        boxes.append((ex0, ey0, ex1 - ex0 + 1, ey1 - ey0 + 1))
        centers.append(((ex0 + ex1) / 2.0, (ey0 + ey1) / 2.0))
    return boxes, centers, eye


def close_eyes(front):
    """Repaint the eyes as happy crescent lines; returns (image, info)."""
    w, h = front.size
    boxes, centers, _ = detect_eyes(front)
    print('[eyes] boxes', boxes, 'centers', [(round(float(c[0]), 1), round(float(c[1]), 1)) for c in centers])

    arr = np.asarray(front).astype(np.float32)
    rgb = arr[..., :3].copy()
    alpha = arr[..., 3]
    body = alpha > 200
    r_, g_, b_ = rgb[..., 0], rgb[..., 1], rgb[..., 2]
    chroma = rgb.max(2) - rgb.min(2)
    lum = 0.299 * r_ + 0.587 * g_ + 0.114 * b_
    skin = (chroma > 45) & (r_ >= g_ - 8) & (lum > 120)
    interior = _erode(body, 10)

    yy, xx = np.mgrid[0:h, 0:w]
    fill_mask = np.zeros_like(body)
    for (cx, cy), (bx, by, bw, bh) in zip(centers, boxes):
        ax, ay = bw / 2.0 + 16.0, bh / 2.0 + 16.0
        fill_mask |= (((xx - cx) / ax) ** 2 + ((yy - cy) / ay) ** 2 <= 1.0) & body
        print('[eyes] cover ellipse %.0fx%.0f at (%.0f,%.0f)' % (ax, ay, cx, cy))

    # ---- low frequency colour match: diffuse the surrounding skin in ------
    # the repaint has to carry the face's own shading (brighter above the eyes,
    # warmer/darker towards the cheeks) or it reads as a pasted sticker
    fill_rgb = rgb.copy()
    ring = skin & interior & ~fill_mask & (_dilate(fill_mask, 6))
    ring_col = np.median(rgb[ring], axis=0) if ring.any() else np.median(rgb[skin & interior], axis=0)
    fill_rgb[fill_mask] = ring_col
    for _ in range(70):
        blur = gblur(fill_rgb, 5.0)
        fill_rgb[fill_mask] = blur[fill_mask]
    fill_rgb = np.clip(fill_rgb, 0, 255)

    feather = gblur(fill_mask.astype(np.float32), 3.2)[..., None]
    rgb_out = rgb * (1 - feather) + fill_rgb * feather

    out = Image.fromarray(np.dstack([np.clip(rgb_out, 0, 255), alpha]).astype(np.uint8), 'RGBA')

    # --- crescents: dark warm brown, slightly raised tips -------------------
    SS = 4
    layer = Image.new('RGBA', (w * SS, h * SS), (0, 0, 0, 0))
    dr = ImageDraw.Draw(layer)
    line_col = (50, 43, 35, 255)  # #322b23
    for (cx, cy), (bx, by, bw, bh) in zip(centers, boxes):
        _draw_closed_eye(dr, cx, cy, bw, bh, SS, line_col)
    layer = layer.resize((w, h), Image.LANCZOS)
    out.alpha_composite(layer)
    out.save(os.path.join(DEBUG, 'closed_eyes_debug.png'))
    info = {'centers': centers, 'boxes': boxes}
    return out, info


def _draw_closed_eye(dr, cx, cy, bw, bh, SS, color):
    x0 = (cx - bw * 0.41) * SS
    x1 = (cx + bw * 0.41) * SS
    ybase = (cy + bh * 0.115) * SS
    arch = bh * 0.30 * SS
    tip_lift = bh * 0.055 * SS
    stroke = bw * 0.090 * SS
    n = 160
    for i in range(n + 1):
        t = i / n
        x = x0 + (x1 - x0) * t
        y = ybase - tip_lift - (arch - tip_lift) * np.sin(np.pi * t) ** 0.9
        r = stroke / 2.0 * (0.70 + 0.30 * np.sin(np.pi * t) ** 0.5)
        dr.ellipse([x - r, y - r, x + r, y + r], fill=color)


def _sample_mouth_colour(arr, eye_boxes):
    lum = 0.299 * arr[..., 0] + 0.587 * arr[..., 1] + 0.114 * arr[..., 2]
    h, w = lum.shape
    eye_bottom = max(by + bh for bx, by, bw, bh in eye_boxes)
    eye_h = max(bh for bx, by, bw, bh in eye_boxes)
    y_lo = max(0, eye_bottom - 4)
    y_hi = min(h, int(eye_bottom + eye_h * 0.55))
    mask = np.zeros_like(lum, bool)
    mask[y_lo:y_hi] = True
    mask &= (lum < 100) & (arr[..., 3] > 200)
    for bx, by, bw, bh in eye_boxes:
        mask[max(0, by - 6):by + bh + 6, max(0, bx - 6):bx + bw + 6] = False
    ys, xs = np.where(mask)
    if len(ys) < 20:
        return (74, 44, 20, 255)
    cols = arr[ys, xs][:, :3]
    med = np.median(cols, axis=0)
    return (int(med[0]), int(med[1]), int(med[2]), 255)


def _shift(mask, dy, dx, fill=False):
    out = np.full_like(mask, fill)
    h, w = mask.shape
    ys0, ys1 = max(0, dy), min(h, h + dy)
    xs0, xs1 = max(0, dx), min(w, w + dx)
    out[ys0:ys1, xs0:xs1] = mask[ys0 - dy:ys1 - dy, xs0 - dx:xs1 - dx]
    return out


def _dilate(mask, it=1):
    m = mask
    for _ in range(it):
        m = m | _shift(m, 1, 0) | _shift(m, -1, 0) | _shift(m, 0, 1) | _shift(m, 0, -1)
    return m


def _erode(mask, it=1):
    m = mask
    for _ in range(it):
        m = m & _shift(m, 1, 0) & _shift(m, -1, 0) & _shift(m, 0, 1) & _shift(m, 0, -1)
    return m


# ---------------------------------------------------------------------------
# icon + contact sheet
# ---------------------------------------------------------------------------
def make_icon(front):
    arr = np.asarray(front)
    a = arr[..., 3]
    ys, xs = np.where(a > 8)
    top = ys.min()
    boxes, centers, _ = detect_eyes(front)
    eye_bottom = max(by + bh for bx, by, bw, bh in boxes)
    eye_h = max(bh for bx, by, bw, bh in boxes)
    face_bottom = int(min(ys.max(), eye_bottom + eye_h * 0.85))  # just under the smile

    # head extent across the face rows (arms start far below this band)
    rows_l, rows_r = [], []
    for y in range(top, face_bottom):
        xs_row = np.where(a[y] > 8)[0]
        if len(xs_row):
            rows_l.append(xs_row.min()); rows_r.append(xs_row.max())
    if rows_l:
        l = int(np.percentile(rows_l, 20))
        r = int(np.percentile(rows_r, 80))
    else:
        l, r = xs.min(), xs.max()
    head_w = r - l + 1
    head_h = face_bottom - top
    side = int(round(max(head_w, head_h) * 1.08))
    # keep a little breathing room above the head, bias the crop downward
    cx = (l + r) / 2.0
    top_pad = side * 0.06
    box = (int(round(cx - side / 2)), int(round(top - top_pad)),
           int(round(cx + side / 2)), int(round(top - top_pad + side)))
    # clamp inside the canvas while keeping the square
    if box[0] < 0:
        box = (0, box[1], side, box[3])
    if box[2] > front.width:
        box = (front.width - side, box[1], front.width, box[3])
    if box[1] < 0:
        box = (box[0], 0, box[2], side)
    if box[3] > front.height:
        box = (box[0], front.height - side, box[2], front.height)
    print('[icon] head w/h', head_w, head_h, 'side', side, 'crop', box)
    icon = front.crop(box).resize((512, 512), Image.LANCZOS)
    p = os.path.join(ROOT, 'naiwa-pet', 'icon.png')
    save_png_clean(icon, p, sigma_r=8.0)
    print('[icon] bytes', os.path.getsize(p), '(%.1f KiB)' % (os.path.getsize(p) / 1024.0))
    assert os.path.getsize(p) < 256 * 1024, 'icon exceeds 256 KiB'


def make_contact_sheet(composed):
    order = [('front', 'naiwa-front.png'), ('front_closed', 'naiwa-front-closed.png'), ('side', 'naiwa-side.png')]
    fw = 168
    fh = int(round(fw * CANVAS_H / CANVAS_W))
    gap = 14
    pad = 18
    label_h = 20
    title_h = 30
    W = pad * 2 + fw * 3 + gap * 2
    row_h = fh + label_h + 12
    H = title_h + row_h * 2 + pad
    sheet = Image.new('RGB', (W, H), (127, 127, 127))
    dr = ImageDraw.Draw(sheet)
    font = _font(13)
    font_b = _font(14)
    # dark / light halves
    dr.rectangle([0, title_h - 4, W, title_h + row_h], fill=(31, 31, 31))
    dr.rectangle([0, title_h + row_h, W, H], fill=(255, 255, 255))
    dr.text((pad, 9), 'naiwa-pet sprites @ 168px wide  -  top row on #1f1f1f, bottom row on #ffffff',
            font=font, fill=(245, 245, 245))
    for row, (bg, txt_col) in enumerate([((31, 31, 31), (230, 230, 230)), ((255, 255, 255), (40, 40, 40))]):
        for col, (key, fname) in enumerate(order):
            img = composed[key].resize((fw, fh), Image.LANCZOS)
            x = pad + col * (fw + gap)
            y = title_h + row * row_h
            sheet.paste(img, (x, y), img)
            label = fname
            tw = dr.textlength(label, font=font)
            dr.text((x + (fw - tw) / 2, y + fh + 4), label, font=font, fill=txt_col)
    dr.rectangle([0, 0, W - 1, H - 1], outline=(90, 90, 90))
    p = os.path.join(ROOT, 'tools', 'contact-sheet.png')
    sheet.save(p, optimize=True)
    print('[contact-sheet]', W, 'x', H, os.path.getsize(p), 'bytes')


def _font(size):
    for cand in (r'C:\Windows\Fonts\segoeui.ttf', r'C:\Windows\Fonts\arial.ttf'):
        if os.path.exists(cand):
            return ImageFont.truetype(cand, size)
    return ImageFont.load_default()


if __name__ == '__main__':
    main()
