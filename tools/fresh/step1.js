// Fresh start, step 1: the string orchestra alone holding the tune's harmony (the strain's chords, 12 bars), epic and wide: the full
// section in the middle and high (violas and violins, four voices), the cellos and the basses below; a slow swell in, a long crescendo.
// a: the deep drone (the basses and the cellos hold D and A, the harmony moves above them); b: the low strings move with the chords.
const base = (holdLow) => ({ bpm: 58, root: 'D', mode: 'major', hidden: true, orch: true, holdLow, tens: false, trim: 2.5, rubato: 0, loopFrom: 'A',
  fx: { verb: 1.25, stage: 0.8, dly: 0.5 }, tone: { lo: 1.1, hi: 1.0 }, mix: { pad: 1.0, bass: 1.0 },
  inst: { pad: 'strings', pad2: 'cellos', bass: 'deep' },
  sec: [{ n: 'A', bars: 12, cres: [0.5, 0.95], prog: 'I I IV I | I I IV V | I I IV I',
    pad: { p: 'swell', inst: 'strings', n: 4, reg: [55, 81], vel: 1.0 },
    pad2: { p: 'swell', inst: 'cellos', n: 2, reg: [38, 52], vel: 0.6, open: true },
    bass: { pat: '1---', vel: 0.8, inst: { p: 'deep', sub: 0, att: 3, rel: 2.5 } }, timp: false, drums: false }] });
module.exports = { 'fresh:1a': base(undefined), 'fresh:1b': base(false) };
