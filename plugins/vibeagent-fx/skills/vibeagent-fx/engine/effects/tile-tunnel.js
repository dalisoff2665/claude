// /tile-tunnel — the room behind you opens into a moving tunnel of tiles
import { seg, ease, lerp } from '../stage.js';
const FRAG = `
uniform sampler2D img; uniform vec2 vp; uniform float rr; uniform float mv;
float h21(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7)))*43758.5453); }
void main(){
  vec2 px = uv*res; vec3 frame = texture(img, uv).rgb;
  vec2 p = (px - vp) / res.y;
  float ax = abs(p.x), ay = abs(p.y);
  float m = max(ax, ay*1.0);
  float z = 0.16 / max(m, 1e-3);
  float a = ax > ay ? p.y/ax : p.x/ay;
  float wall = ax > ay ? (p.x > 0. ? 0. : 1.) : (p.y > 0. ? 2. : 3.);
  vec2 cell = vec2(a*3.0, z*2.2 + mv);
  vec2 id = floor(cell) + wall*17.;
  vec2 f = fract(cell);
  float gap = smoothstep(0.0, 0.04, f.x)*smoothstep(1.0, 0.96, f.x)*smoothstep(0.0, 0.04, f.y)*smoothstep(1.0, 0.96, f.y);
  float chk = mod(floor(cell.x)+floor(cell.y), 2.);
  vec3 tile = mix(vec3(1.0), vec3(0.925,0.922,0.953), chk);
  float hr = h21(id);
  if (hr > 0.975) tile = vec3(0.384, 0.0, 1.0);
  else if (hr > 0.93) tile = vec3(0.79, 0.66, 1.0);
  tile *= mix(0.86, 1.0, gap);
  tile *= (wall > 1.5) ? 0.93 : 1.0;
  float fog = smoothstep(0.6, 6.0, z);
  vec3 tun = mix(tile, vec3(0.965,0.961,0.98), fog);
  float reveal = smoothstep(rr, rr - 60., length(px - vp));
  o = vec4(mix(frame, tun, reveal), 1.);
}`;
export default {
  init(S) { this.g = S.shader(FRAG); this.cut = S.canvas(); this.cc = this.cut.getContext('2d'); },
  async frame(S, k, p, f) {
    const h = S.head(f);
    const rr = lerp(0, 1900, ease.io(seg(p, 0.0, 0.3))) * (1 - ease.io(seg(p, 0.74, 0.98)));
    this.g.tex('img', await S.full(f)).set('vp', [h.cx, h.fy]).set('rr', rr).set('mv', -p * 7.0).draw();
    this.cc.clearRect(0, 0, 1080, 1350); this.cc.drawImage(await S.cut(f), 0, 0);
  },
};
