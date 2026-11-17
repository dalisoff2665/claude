#!/usr/bin/env python3
"""Prepare a talking-head clip for the effects engine.

input.mp4 (9:16, any size) -> OUT/
  full/%05d.jpg   1080x1350 frames (top 4:5 crop of the 9:16 shot)
  cut/%05d.png    same frames, RGBA, person only (Robust Video Matting)
  audio.m4a       original audio
  meta.json       fps, frame count, per-frame head track
"""
import argparse, json, os, subprocess, sys
import cv2, numpy as np, onnxruntime as ort

W, H = 1080, 1350

ap = argparse.ArgumentParser()
ap.add_argument("src"); ap.add_argument("out")
ap.add_argument("--model", default=os.path.join(os.path.dirname(__file__), "..", "models", "rvm_mobilenetv3_fp32.onnx"))
ap.add_argument("--max-frames", type=int, default=0)
a = ap.parse_args()

os.makedirs(f"{a.out}/full", exist_ok=True)
os.makedirs(f"{a.out}/cut", exist_ok=True)

subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", a.src, "-vn", "-c:a", "aac", "-b:a", "192k", f"{a.out}/audio.m4a"], check=False)

cap = cv2.VideoCapture(a.src)
fps = cap.get(cv2.CAP_PROP_FPS) or 30
sw, sh = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH)), int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
# 4:5 window: tall clips keep full width (window near the top, where the head is);
# wide clips keep full height and take the centre
if sw / sh < W / H:
    crop_w, crop_h = sw, int(round(sw * H / W))
    crop_x, crop_y = 0, int((sh - crop_h) * 0.08)
else:
    crop_w, crop_h = int(round(sh * W / H)), sh
    crop_x, crop_y = (sw - crop_w) // 2, 0

sess = ort.InferenceSession(a.model, providers=["CPUExecutionProvider"])
rec = [np.zeros((1, 1, 1, 1), np.float32)] * 4
ds = np.array([0.4], np.float32)

heads = []
i = 0
while True:
    ok, fr = cap.read()
    if not ok:
        break
    fr = fr[crop_y:crop_y + crop_h, crop_x:crop_x + crop_w]
    src = cv2.cvtColor(fr, cv2.COLOR_BGR2RGB).astype(np.float32) / 255.0
    inp = src.transpose(2, 0, 1)[None]
    fgr, pha, *rec = sess.run(None, {"src": inp, "r1i": rec[0], "r2i": rec[1], "r3i": rec[2], "r4i": rec[3], "downsample_ratio": ds})
    alpha = pha[0, 0]
    big = cv2.resize(fr, (W, H), interpolation=cv2.INTER_LANCZOS4)
    blur = cv2.GaussianBlur(big, (0, 0), 1.2)
    big = cv2.addWeighted(big, 1.35, blur, -0.35, 0)  # light unsharp after upscale
    al = cv2.resize(alpha, (W, H), interpolation=cv2.INTER_LINEAR)
    al = np.clip((al - 0.04) / 0.92, 0, 1)
    cv2.imwrite(f"{a.out}/full/{i:05d}.jpg", big, [cv2.IMWRITE_JPEG_QUALITY, 93])
    rgba = np.dstack([big, (al * 255).astype(np.uint8)])
    cv2.imwrite(f"{a.out}/cut/{i:05d}.png", rgba, [cv2.IMWRITE_PNG_COMPRESSION, 1])

    # head track: topmost person row near the centre, head centre x, head width
    m = al > 0.5
    cols = m[:, int(W * 0.15):int(W * 0.85)]
    rows = np.where(cols.any(axis=1))[0]
    if len(rows):
        top = int(rows[0])
        band = m[top:top + int(H * 0.16)]
        ys, xs = np.nonzero(band)
        cx = float(xs.mean()) if len(xs) else W / 2
        hw = float(np.percentile(xs, 95) - np.percentile(xs, 5)) if len(xs) else 300
    else:
        top, cx, hw = int(H * 0.18), W / 2, 300.0
    heads.append([top, cx, hw])
    i += 1
    if i % 100 == 0:
        print(f"{i} frames", file=sys.stderr, flush=True)
    if a.max_frames and i >= a.max_frames:
        break

h = np.array(heads, np.float32)
k = 9
pad = np.pad(h, ((k // 2, k // 2), (0, 0)), mode="edge")
sm = np.stack([pad[j:j + len(h)] for j in range(k)]).mean(0)
track = [{"top": round(float(t), 1), "cx": round(float(x), 1), "hw": round(float(w), 1),
          "fy": round(float(t + w * 0.62), 1)} for t, x, w in sm]
json.dump({"fps": fps, "n": i, "w": W, "h": H, "head": track}, open(f"{a.out}/meta.json", "w"))
print(json.dumps({"fps": fps, "n": i, "src": [sw, sh], "crop_h": crop_h, "head0": track[0] if track else None}))
