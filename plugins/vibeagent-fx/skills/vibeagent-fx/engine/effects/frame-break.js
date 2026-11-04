// /frame-break — your shot becomes a framed photo and your head breaks out of it
import { seg, ease, lerp, env, rng, W, H, C } from '../stage.js';
export default {
  init(S) {
    S.paper();
    this.cv = S.canvas(); this.ctx = this.cv.getContext('2d');
    const r = rng(11);
    this.shards = Array.from({ length: 16 }, () => ({ u: r() * 2 - 1, vx: (r() * 2 - 1) * 520, vy: -260 - r() * 520, rot: (r() * 2 - 1) * 9, s: 14 + r() * 26, sh: r() }));
  },
  async frame(S, k, p, f) {
    const c = this.ctx, h = S.head(f);
    const [img, cut] = await Promise.all([S.full(f), S.cut(f)]);
    c.clearRect(0, 0, W, H);
    const e = ease.io(seg(p, 0.0, 0.26)) * (1 - ease.io(seg(p, 0.8, 1.0)));
    const yc = lerp(0, h.top + h.hw * 0.5, ease.io(seg(p, 0.06, 0.3)) * (1 - ease.io(seg(p, 0.78, 0.96))));
    const k2 = lerp(1, 0.68, e), rot = lerp(0, -5, e) * Math.PI / 180, bw = 24 * e;
    const cx = 540, cy = lerp(675, 790, e);
    const ax = 540, ay = (yc + H) / 2;               // centre of the visible crop in frame coords
    c.save(); c.translate(cx, cy); c.rotate(rot); c.scale(k2, k2); c.translate(-ax, -ay);
    const x0 = lerp(0, 50, e), x1 = lerp(W, W - 50, e);
    // photo: white border + soft shadow
    c.shadowColor = `rgba(14,11,31,${0.28 * e})`; c.shadowBlur = 60 * e; c.shadowOffsetY = 30 * e;
    c.fillStyle = '#fff'; c.fillRect(x0 - bw / k2, yc - bw / k2, x1 - x0 + 2 * bw / k2, H - yc + 2 * bw / k2);
    c.shadowColor = 'transparent';
    c.save(); c.beginPath(); c.rect(x0, yc, x1 - x0, H - yc); c.clip(); c.drawImage(img, 0, 0); c.restore();
    // the head breaks out: cutout over the border, same transform
    c.drawImage(cut, 0, 0);
    c.restore();
    // glass shards from the top edge
    const t = seg(p, 0.2, 0.62);
    if (t > 0 && t < 1) {
      const edgeY = cy + (yc - ay) * k2;
      for (const s of this.shards) {
        const sx = cx + s.u * h.hw * 0.75 * k2 + s.vx * t, sy = edgeY + s.vy * t + 900 * t * t;
        c.save(); c.translate(sx, sy); c.rotate(s.rot * t); c.globalAlpha = (1 - t) * 0.95;
        c.beginPath(); c.moveTo(0, -s.s); c.lineTo(s.s * 0.8, s.s * 0.6); c.lineTo(-s.s * 0.6, s.s * 0.4); c.closePath();
        c.fillStyle = s.sh > 0.5 ? 'rgba(255,255,255,.95)' : 'rgba(236,236,244,.9)'; c.fill();
        c.strokeStyle = 'rgba(14,11,31,.25)'; c.lineWidth = 1.2; c.stroke(); c.restore();
      }
    }
  },
};
