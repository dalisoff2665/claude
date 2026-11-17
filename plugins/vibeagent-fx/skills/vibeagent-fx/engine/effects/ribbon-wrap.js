// /ribbon-wrap — a ribbon of words wraps around you, passing behind and in front
import { seg, ease, lerp, W, H, C } from '../stage.js';
export default {
  init(S, o) {
    this.cv = S.canvas(); this.ctx = this.cv.getContext('2d');
    const text = (o.words || 'НАПИШИ «ЭФФЕКТ» • 20 СКИЛЛОВ ДЛЯ CLAUDE CODE • ');
    const mk = (bg, fg) => {
      const t = document.createElement('canvas'); const x = t.getContext('2d');
      x.font = '800 54px Onest'; const w = Math.ceil(x.measureText(text).width);
      t.width = w * 3; t.height = 92; const y = t.getContext('2d');
      y.fillStyle = bg; y.fillRect(0, 0, t.width, t.height);
      y.font = '800 54px Onest'; y.fillStyle = fg; y.textBaseline = 'middle';
      for (let i = 0; i < 3; i++) y.fillText(text, i * w, 48);
      y.fillStyle = 'rgba(255,255,255,.22)'; y.fillRect(0, 0, t.width, 3);
      t.unit = w; return t;
    };
    this.front = mk(C.indigo, '#fff'); this.back = mk('#3B0099', 'rgba(255,255,255,.75)');
  },
  async frame(S, k, p, f) {
    const c = this.ctx, h = S.head(f);
    const [img, cut] = await Promise.all([S.full(f), S.cut(f)]);
    c.drawImage(img, 0, 0);
    const grow = ease.out(seg(p, 0.0, 0.32)), gone = ease.in(seg(p, 0.78, 0.98));
    const turns = 2.1, th0 = -Math.PI * 0.5 + p * 2.4;
    const yTop = h.top + h.hw * 0.35, yBot = Math.min(H - 60, h.top + h.hw * 2.45);
    const N = 760, thMax = turns * Math.PI * 2;
    const scroll = p * 900;
    const slices = [];
    for (let i = 0; i < N; i++) {
      const u = i / N; if (u > grow || u < gone) continue;
      const th = th0 + u * thMax, dth = thMax / N;
      const y = lerp(yTop, yBot, u);
      const R = lerp(h.hw * 0.72, h.hw * 1.35, Math.pow(u, 0.8));
      const cs = Math.cos(th);
      slices.push({ x: h.cx + R * Math.sin(th), y, w: Math.abs(R * cs * dth) + 1.2, back: cs < 0, sx: (u * thMax * R * 0.9 + scroll) % this.front.unit, sw: R * dth * 0.9 });
    }
    const draw = (back) => {
      const src = back ? this.back : this.front;
      for (const s of slices) if (s.back === back) c.drawImage(src, s.sx, 0, Math.max(1, s.sw), 92, s.x - s.w / 2, s.y - 46, s.w, 92);
    };
    draw(true); c.drawImage(cut, 0, 0); draw(false);
  },
};
