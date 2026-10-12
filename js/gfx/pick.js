// Gfx.pick(kind) — ONE place that decides GPU vs Canvas2D for the art modules.
//   Gfx.pick('planets')  -> GLPlanets-backed facade (draw/sprite/drawStar/drawAsteroids on the GPU; every other Gfx.Planets member passes through)
//   Gfx.pick('space')    -> GLSpace-backed facade (makeBackdrop/makeStarfield/starSprite on the GPU, drawStarSurface via GLPlanets.drawStar)
//   Gfx.pick('fx')       -> { create } that builds a GLFx system (GPU particles) or the Canvas2D Gfx.Fx system
// When WebGL2 is missing / Settings gpu=false / Perf tier 'low' the plain Canvas2D module is returned, so behaviour is identical to before.
// The GL modules also fall back to the CPU modules by themselves per call (shader still compiling, context lost), so a facade is always safe.
// Gfx.pick.on() = true when the GPU path would be used right now.
(function (M) {
  'use strict';
  const Gfx = M.Gfx = M.Gfx || {};
  const cache = {};
  function on() { try { return !!(Gfx.GL && Gfx.GL.supported && Gfx.GL.supported()); } catch (e) { return false; } }
  function build(kind) {
    if (kind === 'planets') { const P = Gfx.Planets, G = Gfx.GLPlanets; if (!P || !G) return P || G || null; return Object.assign({}, P, G, { path: 'gl' }); }
    if (kind === 'space') {
      const S = Gfx.Space, G = Gfx.GLSpace, P = Gfx.GLPlanets; if (!S || !G) return S || G || null;
      const o = Object.assign({}, S, { makeBackdrop: G.makeBackdrop, makeStarfield: G.makeStarfield, starSprite: G.starSprite });
      if (P && P.drawStar) o.drawStarSurface = P.drawStar;
      return o;
    }
    if (kind === 'fx') { const F = Gfx.Fx, G = Gfx.GLFx; if (!F || !G) return F || G || null; return Object.assign({}, F, { create: G.create, path: 'gl' }); }
    return Gfx[kind] || null;
  }
  const base = { planets: 'Planets', space: 'Space', fx: 'Fx' };
  Gfx.pick = function (kind) {
    const cpu = Gfx[base[kind]];
    if (!on()) return cpu || null;
    return cache[kind] || (cache[kind] = build(kind));
  };
  Gfx.pick.on = on;
})(window.MOO);
