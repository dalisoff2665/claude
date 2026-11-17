// /phone-fan — your shot slides into a phone and four more phones fan out like a hand of cards
import { seg, ease, lerp, W, H, C } from '../stage.js';
const PW = 380, PH = 800, SCRW = 352, SCRH = 772, PX = 540, PY = 700;   // phone centre (final)
const ANG = [-30, -15, 15, 30];
function ui(alt) {
  const L = (w, h = 14, c = '#E7E5EF', m = 10) => `<div style="height:${h}px;width:${w}%;border-radius:${h / 2}px;background:${c};margin-top:${m}px"></div>`;
  return `<div style="position:absolute;inset:0;background:#fff;padding:64px 26px 0">
    <div style="height:${alt ? 200 : 260}px;border-radius:26px;background:linear-gradient(135deg,${alt ? '#EFE7FF,#C9A7FF' : '#6200FF,#B48CFF'})"></div>
    ${L(70, 22, '#D9D6E6', 24)}${L(92)}${L(80)}${L(60)}
    <div style="display:flex;gap:12px;margin-top:22px"><div style="flex:1;height:120px;border-radius:20px;background:#F0EEF6"></div><div style="flex:1;height:120px;border-radius:20px;background:#F0EEF6"></div></div>
    ${L(85, 14, '#E7E5EF', 22)}${L(55)}</div>`;
}
export default {
  init(S) {
    S.paper();
    this.g = S.el('div', `position:absolute;inset:0;transform-origin:${PX}px ${PY}px`);
    const phone = (inner, z) => {
      const p = S.el('div', `position:absolute;left:${PX - PW / 2}px;top:${PY - PH / 2}px;width:${PW}px;height:${PH}px;border-radius:62px;background:#0E0B1F;
        box-shadow:0 0 0 3px #CFD2DA,0 34px 70px rgba(14,11,31,.28);transform-origin:50% 160%;z-index:${z}`, this.g);
      const scr = S.el('div', `position:absolute;left:14px;top:14px;width:${SCRW}px;height:${SCRH}px;border-radius:50px;overflow:hidden;background:#000`, p, inner || '');
      S.el('div', `position:absolute;left:50%;top:28px;width:110px;height:32px;margin-left:-55px;border-radius:16px;background:#0E0B1F;z-index:3`, p);
      return { p, scr };
    };
    this.side = ANG.map((a, i) => ({ a, ...phone(ui(i % 2), i < 2 ? 1 + i : 4 - i) }));
    const c = phone('', 5); this.center = c.p;
    this.scr = S.canvas('', c.scr, SCRW, SCRH);
    this.ff = S.canvas('');
  },
  async frame(S, k, p, f) {
    const img = await S.full(f), h = S.head(f);
    const cw = H * SCRW / SCRH, x0 = Math.max(0, Math.min(W - cw, h.cx - cw / 2));
    this.scr.getContext('2d').drawImage(img, x0, 0, cw, H, 0, 0, SCRW, SCRH);
    this.ff.getContext('2d').drawImage(img, 0, 0);
    const out = ease.expoIo(seg(p, 0.0, 0.26)) * (1 - ease.expoIo(seg(p, 0.76, 1.0)));
    const z0 = H / SCRH, z = Math.exp(lerp(Math.log(z0), 0, out));
    const scx = x0 + cw / 2;          // where the screen centre sits in the frame at the start
    const X = lerp(scx, PX, out), Y = lerp(H / 2, PY + 0, out);
    // screen centre in final layout is (PX, PY); at start it must sit on (scx, H/2)
    this.g.style.transform = `translate(${X - PX}px,${Y - PY}px) scale(${z})`;
    this.ff.style.transformOrigin = `${scx}px ${H / 2}px`;
    this.ff.style.transform = `translate(${X - scx}px,${Y - H / 2}px) scale(${z / z0})`;
    this.ff.style.opacity = 1 - ease.io(seg(out, 0, 0.3));
    const fan = ease.back(seg(p, 0.2, 0.44)) * (1 - ease.io(seg(p, 0.72, 0.86)));
    for (const s of this.side) {
      s.p.style.transform = `rotate(${s.a * fan + Math.sin(p * 9) * 1.2 * fan}deg) translateY(${-20 * fan}px)`;
      s.p.style.opacity = fan > 0.01 ? 1 : 0;
    }
  },
};
