// Shared WebGL2 core — OPTIONAL accelerator. Every GL renderer has a Canvas2D fallback with the same API; callers check
//   if (MOO.Gfx.GL.supported()) { …draw with GL… } else { …2D path… }        (supported() also honours Settings 'gpu' and Perf tier)
// Design: ONE shared offscreen WebGL canvas serves every renderer (browsers cap live contexts; planets/backdrops/particles all share it).
// A renderer does:   const g = GL.begin(w, h);  …draw with g.gl…;  GL.blit(ctx2d, dx, dy, dw, dh);   (blit in the SAME task as the draw)
// Programs: GL.program(name, vs, fs) compiles on demand (blocking until linked). GL.precompile(name, vs, fs) queues a background compile
// (one per idle slot, no status query) and GL.ready(name) polls it, so warm-up never stalls a frame; GL.program picks the result up.
(function (M) {
  'use strict';
  const GL = M.Gfx.GL = {};
  let canvas = null, gl = null, failed = false, curW = 0, curH = 0, quadVao = null;
  const programs = new Map(), pending = new Map();     // pending: name -> {prog, v, f, t0} compiled/linked but status not yet queried
  let parExt = null, parChecked = false;
  let peakW = 1, peakH = 1, peakT = 0;                 // largest region requested since the last shrink check (the shared canvas never shrank before)

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
      canvas.addEventListener('webglcontextlost', e => { e.preventDefault(); programs.clear(); pending.clear(); quadVao = null; });
      canvas.addEventListener('webglcontextrestored', () => { programs.clear(); pending.clear(); quadVao = null; parChecked = false; });
      gl.getExtension('EXT_color_buffer_float'); gl.getExtension('OES_texture_float_linear');
      const e = gl.getExtension('WEBGL_debug_renderer_info');
      GL.info = { renderer: e ? gl.getParameter(e.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER), maxTex: gl.getParameter(gl.MAX_TEXTURE_SIZE), floatRT: !!gl.getExtension('EXT_color_buffer_float') };
      M.HW.gpu = M.HW.gpu || GL.info.renderer; M.HW.webgl2 = true;
      return gl;
    } catch (err) { console.warn('[GL] init failed', err); failed = true; return null; }
  }
  GL.gl = () => ensure();
  GL.canvas = () => (ensure() ? canvas : null);

  // size the shared canvas (viewport = requested size) and clear it transparent. It grows on demand (each dimension capped at the
  // GPU's texture limit) and shrinks back to the peak size of the last ~4 s when that is well below the current allocation, so a
  // one-off large request (or a screen/dpr change) does not pin a huge backing store for the rest of the session.
  GL.begin = function (w, h) {
    const g = ensure(); if (!g) return null;
    const cap = (GL.info && GL.info.maxTex) || 4096;
    w = Math.min(cap, Math.max(1, Math.ceil(w))); h = Math.min(cap, Math.max(1, Math.ceil(h)));
    if (canvas.width < w || canvas.height < h) { canvas.width = Math.max(canvas.width, w); canvas.height = Math.max(canvas.height, h); }
    if (w > peakW) peakW = w; if (h > peakH) peakH = h;
    const tnow = (typeof performance !== 'undefined' ? performance.now() : Date.now());
    if (tnow - peakT > 4000) {
      if (canvas.width * canvas.height > peakW * peakH * 1.6 + 262144) { canvas.width = peakW; canvas.height = peakH; }
      peakW = w; peakH = h; peakT = tnow;
    }
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
  function parallel(g) { if (!parChecked) { parChecked = true; parExt = g.getExtension('KHR_parallel_shader_compile'); } return parExt; }
  // issue compile + link WITHOUT querying any status (the queries are what block the main thread until the driver has finished)
  function issue(g, name, vs, fs) {
    const v = g.createShader(g.VERTEX_SHADER), f = g.createShader(g.FRAGMENT_SHADER);
    g.shaderSource(v, vs || GL.quadVS); g.compileShader(v); g.shaderSource(f, fs); g.compileShader(f);
    const prog = g.createProgram(); g.attachShader(prog, v); g.attachShader(prog, f); g.linkProgram(prog);
    const e = { prog, v, f, t0: performance.now() };
    pending.set(name, e); return e;
  }
  function finish(g, name, e) {
    pending.delete(name);
    if (!g.getProgramParameter(e.prog, g.LINK_STATUS)) {
      const bad = [[e.v, '.vs'], [e.f, '.fs']].filter(x => !g.getShaderParameter(x[0], g.COMPILE_STATUS));
      for (const b of bad) console.error('[GL] shader "' + name + b[1] + '" failed:\n' + (g.getShaderInfoLog(b[0]) || ''));
      if (!bad.length) console.error('[GL] link "' + name + '": ' + g.getProgramInfoLog(e.prog));
      g.deleteProgram(e.prog); g.deleteShader(e.v); g.deleteShader(e.f); programs.set(name, null); return null;
    }
    return wrap(g, name, e.prog);
  }
  // GL.precompile(name, vs, fs): start compiling in the background (one program per idle slot so the GPU process is not flooded and
  // frames that use GL keep flowing). Never blocks; GL.program(name) later picks the result up, GL.ready(name) polls it.
  const queue = []; let queued = false;
  function pumpQueue() {
    queued = false;
    const g = ensure(); if (!g) { queue.length = 0; return; }
    while (queue.length) {
      const q = queue.shift();
      if (programs.has(q.name) || pending.has(q.name)) continue;
      issue(g, q.name, q.vs, q.fs);
      break;                                                   // one per slot
    }
    if (queue.length) scheduleQueue();
  }
  function scheduleQueue() {
    if (queued) return; queued = true;
    if (typeof requestIdleCallback === 'function') requestIdleCallback(pumpQueue, { timeout: 500 }); else setTimeout(pumpQueue, 40);
  }
  GL.precompile = function (name, vs, fs) {
    if (!ensure() || programs.has(name) || pending.has(name)) return;
    for (let i = 0; i < queue.length; i++) if (queue[i].name === name) return;
    queue.push({ name, vs, fs }); scheduleQueue();
  };
  // true once `name` is linked (polled through KHR_parallel_shader_compile when the driver has it; without it, a pending program is
  // reported ready after a grace period, so the first blocking status query lands when the compile has most likely finished)
  GL.ready = function (name) {
    const g = ensure(); if (!g) return false;
    if (programs.has(name)) return !!programs.get(name);
    const e = pending.get(name); if (!e) return false;
    const ext = parallel(g);
    if (ext) { if (!g.getProgramParameter(e.prog, ext.COMPLETION_STATUS_KHR)) return false; }
    else if (performance.now() - e.t0 < 400) return false;
    return !!finish(g, name, e);
  };
  GL.pending = name => pending.has(name) || queue.some(q => q.name === name);
  GL.parallel = () => { const g = ensure(); return !!(g && parallel(g)); };
  // GL.program('planet', vs, fs) → {prog, u(name) → location (cached), use()} ; vs may be omitted to use the fullscreen-quad vertex shader
  GL.program = function (name, vs, fs) {
    const g = ensure(); if (!g) return null;
    let p = programs.get(name);
    if (p !== undefined) return p;
    for (let i = 0; i < queue.length; i++) if (queue[i].name === name) { queue.splice(i, 1); break; }
    let e = pending.get(name);
    if (!e) {
      if (!fs) return null;
      e = issue(g, name, vs, fs);
    }
    return finish(g, name, e);
  };
  function wrap(g, name, prog) {
    let p;
    const locs = {};
    p = { name, prog, use() { g.useProgram(prog); return p; }, u(n) { return n in locs ? locs[n] : (locs[n] = g.getUniformLocation(prog, n)); },
      f1(n, a) { g.uniform1f(p.u(n), a); return p; }, f2(n, a, b) { g.uniform2f(p.u(n), a, b); return p; }, f3(n, a, b, c) { g.uniform3f(p.u(n), a, b, c); return p; },
      f4(n, a, b, c, d) { g.uniform4f(p.u(n), a, b, c, d); return p; }, i1(n, a) { g.uniform1i(p.u(n), a); return p; } };
    programs.set(name, p);
    return p;
  }
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

  GL.dispose = function () { programs.clear(); pending.clear(); queue.length = 0; };
})(window.MOO);
