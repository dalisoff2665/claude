// /spotlight — the room goes dark, one theatre light searches and finds your face
import { env, seg, ease, lerp, W, H } from '../stage.js';
export default {
  init(S) {
    this.cv = S.canvas(); this.ctx = this.cv.getContext('2d');
    this.dk = document.createElement('canvas'); this.dk.width = W; this.dk.height = H;
  },
  async frame(S, k, p, f) {
    const c = this.ctx, d = this.dk.getContext('2d'), h = S.head(f);
    c.filter = 'none'; c.drawImage(await S.full(f), 0, 0);
    const dark = env(p, 0, 0.12, 0.84, 0.98);
    if (dark <= 0) return;
    // path: enters top-left, sweeps right, lands on the face
    const face = [h.cx, h.fy - 20];
    const q = ease.io(seg(p, 0.08, 0.62));
    const pts = [[-200, 160], [880, 260], [300, 760], face];
    const bz = (t) => { const u = 1 - t; return [0, 1].map(i => u*u*u*pts[0][i] + 3*u*u*t*pts[1][i] + 3*u*t*t*pts[2][i] + t*t*t*pts[3][i]); };
    const [x, y] = bz(q);
    const r = lerp(260, h.hw * 0.95, ease.out(seg(p, 0.55, 0.75))) * (1 + 0.04 * Math.sin(p * 30));
    d.clearRect(0, 0, W, H);
    d.globalCompositeOperation = 'source-over';
    d.fillStyle = `rgba(4,3,10,${0.9 * dark})`; d.fillRect(0, 0, W, H);
    d.globalCompositeOperation = 'destination-out';
    const g = d.createRadialGradient(x, y, r * 0.35, x, y, r);
    g.addColorStop(0, 'rgba(0,0,0,1)'); g.addColorStop(0.7, 'rgba(0,0,0,.85)'); g.addColorStop(1, 'rgba(0,0,0,0)');
    d.fillStyle = g; d.beginPath(); d.arc(x, y, r, 0, Math.PI * 2); d.fill();
    c.drawImage(this.dk, 0, 0);
    // soft beam from the top
    c.save(); c.globalCompositeOperation = 'screen';
    const src = [lerp(200, 640, q), -60];
    const ang = Math.atan2(y - src[1], x - src[0]);
    const nx = -Math.sin(ang), ny = Math.cos(ang);
    const bg = c.createLinearGradient(src[0], src[1], x, y);
    bg.addColorStop(0, `rgba(255,255,255,${0.18 * dark})`); bg.addColorStop(1, `rgba(255,255,255,${0.03 * dark})`);
    c.fillStyle = bg; c.beginPath();
    c.moveTo(src[0] + nx * 26, src[1] + ny * 26); c.lineTo(src[0] - nx * 26, src[1] - ny * 26);
    c.lineTo(x - nx * r * 0.9, y - ny * r * 0.9); c.lineTo(x + nx * r * 0.9, y + ny * r * 0.9); c.closePath(); c.fill();
    // dust in the beam
    for (let i = 0; i < 40; i++) {
      const t = (i * 0.618 + p * 0.6) % 1, w = ((i * 0.37) % 1) - 0.5;
      const px = lerp(src[0], x, t) + nx * w * r * 1.6 * t, py = lerp(src[1], y, t) + ny * w * r * 1.6 * t;
      c.fillStyle = `rgba(255,255,255,${0.35 * dark * (0.4 + 0.6 * ((i * 0.21) % 1))})`;
      c.fillRect(px, py, 2.2, 2.2);
    }
    c.restore();
  },
};
