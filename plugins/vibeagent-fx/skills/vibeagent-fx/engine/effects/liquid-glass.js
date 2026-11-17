// /liquid-glass — a drop of glass lands and stretches into a glass tab bar, then melts away
import { seg, ease, lerp, env, W, H, C } from '../stage.js';
const FRAG = `
uniform sampler2D img; uniform vec2 c; uniform vec2 hb; uniform float rr; uniform float on;
float sd(vec2 p){ vec2 q = abs(p - c) - hb + rr; return length(max(q,0.)) + min(max(q.x,q.y),0.) - rr; }
vec3 tap(vec2 q){ return texture(img, clamp(q/res,0.,1.)).rgb; }
void main(){
  vec2 px = uv*res; vec3 col = tap(px);
  float d = sd(px);
  // soft contact shadow
  float sh = (1. - smoothstep(-4., 46., sd(px - vec2(0., 18.)))) * 0.32 * on;
  col *= 1. - sh * step(0., d);
  if (d < 0. && on > 0.){
    vec2 e = vec2(1.5, 0.);
    vec2 n = normalize(vec2(sd(px+e.xy)-sd(px-e.xy), sd(px+e.yx)-sd(px-e.yx)) + 1e-5);
    float th = min(hb.y, 46.);
    float edge = 1. - clamp(-d / th, 0., 1.);
    vec2 q = c + (px - c) * 0.9 - n * pow(edge, 2.2) * 38.;
    vec3 g = vec3(0.);
    for (int i=-2;i<=2;i++) for (int j=-2;j<=2;j++) g += tap(q + vec2(float(i),float(j))*2.4);
    g /= 25.;
    g = mix(g, vec3(1.), 0.34);                         // frosted, light
    float rim = smoothstep(-3.5, -0.5, d) * (1. - smoothstep(-0.5, 0., d));
    float top = clamp(-n.y, 0., 1.);
    g += rim * (0.55 + 0.45*top);
    g += smoothstep(-th, -th*0.2, d) * top * 0.12;       // upper inner sheen
    col = mix(col, g, smoothstep(0., -1.5, d) * on);
  }
  o = vec4(col, 1.);
}`;
const ICONS = [
  '<path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>',
  '<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>',
  '<polygon points="6 3 20 12 6 21 6 3"/>',
  '<path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>',
];
export default {
  init(S) {
    this.g = S.shader(FRAG);
    this.bar = S.el('div', `position:absolute;left:0;top:0;width:${W}px;height:${H}px;pointer-events:none`);
    this.icons = ICONS.map((d, i) => S.el('div', `position:absolute;width:60px;height:60px;margin:-30px 0 0 -30px`, this.bar,
      `<svg viewBox="0 0 24 24" width="60" height="60" fill="none" stroke="${i === 2 ? C.indigo : C.ink}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${d}</svg>`));
  },
  async frame(S, k, p, f) {
    const cy = 1110, cx = 540;
    const drop = ease.out(seg(p, 0.0, 0.14));
    const stretch = ease.back(seg(p, 0.13, 0.34)) * (1 - ease.io(seg(p, 0.74, 0.88)));
    const melt = 1 - ease.in(seg(p, 0.86, 0.98));
    const r0 = 74 * drop * melt;
    const hx = lerp(r0, 400, stretch), hy = lerp(r0, 84, stretch);
    const y = lerp(820, cy, drop);
    this.g.tex('img', await S.full(f)).set('c', [cx, y]).set('hb', [Math.max(hx, 0.1), Math.max(hy, 0.1)]).set('rr', Math.max(Math.min(hx, hy), 0.1)).set('on', r0 > 0.5 ? 1 : 0).draw();
    const ia = env(p, 0.26, 0.36, 0.7, 0.8);
    this.icons.forEach((e, i) => {
      const x = cx + (i - 1.5) * 190 * Math.max(stretch, 0.001);
      e.style.left = `${x}px`; e.style.top = `${y}px`; e.style.opacity = ia;
      e.style.transform = `scale(${0.7 + 0.3 * ia})`;
    });
  },
};
