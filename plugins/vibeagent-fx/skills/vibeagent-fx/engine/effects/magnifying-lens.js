// /magnifying-lens — a glass disc slides across the shot and magnifies what is under it
import { seg, ease, lerp } from '../stage.js';
const FRAG = `
uniform sampler2D img; uniform vec2 c; uniform float R; uniform float mag; uniform float on;
vec3 tap(vec2 q){ return texture(img, clamp(q,0.,1.)).rgb; }
void main(){
  vec2 px = uv*res; vec2 d = px - c; float r = length(d);
  vec3 col = tap(uv);
  // drop shadow under the disc
  float sh = smoothstep(R*1.18, R*0.92, length(px - c - vec2(18.,26.))) * 0.38 * on;
  col *= 1. - sh * step(R, r);
  if (r < R && on > 0.){
    float n = r / R;
    float k = 1. + 0.55*n*n;                 // barrel: stronger magnification in the centre
    vec2 q = c + d / (mag * (1.0/k) + 0.0001) * (1.0/k) ;
    q = c + d / mag * k;
    float ca = 0.010 * n*n*n;
    vec2 qu = q/res; vec2 dir = normalize(d+1e-4);
    vec3 g = vec3(tap(qu + dir*ca).r, tap(qu).g, tap(qu - dir*ca).b);
    g = g*1.04 + 0.02;
    float rim = smoothstep(0.90, 0.985, n) * (1. - smoothstep(0.985, 1.0, n));
    float spec = pow(max(0., dot(normalize(d+1e-4), normalize(vec2(-0.7,-0.7)))), 6.) * smoothstep(0.55,0.95,n) * 0.45;
    g = mix(g, vec3(1.), rim*0.85 + spec);
    float edge = smoothstep(R, R-2., r);
    col = mix(col, g, edge * on);
  }
  o = vec4(col,1.);
}`;
export default {
  init(S) { this.g = S.shader(FRAG); },
  async frame(S, k, p, f) {
    const h = S.head(f);
    const q = ease.io(seg(p, 0.0, 1.0));
    // right edge -> face -> lower left
    const P = [[1340, 1150], [h.cx + 40, h.fy - 10], [h.cx - 40, h.fy + 10], [-260, 900]];
    let x, y;
    if (q < 0.35) { const t = ease.out(q / 0.35); x = lerp(P[0][0], P[1][0], t); y = lerp(P[0][1], P[1][1], t); }
    else if (q < 0.7) { const t = ease.sine((q - 0.35) / 0.35); x = lerp(P[1][0], P[2][0], t); y = lerp(P[1][1], P[2][1], t); }
    else { const t = ease.in((q - 0.7) / 0.3); x = lerp(P[2][0], P[3][0], t); y = lerp(P[2][1], P[3][1], t); }
    this.g.tex('img', await S.full(f)).set('c', [x, y]).set('R', 250).set('mag', 1.85).set('on', 1).draw();
  },
};
