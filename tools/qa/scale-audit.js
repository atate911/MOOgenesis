// Dev QA: paste/eval in the page (fetch('tools/qa/scale-audit.js').then(r=>r.text()).then(eval)) then `await __run([...ids])`.
// Reports, per screen, elements outside the viewport, clipped overflow and scroll containers at the current viewport size.
window.__audit = function () {
  const W = innerWidth, H = innerHeight, el = document.querySelector('.screen.active'), out = [];
  if (!el) return { out: ['no active screen'] };
  const all = [...el.querySelectorAll('*')]; let n = 0;
  for (const e of all) {
    const r = e.getBoundingClientRect(); if (!r.width || !r.height) continue;
    const cs = getComputedStyle(e); if (cs.display === 'none' || cs.visibility === 'hidden' || cs.position === 'fixed') continue;
    if (e.closest('svg') && e.tagName !== 'svg') continue;
    if (r.right > W + 2 || r.bottom > H + 2 || r.left < -2 || r.top < -2) { if (n++ < 4) out.push('OFF ' + e.tagName + '.' + String(typeof e.className === 'string' ? e.className : '').slice(0, 30) + ' ' + Math.round(r.left) + ',' + Math.round(r.top) + ',' + Math.round(r.right) + ',' + Math.round(r.bottom)); }
  }
  let sc = 0;
  for (const e of all) {
    const cs = getComputedStyle(e); if (!e.clientHeight || !e.clientWidth || cs.display === 'none') continue;
    const vo = e.scrollHeight > e.clientHeight + 3, ho = e.scrollWidth > e.clientWidth + 3; if (!vo && !ho) continue;
    const t = e.tagName + '.' + String(e.className).slice(0, 30) + ' ' + e.scrollWidth + 'x' + e.scrollHeight + ' in ' + e.clientWidth + 'x' + e.clientHeight;
    if ((vo && /auto|scroll/.test(cs.overflowY)) || (ho && /auto|scroll/.test(cs.overflowX))) { if (sc++ < 6) out.push('SCROLL ' + t); }
    else if ((vo && /hidden|clip/.test(cs.overflowY)) || (ho && /hidden|clip/.test(cs.overflowX))) { if (e !== el && e.tagName !== 'CANVAS' && sc++ < 6) out.push('CLIP ' + t); }
  }
  return { out };
};
window.__run = async function (ids) {
  const res = {};
  for (const id of ids) { try { MOO.UI.Screens.go(id, {}); await new Promise(r => setTimeout(r, 700)); res[id] = __audit().out; } catch (e) { res[id] = 'ERR ' + e.message; } }
  return innerWidth + 'x' + innerHeight + ' fs=' + getComputedStyle(document.documentElement).fontSize + '\n' + Object.entries(res).map(([k, v]) => k + ': ' + (Array.isArray(v) ? (v.length ? '\n   ' + v.join('\n   ') : 'ok') : v)).join('\n');
};
