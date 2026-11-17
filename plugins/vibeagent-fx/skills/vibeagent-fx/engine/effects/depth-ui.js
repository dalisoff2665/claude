// /depth-ui — app windows float around you, some behind, some in front
import { seg, ease, lerp, env, W, H, C } from '../stage.js';
const mono = `font-family:'JetBrains Mono',monospace`;
export default {
  init(S) {
    this.bg = S.canvas(); this.bgc = this.bg.getContext('2d');
    const back = S.el('div', `position:absolute;inset:0;perspective:1600px`);
    this.cut = S.canvas(); this.cc = this.cut.getContext('2d');
    const front = S.el('div', `position:absolute;inset:0;perspective:1600px`);
    const card = (parent, css, html) => S.el('div', `position:absolute;border-radius:26px;box-shadow:0 30px 70px rgba(0,0,0,.35);overflow:hidden;` + css, parent, html);
    this.w = [
      { el: card(back, `left:36px;top:200px;width:440px;background:#0E0B1F;color:#E9E6F7;${mono};font-size:21px;line-height:1.7;padding:0 0 24px`,
        `<div style="height:46px;display:flex;align-items:center;gap:9px;padding:0 20px;background:#1B1730"><i style="width:12px;height:12px;border-radius:50%;background:#4A4560"></i><i style="width:12px;height:12px;border-radius:50%;background:#4A4560"></i><i style="width:12px;height:12px;border-radius:50%;background:#4A4560"></i><span style="margin-left:10px;font-size:17px;color:#8E89A8">claude code</span></div>
         <div style="padding:16px 24px 0">$ claude<br><span style="color:${C.lav}">›</span> /depth-ui avatar.mp4<br><span style="color:#8E89A8">✓ лицо и фон найдены</span><br><span style="color:#8E89A8">✓ сцена 1080×1350</span>
         <div style="margin-top:14px;height:10px;border-radius:6px;background:#2A2540;overflow:hidden"><b class="pb" style="display:block;height:100%;width:30%;background:${C.indigo}"></b></div></div>`),
        rx: 14, ry: 16, z: -120, t: 0.04, side: -1 },
      { el: card(back, `left:620px;top:120px;width:420px;background:#fff;color:${C.ink};padding:22px 24px 26px;font-size:24px`,
        `<div style="display:flex;align-items:center;gap:10px;font:700 24px Onest"><span style="width:30px;height:30px;border-radius:9px;background:${C.ink};color:#fff;font-size:18px;display:grid;place-items:center">C</span>Claude</div>
         <div style="margin:18px 0 0 auto;width:fit-content;max-width:300px;background:#EFE7FF;border-radius:20px 20px 6px 20px;padding:12px 18px;font:500 22px/1.35 Onest">Собери рилс из одного дубля</div>
         <div style="margin-top:16px;height:14px;border-radius:7px;background:#ECEBF3;width:88%"></div><div style="margin-top:10px;height:14px;border-radius:7px;background:#ECEBF3;width:64%"></div>`),
        rx: 10, ry: -18, z: -60, t: 0.1, side: 1 },
      { el: card(front, `left:560px;top:1000px;width:440px;height:104px;border-radius:52px;background:rgba(255,255,255,.96);display:flex;align-items:center;gap:18px;padding:0 26px;font:700 26px Onest;color:${C.ink}`,
        `<span style="width:56px;height:56px;border-radius:50%;background:${C.indigo};display:grid;place-items:center"><svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg></span>
         <span>Ролик готов<br><span style="font:500 20px Onest;color:#6B6880">экспорт · 12 сек</span></span>`),
        rx: -8, ry: -14, z: 80, t: 0.18, side: 1 },
      { el: card(front, `left:40px;top:930px;width:330px;background:#fff;padding:20px 22px;font:700 22px Onest;color:${C.ink}`,
        `<div>Скиллы · 20</div><div style="display:flex;flex-wrap:wrap;gap:8px;margin-top:14px;${mono};font-size:17px;font-weight:500">
          <span style="padding:6px 12px;border-radius:20px;background:#EFE7FF;color:${C.indigo}">/portal</span><span style="padding:6px 12px;border-radius:20px;background:#ECEBF3">/shatter</span>
          <span style="padding:6px 12px;border-radius:20px;background:#ECEBF3">/grid-dive</span><span style="padding:6px 12px;border-radius:20px;background:#ECEBF3">/clone-room</span></div>`),
        rx: -10, ry: 16, z: 40, t: 0.14, side: -1 },
    ];
    this.pb = this.w[0].el.querySelector('.pb');
  },
  async frame(S, k, p, f) {
    const [img, cut] = await Promise.all([S.full(f), S.cut(f)]);
    const dim = env(p, 0.0, 0.2, 0.8, 1.0);
    this.bgc.filter = `brightness(${1 - 0.28 * dim}) blur(${3 * dim}px)`; this.bgc.drawImage(img, 0, 0);
    this.cc.clearRect(0, 0, W, H); this.cc.drawImage(cut, 0, 0);
    this.pb.style.width = `${Math.round(30 + 70 * seg(p, 0.15, 0.6))}%`;
    for (const w of this.w) {
      const a = ease.back(seg(p, w.t, w.t + 0.22)), b = ease.in(seg(p, 0.76 + w.t * 0.4, 0.94 + w.t * 0.3));
      const v = a * (1 - b), fl = Math.sin((p + w.t) * Math.PI * 2.2) * 10;
      w.el.style.opacity = Math.min(1, v * 1.4);
      w.el.style.transform = `translate3d(${w.side * (1 - v) * 160}px,${(1 - v) * 60 + fl}px,${w.z}px) rotateX(${w.rx * 0.4}deg) rotateY(${w.ry}deg) scale(${0.85 + 0.15 * v})`;
    }
  },
};
