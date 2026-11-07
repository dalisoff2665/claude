// /head-pop-out — your shot becomes a post in the feed and your head pops out of it
import { seg, ease, lerp, env, W, H, C } from '../stage.js';
const M = { x: 150, y: 560, w: 780, h: 585 };   // media area of the post card (final)
export default {
  init(S) {
    S.paper();
    this.g = S.el('div', `position:absolute;inset:0;transform-origin:540px 760px`);
    S.el('div', `position:absolute;left:${M.x}px;top:${M.y - 104}px;width:${M.w}px;height:${M.h + 104 + 96}px;border-radius:34px;background:#fff;box-shadow:0 40px 90px rgba(14,11,31,.18)`, this.g,
      `<div style="height:104px;display:flex;align-items:center;gap:16px;padding:0 26px">
        <span style="width:58px;height:58px;border-radius:50%;padding:3px;background:${C.indigo}"><span style="display:block;width:100%;height:100%;border-radius:50%;background:#D8D2EA;border:3px solid #fff"></span></span>
        <span style="font:700 26px Onest;color:${C.ink}">alisovdaniel</span><span style="margin-left:auto;font:800 28px Onest;color:#9C98AE;letter-spacing:2px">···</span></div>
      <div style="position:absolute;left:0;top:${104 + M.h}px;height:96px;width:100%;display:flex;align-items:center;gap:24px;padding:0 28px">
        <svg width="42" height="42" viewBox="0 0 24 24" fill="${C.indigo}" stroke="${C.indigo}" stroke-width="2"><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/></svg>
        <svg width="42" height="42" viewBox="0 0 24 24" fill="none" stroke="${C.ink}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z"/></svg>
        <svg width="42" height="42" viewBox="0 0 24 24" fill="none" stroke="${C.ink}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/></svg>
        <span style="margin-left:auto;font:600 22px Onest;color:#6B6880">«ЭФФЕКТ» в комментах</span></div>`);
    this.media = S.canvas(`left:${M.x}px;top:${M.y}px;width:${M.w}px;height:${M.h}px`, this.g, M.w, M.h);
    this.pop = S.canvas('', this.g); this.pc = this.pop.getContext('2d');
    this.tmp = document.createElement('canvas'); this.tmp.width = W; this.tmp.height = H;
    this.ff = S.canvas('');
  },
  async frame(S, k, p, f) {
    const h = S.head(f);
    const [img, cut] = await Promise.all([S.full(f), S.cut(f)]);
    const k2 = M.w / W, srcH = M.h / k2, y0 = Math.max(0, Math.min(H - srcH, h.top + h.hw * 0.42));
    this.media.getContext('2d').drawImage(img, 0, y0, W, srcH, 0, 0, M.w, M.h);
    const card = ease.io(seg(p, 0.0, 0.22)) * (1 - ease.io(seg(p, 0.82, 1.0)));
    const pop = ease.back(seg(p, 0.24, 0.44)) * (1 - ease.in(seg(p, 0.7, 0.84)));
    // cutout mapped into the card, scaled up and lifted when it pops
    const t = this.tmp.getContext('2d'); t.clearRect(0, 0, W, H);
    const s = k2 * (1 + 0.16 * pop), chinY = h.top + h.hw * 1.25;
    const ax = M.x + (h.cx) * k2, ay = M.y + (chinY - y0) * k2;
    t.save(); t.translate(ax, ay - 70 * pop); t.scale(s, s); t.translate(-h.cx, -chinY); t.drawImage(cut, 0, 0); t.restore();
    t.globalCompositeOperation = 'destination-in';
    const fadeA = M.y + M.h * 0.52, fadeB = M.y + M.h * 0.7;
    const gr = t.createLinearGradient(0, fadeA, 0, fadeB); gr.addColorStop(0, 'rgba(0,0,0,1)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
    t.fillStyle = gr; t.fillRect(0, 0, W, H); t.globalCompositeOperation = 'source-over';
    this.pc.clearRect(0, 0, W, H); this.pc.globalAlpha = pop > 0.01 ? 1 : 0; this.pc.drawImage(this.tmp, 0, 0);
    this.g.style.transform = `scale(${lerp(1.25, 1, card)})`;
    this.g.style.opacity = card;
    const ff = this.ff.getContext('2d'); ff.drawImage(img, 0, 0);
    this.ff.style.opacity = 1 - card; this.ff.style.transform = `scale(${lerp(1, 0.8, card)})`;
  },
};
