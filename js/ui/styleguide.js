// Dev-only screen: ?screen=styleguide — shows every UI-kit widget in the real theme.
(function (M) {
  'use strict';
  const UI = M.UI, h = UI.h;

  function swatch(name, cssVar) {
    return h('div', { style: { width: '6.2rem' } },
      h('div', { style: { height: '2.4rem', background: 'var(' + cssVar + ')', boxShadow: 'inset 0 0 0 1px rgba(255,255,255,.18)' } }),
      h('div.small', name), h('div.small.t-fog', cssVar));
  }

  UI.Screens.register('styleguide', {
    create(el) {
      const slider = (label, color, icon, v) => UI.slider({ label, color, icon, value: v, onChange: () => {} });
      const tbl = UI.table(
        [{ key: 'n', label: 'Planet' }, { key: 'p', label: 'Pop', align: 'r' }, { key: 'f', label: 'Factories', align: 'r' }, { key: 'pr', label: 'Production', align: 'r', fmt: (r, v) => h('span.t-ember', v) }],
        [{ n: 'Mentar', p: 100, f: 220, pr: 294 }, { n: 'Tyr', p: 34, f: 71, pr: 91 }, { n: 'Inra', p: 68, f: 88, pr: 134 }, { n: 'Denubius', p: 30, f: 24, pr: 44 }],
        { sortKey: 'pr', sortDir: -1, onRow: () => {}, selected: r => r.n === 'Tyr' });
      const tabs = UI.tabs([
        { id: 'a', label: 'Overview', render: () => h('p', 'Tab content renders lazily when selected.') },
        { id: 'b', label: 'Colonies', render: () => h('p', 'Second tab.') },
        { id: 'c', label: 'Fleets', render: () => h('p', 'Third tab.') },
      ]);
      el.appendChild(h('div.abs-fill.scroll-y', { style: { padding: '1.5rem 2rem', background: 'radial-gradient(ellipse at 30% 0%, #141e55, var(--void) 65%)' } },
        h('h1.ttl', { style: { fontSize: '2.6rem', marginBottom: '.2rem' } }, 'Master of Orion'),
        h('div.t-mist', { style: { marginBottom: '1.2rem' } }, 'Style guide — indigo void, brass hairlines, ivory ink.'),
        h('div.row.wrap.g3', { style: { marginBottom: '1.2rem' } },
          swatch('Void', '--void'), swatch('Night', '--night'), swatch('Steel', '--steel'), swatch('Brass', '--brass'), swatch('Brass hi', '--brass-hi'),
          swatch('Ivory', '--ivory'), swatch('Mist', '--mist'), swatch('Cyan', '--cyan'), swatch('Ember', '--ember'), swatch('Leaf', '--leaf'),
          swatch('Rose', '--rose'), swatch('Violet', '--violet'), swatch('Gold', '--gold'), swatch('Teal', '--teal')),
        h('div.row.g3', { style: { alignItems: 'flex-start' } },
          h('div.col.grow', UI.panel('Buttons & chips', h('div.col',
            h('div.row.wrap', UI.button('Next turn', null, { primary: true, kbd: 'Space' }), UI.button('Design'), UI.button('Scrap', null, { danger: true }), UI.button('Small', null, { small: true }), UI.button('Disabled', null, { disabled: true })),
            h('div.row.wrap', UI.chip('Peace', 'ok'), UI.chip('War', 'bad'), UI.chip('Trade', 'cy'), UI.chip('Alliance', 'vi'), UI.chip('Rich', 'warn')),
            h('div.row.g2', h('span.t-gold.num', '1,284 BC'), h('span.t-leaf.num', '+56'), h('span.t-ember.num', '294'), h('span.t-cyan.num', '120 RP')),
            h('div.small.t-mist', 'Body text in IBM Plex Sans Condensed; headings in Marcellus SC.'),
            UI.bar(0.62, { color: 'var(--cyan)', thick: true, label: 'Hyper-X Rockets · 62%' }),
            UI.bar(0.3, { color: 'var(--leaf)' }))),
            UI.panel('Colony spending', h('div',
              slider('Ship', 'var(--c-ship)', null, 20), slider('Defense', 'var(--c-def)', null, 10), slider('Industry', 'var(--c-ind)', null, 40),
              slider('Ecology', 'var(--c-eco)', null, 10), slider('Research', 'var(--c-res)', null, 20)), { sub: 'Mentar · 294 BC' })),
          h('div.col.grow',
            UI.panel('Planets', tbl, { sub: '4 colonies' }),
            UI.panel('Tabs', tabs.el),
            UI.panel('Dialogs', h('div.row.wrap',
              UI.button('Open modal', () => UI.modal({ title: 'Colonise Tyr?', body: h('p', 'A small, barren world with abundant minerals. Population growth is halved.'), buttons: [{ label: 'Not now', value: false }, { label: 'Colonise', value: true, primary: true }] })),
              UI.button('Toast', () => UI.toast('Research complete: Deuterium Fuel Cells', 'ok')),
              UI.button('Toast (bad)', () => UI.toast('Tyr is starving!', 'bad')),
              h('span', { tip: '<b>Tooltip</b><br>Brass edge, indigo glass.' }, 'Hover me'))))
        )));
    },
  });
})(window.MOO);
