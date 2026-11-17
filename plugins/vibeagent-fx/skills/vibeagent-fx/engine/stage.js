// Stage helpers shared by every effect. One effect = one ES module in ./effects/<name>.js
// exporting { init(S, opts), frame(S, k, p, f) } — k local frame, p progress 0..1, f source frame.
export const W = 1080, H = 1350;
export const C = { ink: '#0E0B1F', indigo: '#6200FF', lav: '#C9A7FF', silver: '#D9DCE3', paper: '#F6F5FA', white: '#FFFFFF' };

export const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
export const lerp = (a, b, t) => a + (b - a) * t;
export const seg = (p, a, b) => clamp((p - a) / (b - a)); // 0..1 inside [a,b]
export const ease = {
  in: t => t * t * t,
  out: t => 1 - Math.pow(1 - t, 3),
  io: t => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
  expoIo: t => (t === 0 ? 0 : t === 1 ? 1 : t < 0.5 ? Math.pow(2, 20 * t - 10) / 2 : (2 - Math.pow(2, -20 * t + 10)) / 2),
  back: t => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); },
  sine: t => -(Math.cos(Math.PI * t) - 1) / 2,
};
// in-hold-out envelope: rises over [a,b], holds, falls over [c,d]
export const env = (p, a, b, c, d, e = ease.io) => (p < b ? e(seg(p, a, b)) : p < c ? 1 : 1 - e(seg(p, c, d)));
export const rand = (s => () => ((s = Math.imul(48271, s) % 2147483647) & 0x7fffffff) / 2147483647)(7);
export function rng(seed) { let s = seed % 2147483647 || 1; return () => (s = (s * 16807) % 2147483647) / 2147483647; }

const cache = new Map();
const order = [];
async function load(url) {
  if (cache.has(url)) return cache.get(url);
  const pr = fetch(url).then(r => r.blob()).then(b => createImageBitmap(b));
  cache.set(url, pr); order.push(url);
  while (order.length > 260) { const u = order.shift(); const v = cache.get(u); cache.delete(u); v.then(b => b.close && b.close()); }
  return pr;
}

export function makeStage(meta, work) {
  const root = document.getElementById('stage');
  const S = {
    W, H, C, meta, fps: meta.fps, n: meta.n, root,
    fi: f => Math.max(0, Math.min(meta.n - 1, Math.round(f))),
    full: f => load(`/${work}/full/${String(S.fi(f)).padStart(5, '0')}.jpg`),
    cut: f => load(`/${work}/cut/${String(S.fi(f)).padStart(5, '0')}.png`),
    head: f => meta.head[S.fi(f)],
    clear() { root.innerHTML = ''; root.style.background = '#000'; },
    el(tag, css = '', parent = root, html = '') {
      const e = document.createElement(tag); e.style.cssText = css; if (html) e.innerHTML = html; parent.appendChild(e); return e;
    },
    canvas(css = '', parent = root, w = W, h = H) {
      const c = S.el('canvas', `position:absolute;left:0;top:0;width:${w}px;height:${h}px;` + css, parent);
      c.width = w; c.height = h; return c;
    },
    // light brand backdrop: paper + faint grid
    paper(parent = root, css = '') {
      return S.el('div', `position:absolute;inset:0;background-color:${C.paper};
        background-image:linear-gradient(rgba(14,11,31,.045) 1px,transparent 1px),linear-gradient(90deg,rgba(14,11,31,.045) 1px,transparent 1px);
        background-size:54px 54px;background-position:-1px -1px;` + css, parent);
    },
    shader(frag, css = '', parent = root, w = W, h = H) { return makeShader(S.canvas(css, parent, w, h), frag); },
  };
  return S;
}

// ---- minimal WebGL2 full-screen shader helper -------------------------------------------
const VERT = `#version 300 es
in vec2 p; out vec2 uv; void main(){ uv = p*.5+.5; uv.y = 1.-uv.y; gl_Position = vec4(p,0,1); }`;
export function makeShader(canvas, frag) {
  const gl = canvas.getContext('webgl2', { premultipliedAlpha: false, preserveDrawingBuffer: true, alpha: true });
  const sh = (t, s) => { const o = gl.createShader(t); gl.shaderSource(o, s); gl.compileShader(o);
    if (!gl.getShaderParameter(o, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(o) + '\n' + s); return o; };
  const pr = gl.createProgram();
  gl.attachShader(pr, sh(gl.VERTEX_SHADER, VERT));
  gl.attachShader(pr, sh(gl.FRAGMENT_SHADER, `#version 300 es
precision highp float; in vec2 uv; out vec4 o; uniform vec2 res; uniform float t;
` + frag));
  gl.linkProgram(pr); gl.useProgram(pr);
  const b = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, b);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const loc = gl.getAttribLocation(pr, 'p'); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
  const texs = {}; let unit = 0;
  const api = {
    canvas, gl,
    tex(name, img) {
      let t = texs[name];
      if (!t) { t = texs[name] = { id: gl.createTexture(), unit: unit++ };
        gl.activeTexture(gl.TEXTURE0 + t.unit); gl.bindTexture(gl.TEXTURE_2D, t.id);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE); }
      gl.activeTexture(gl.TEXTURE0 + t.unit); gl.bindTexture(gl.TEXTURE_2D, t.id);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
      gl.uniform1i(gl.getUniformLocation(pr, name), t.unit); return api;
    },
    set(name, v) {
      const l = gl.getUniformLocation(pr, name); if (l === null) return api;
      if (typeof v === 'number') gl.uniform1f(l, v);
      else if (v.length === 2) gl.uniform2f(l, ...v); else if (v.length === 3) gl.uniform3f(l, ...v); else if (v.length === 4) gl.uniform4f(l, ...v);
      return api;
    },
    draw() { gl.viewport(0, 0, canvas.width, canvas.height); api.set('res', [canvas.width, canvas.height]);
      gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT); gl.drawArrays(gl.TRIANGLES, 0, 3); return api; },
  };
  return api;
}

// draw an image covering a box with a given transform on a 2D context
export function drawCover(ctx, img, x = 0, y = 0, w = W, h = H) { ctx.drawImage(img, x, y, w, h); }
