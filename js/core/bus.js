// Minimal event bus:  const off = MOO.Bus.on('turn', fn);  MOO.Bus.emit('turn', data);  off();
(function (M) {
  'use strict';
  const handlers = Object.create(null);
  M.Bus = {
    on(evt, fn) { (handlers[evt] = handlers[evt] || []).push(fn); return () => M.Bus.off(evt, fn); },
    once(evt, fn) { const off = M.Bus.on(evt, function () { off(); fn.apply(null, arguments); }); return off; },
    off(evt, fn) { const a = handlers[evt]; if (!a) return; const i = a.indexOf(fn); if (i >= 0) a.splice(i, 1); },
    emit(evt) {
      const a = handlers[evt]; if (!a) return;
      const args = Array.prototype.slice.call(arguments, 1);
      for (const fn of a.slice()) { try { fn.apply(null, args); } catch (e) { console.error('[Bus:' + evt + ']', e); } }
    },
  };
})(window.MOO);
