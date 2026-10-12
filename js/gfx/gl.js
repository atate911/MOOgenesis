// Shared WebGL2 core — OPTIONAL accelerator. Every GL renderer has a Canvas2D fallback with the same API; callers check
//   if (MOO.Gfx.GL.supported()) { …draw with GL… } else { …2D path… }        (supported() also honours Settings 'gpu' and Perf tier)
// Design: ONE shared offscreen WebGL canvas serves every renderer (browsers cap live contexts; planets/backdrops/particles all share it).
// A renderer does:   const g = GL.begin(w, h);  …draw with g.gl…;  GL.blit(ctx2d, dx, dy, dw, dh);   (blit in the SAME task as the draw)
(function (M) {
  'use strict';
  const GL = M.Gfx.GL = {};
  let canvas = null, gl = null, failed = false, curW = 0, curH = 0, quadVao = null;
  const programs = new Map();

  GL.supported = function () {
    if (failed) return false;
    if (typeof document === 'undefined') return false;
    if (M.Settings && M.Settings.get('gpu') === false) return false;
    if (M.Perf && M.Perf.q && M.Perf.q.gl === false) return false;
    return !!ensure();
  };
  function ensure() {
    if (gl && !gl.isContextLost()) return gl;
    if (failed) return null;
    try {
      canvas = document.createElement('canvas'); canvas.width = canvas.height = 2;
      gl = canvas.getContext('webgl2', { alpha: true, premultipliedAlpha: true, antialias: false, depth: false, stencil: false, preserveDrawingBuffer: false, powerPreference: 'high-performance' });
      if (!gl) { failed = true; return null; }
      canvas.addEventListener('webglcontextlost', e => { e.preventDefault(); programs.clear(); quadVao = null; });
      canvas.addEventListener('webglcontextrestored', () => { programs.clear(); quadVao = null; });
      gl.getExtension('EXT_color_buffer_float'); gl.getExtension('OES_texture_float_linear');
      const e = gl.getExtension('WEBGL_debug_renderer_info');
      GL.info = { renderer: e ? gl.getParameter(e.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER), maxTex: gl.getParameter(gl.MAX_TEXTURE_SIZE), floatRT: !!gl.getExtension('EXT_color_buffer_float') };
      M.HW.gpu = M.HW.gpu || GL.info.renderer; M.HW.webgl2 = true;
      return gl;
    } catch (err) { console.warn('[GL] init failed', err); failed = true; return null; }
  }
  GL.gl = () => ensure();
  // ONE helper every consumer uses to choose an implementation:  Gfx.pick('planets'|'space'|'fx') -> the GL renderer when GL.supported()
  // (Settings.gpu, Perf tier, context alive), else the Canvas2D module. The GL modules also fall back internally while a shader still compiles.
  M.Gfx.pick = function (kind) {
    const g = M.Gfx; let on = false;
    try { on = GL.supported(); } catch (e) { on = false; }
    if (kind === 'planets') return (on && g.GLPlanets) || g.Planets;
    if (kind === 'space') return (on && g.GLSpace) || g.Space;
    if (kind === 'fx') return (on && g.GLFx) || g.Fx;
    return null;
  };
  GL.canvas = () => (ensure() ? canvas : null);

  // size the shared canvas (grows only; viewport = requested size) and clear it transparent
  GL.begin = function (w, h) {
    const g = ensure(); if (!g) return null;
    w = Math.max(1, Math.ceil(w)); h = Math.max(1, Math.ceil(h));
    if (canvas.width < w || canvas.height < h) { canvas.width = Math.max(canvas.width, w); canvas.height = Math.max(canvas.height, h); }
    curW = w; curH = h;
    g.bindFramebuffer(g.FRAMEBUFFER, null);
    g.viewport(0, 0, w, h); g.disable(g.BLEND); g.disable(g.DEPTH_TEST);
    g.clearColor(0, 0, 0, 0); g.clear(g.COLOR_BUFFER_BIT);
    return { gl: g, w, h };
  };
  // copy the rendered region (origin bottom-left in GL, handled here) into a 2D context
  GL.blit = function (ctx, dx, dy, dw, dh) {
    const sx = 0, sy = canvas.height - curH;       // GL's origin is bottom-left; the canvas bitmap is top-left
    ctx.drawImage(canvas, sx, sy, curW, curH, dx, dy, dw === undefined ? curW : dw, dh === undefined ? curH : dh);
  };

  // ---- shader programs -------------------------------------------------------------------------
  function compile(g, type, src, name) {
    const s = g.createShader(type); g.shaderSource(s, src); g.compileShader(s);
    if (!g.getShaderParameter(s, g.COMPILE_STATUS)) {
      const log = g.getShaderInfoLog(s) || '', lines = src.split('\n');
      const m = /ERROR:\s*\d+:(\d+)/.exec(log), ln = m ? +m[1] : 0;
      console.error('[GL] shader "' + name + '" failed:\n' + log + (ln ? '\n>> ' + (lines[ln - 1] || '').trim() : ''));
      g.deleteShader(s); return null;
    }
    return s;
  }
  // GL.program('planet', vs, fs) → {prog, u(name) → location (cached), use()} ; vs may be omitted to use the fullscreen-quad vertex shader
  GL.program = function (name, vs, fs) {
    const g = ensure(); if (!g) return null;
    let p = programs.get(name);
    if (p) return p;
    const v = compile(g, g.VERTEX_SHADER, vs || GL.quadVS, name + '.vs'), f = compile(g, g.FRAGMENT_SHADER, fs, name + '.fs');
    if (!v || !f) { programs.set(name, null); return null; }
    const prog = g.createProgram(); g.attachShader(prog, v); g.attachShader(prog, f); g.linkProgram(prog);
    if (!g.getProgramParameter(prog, g.LINK_STATUS)) { console.error('[GL] link "' + name + '": ' + g.getProgramInfoLog(prog)); programs.set(name, null); return null; }
    const locs = {};
    p = { name, prog, use() { g.useProgram(prog); return p; }, u(n) { return n in locs ? locs[n] : (locs[n] = g.getUniformLocation(prog, n)); },
      f1(n, a) { g.uniform1f(p.u(n), a); return p; }, f2(n, a, b) { g.uniform2f(p.u(n), a, b); return p; }, f3(n, a, b, c) { g.uniform3f(p.u(n), a, b, c); return p; },
      f4(n, a, b, c, d) { g.uniform4f(p.u(n), a, b, c, d); return p; }, i1(n, a) { g.uniform1i(p.u(n), a); return p; } };
    programs.set(name, p);
    return p;
  };
  GL.quadVS = '#version 300 es\nprecision highp float;\nout vec2 vUv;\nvoid main(){ vec2 p = vec2((gl_VertexID<<1)&2, gl_VertexID&2); vUv = p; gl_Position = vec4(p*2.0-1.0, 0.0, 1.0); }\n';
  // draw the fullscreen triangle (3 vertices, no buffers needed; vertex shader derives positions from gl_VertexID)
  GL.drawQuad = function () { const g = ensure(); if (!quadVao) quadVao = g.createVertexArray(); g.bindVertexArray(quadVao); g.drawArrays(g.TRIANGLES, 0, 3); };

  // ---- textures & framebuffers -----------------------------------------------------------------
  GL.texture = function (w, h, o) {
    const g = ensure(); o = o || {};
    const t = g.createTexture(); g.bindTexture(g.TEXTURE_2D, t);
    const internal = o.float ? g.RGBA16F : g.RGBA8, fmt = g.RGBA, type = o.float ? g.HALF_FLOAT : g.UNSIGNED_BYTE;
    g.texImage2D(g.TEXTURE_2D, 0, internal, w, h, 0, fmt, o.float ? g.FLOAT : type, o.data || null);
    g.texParameteri(g.TEXTURE_2D, g.TEXTURE_MIN_FILTER, o.nearest ? g.NEAREST : g.LINEAR);
    g.texParameteri(g.TEXTURE_2D, g.TEXTURE_MAG_FILTER, o.nearest ? g.NEAREST : g.LINEAR);
    g.texParameteri(g.TEXTURE_2D, g.TEXTURE_WRAP_S, o.repeat ? g.REPEAT : g.CLAMP_TO_EDGE);
    g.texParameteri(g.TEXTURE_2D, g.TEXTURE_WRAP_T, o.repeatY ? g.REPEAT : g.CLAMP_TO_EDGE);
    return t;
  };
  GL.fbo = function (w, h, o) {
    const g = ensure(); const tex = GL.texture(w, h, o), fb = g.createFramebuffer();
    g.bindFramebuffer(g.FRAMEBUFFER, fb); g.framebufferTexture2D(g.FRAMEBUFFER, g.COLOR_ATTACHMENT0, g.TEXTURE_2D, tex, 0);
    const ok = g.checkFramebufferStatus(g.FRAMEBUFFER) === g.FRAMEBUFFER_COMPLETE;
    g.bindFramebuffer(g.FRAMEBUFFER, null);
    return { fb, tex, w, h, ok, dispose() { g.deleteFramebuffer(fb); g.deleteTexture(tex); } };
  };
  GL.bindTex = function (unit, tex) { const g = ensure(); g.activeTexture(g.TEXTURE0 + unit); g.bindTexture(g.TEXTURE_2D, tex); };

  // ---- reusable GLSL (paste into fragment shaders with ${GL.glsl.noise}) -------------------------
  GL.glsl = {
    // value/gradient-ish noise, fbm, ridged fbm, voronoi — hash-based, no textures, runs on any WebGL2 GPU
    noise: `
      float hash13(vec3 p){ p = fract(p*0.1031); p += dot(p, p.zyx+31.32); return fract((p.x+p.y)*p.z); }
      vec3  hash33(vec3 p){ p = fract(p*vec3(.1031,.1030,.0973)); p += dot(p, p.yxz+33.33); return fract((p.xxy+p.yxx)*p.zyx); }
      float vnoise(vec3 x){ vec3 i=floor(x), f=fract(x); f=f*f*(3.0-2.0*f);
        return mix(mix(mix(hash13(i),hash13(i+vec3(1,0,0)),f.x), mix(hash13(i+vec3(0,1,0)),hash13(i+vec3(1,1,0)),f.x),f.y),
                   mix(mix(hash13(i+vec3(0,0,1)),hash13(i+vec3(1,0,1)),f.x), mix(hash13(i+vec3(0,1,1)),hash13(i+vec3(1,1,1)),f.x),f.y), f.z); }
      float fbm(vec3 p, int oct){ float a=0.5, s=0.0; for(int i=0;i<8;i++){ if(i>=oct) break; s+=a*vnoise(p); p=p*2.03+vec3(7.1,3.7,5.3); a*=0.5; } return s; }
      float ridged(vec3 p, int oct){ float a=0.5, s=0.0; for(int i=0;i<8;i++){ if(i>=oct) break; float n=1.0-abs(vnoise(p)*2.0-1.0); s+=a*n*n; p=p*2.1+vec3(1.7,9.2,4.1); a*=0.5; } return s; }
      float voronoi(vec3 p){ vec3 i=floor(p), f=fract(p); float d=1.0; for(int x=-1;x<=1;x++) for(int y=-1;y<=1;y++) for(int z=-1;z<=1;z++){ vec3 g=vec3(x,y,z); vec3 o=hash33(i+g); d=min(d, length(g+o-f)); } return d; }
    `,
  };

  GL.dispose = function () { programs.clear(); };
})(window.MOO);
