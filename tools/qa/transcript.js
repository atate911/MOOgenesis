// Player's-eye transcript (fun audit): an AI plays seat 0's economy while the turn pipeline treats it as the human, so every human-facing interrupt fires.
// usage: node tools/qa/transcript.js [--v] [--turns=200] [--seed=fun1] [--size=medium] [--diff=average] [--opp=3] [--race=human] [--passive]
//   --v prints every turn's cards/scenes/news; the summary counts interrupts per 25-turn bucket (GNN frequency, notices, audiences, battles, planets lost).
const path = require('path');
const ROOT = path.resolve(__dirname, '../..');
const M = require(path.join(ROOT, 'tools/headless.js')).load({ quiet: true });
const Sim = M.Sim;
const args = Object.fromEntries(process.argv.slice(2).map(a => a.split('=')).map(([k, v]) => [k.replace(/^--/, ''), v === undefined ? true : v]));
const settings = { size: args.size || 'medium', difficulty: args.diff || 'average', opponents: +(args.opp || 3), race: args.race || 'human', seed: args.seed || 'fun1', playerAI: true,
  options: { tactical: false, randomEvents: true, council: true, antarans: true, monsters: true } };
const S = Sim.newGame(settings);
const H = S.empires[0]; H.human = !args.passiveAI; const passive = !!args.passive;
if (passive) H.human = true;
const MAX = +(args.turns || 200), verbose = !!args.v;
const FIELD = ['Computers', 'Construction', 'Force Fields', 'Planetology', 'Propulsion', 'Weapons'];
const name = id => S.empires[id] ? S.empires[id].plural + '(' + S.empires[id].race + ')' : '?';
const counts = {}, perBucket = {}; let over = null;
// seat 0 is 'human' for the pipeline, but its orders are validated as an AI's (the planner's colonize/slidersRaw orders are AI-only)
const origApply = Sim.Orders.applyAll; Sim.Orders.applyAll = function (S2, id, o) { const h = S2.empires[id].human; if (id === 0 && !passive) S2.empires[0].human = false; try { return origApply(S2, id, o); } finally { S2.empires[id].human = h; } };
const log = [];
const bump = (k, t) => { counts[k] = (counts[k] || 0) + 1; const b = Math.floor(t / 25) * 25; perBucket[b] = perBucket[b] || {}; perBucket[b][k] = (perBucket[b][k] || 0) + 1; };
const milestones = [];
let firstContact = null, firstWarHuman = null, lostPlanets = 0, prevOwned = null, battlesHuman = 0;
function playTurn() {
  const gen = Sim.Turn.run(S); let r = gen.next(); const lines = [];
  while (!r.done) {
    const it = r.value; let ans;
    switch (it && it.type) {
      case 'aiPlan': ans = {}; if (!passive) H.human = false; for (const e of S.empires) if (e.alive && !e.human) ans[e.id] = M.AI.plan(S, e.id, M.AI.seedFor(S, e.id)); H.human = true; break;
      case 'battles': { ans = { results: it.battles.map(b => Sim.Combat.resolve(b, M.RNG.fromState(M.RNG.seedState(S.seed + ':' + S.turn + ':' + b.star)))) };
        const mine = it.battles.filter(b => (b.sides || b.parties || []).some(s => s.empire === 0 || s.owner === 0) || JSON.stringify(b).includes('"owner":0'));
        if (mine.length) { battlesHuman += mine.length; bump('battle(human)', S.turn); lines.push('BATTLE x' + mine.length + ' at ' + mine.map(b => S.stars[b.star].name).join(',')); } break; }
      case 'colonize': ans = true; bump('colonize', S.turn); lines.push('COLONIZE? ' + S.planets[it.planet].name); break;
      case 'explore': { bump('explore', S.turn); const p = S.planets[it.star]; lines.push('EXPLORE ' + S.stars[it.star].name + ' [' + p.type + (p.special !== 'normal' ? ' ' + p.special : '') + (p.growth !== 'normal' ? ' ' + p.growth : '') + ' max' + p.maxPop + ']'); break; }
      case 'techChoice': ans = it.choices[0] ? it.choices[0].level : 0; bump('techChoice', S.turn); lines.push('TECHCHOICE ' + FIELD[it.field] + ' (' + it.choices.map(c => c.tech ? c.tech.name : c.level).join(' | ') + ')'); break;
      case 'tech': { bump('tech', S.turn); const t = Sim.Research.techAt(it.field, it.level); lines.push('BREAKTHROUGH ' + FIELD[it.field] + ': ' + (t ? t.name : it.level) + (it.source ? ' [' + it.source + ']' : '')); break; }
      case 'gnn': bump('gnn', S.turn); lines.push('GNN ' + it.items.map(i => '[' + i.cat + (i.importance ? '!' : '') + '] ' + i.headline).join(' // ')); break;
      case 'diplomacy': { bump('diplomacy:' + (it.kind || '?'), S.turn); ans = 'accept'; const from = it.empire !== undefined ? it.empire : it.from; lines.push('AUDIENCE ' + (it.kind || '?') + ' from ' + (from !== undefined ? name(from) : '?') + (it.text ? ' [' + (it.text.situation || '') + '/' + it.msgType + ']' : '') + (it.options ? ' opts=' + it.options.map(o => o.id).join('/') : '') + (it.tech ? ' tech=' + it.tech : '') + (it.bc ? ' bc=' + it.bc : '')); break; }
      case 'council': ans = Sim.Council.autoVote(S, it.info); bump('council', S.turn); lines.push('COUNCIL convened'); break;
      case 'councilResult': bump('councilResult', S.turn); lines.push('COUNCIL result ' + JSON.stringify({ winner: it.result && it.result.winner, reason: it.result && it.result.reason, gameOver: it.result && it.result.gameOver })); break;
      case 'event': bump('event:' + (it.kind || it.id || '?'), S.turn); lines.push('EVENT ' + (it.kind || it.id || '?') + (it.text ? ' — ' + String(it.text).slice(0, 100) : '') + (it.planet !== undefined ? ' @' + (S.planets[it.planet] && S.planets[it.planet].name) : '')); break;
      case 'ground': bump('ground', S.turn); lines.push('GROUND ' + JSON.stringify(it.result).slice(0, 120)); break;
      case 'bombardPrompt': ans = false; bump('bombardPrompt', S.turn); lines.push('BOMBARD? ' + S.planets[it.planet].name); break;
      case 'bombard': bump('bombard', S.turn); lines.push('BOMBARDED ' + JSON.stringify(it).slice(0, 100)); break;
      case 'notice': bump('notice:' + it.kind, S.turn); lines.push('NOTICE ' + it.kind); break;
      case 'built': bump('built', S.turn); lines.push('BUILT ' + it.items.map(b => b.count + 'x' + (H.designs[b.design] ? H.designs[b.design].name : '?') + '@' + S.planets[b.planet].name).join(', ')); break;
      case 'spyStealChoice': case 'spySabotageChoice': bump(it.type, S.turn); lines.push(it.type); ans = 0; break;
      case 'gameover': bump('gameover', S.turn); lines.push('GAMEOVER ' + it.reason + ' winner=' + name(it.winner)); over = it; break;
      default: bump('other:' + (it && it.type), S.turn); lines.push('OTHER ' + (it && it.type));
    }
    r = gen.next(ans);
    H.human = true;
  }
  // milestones
  const rel = H.relations;
  for (const o of S.empires) if (o.id !== 0 && rel[o.id] && rel[o.id].contact && firstContact === null) { firstContact = S.turn; milestones.push('T' + S.turn + ' first contact: ' + name(o.id)); }
  if (Sim.Diplo && Sim.Diplo.atWar) for (const o of S.empires) if (o.id !== 0 && o.alive && Sim.Diplo.atWar(S, 0, o.id) && firstWarHuman === null) { firstWarHuman = S.turn; milestones.push('T' + S.turn + ' first war with ' + name(o.id)); }
  const owned = S.planets.filter(p => p.owner === 0).length;
  if (prevOwned !== null && owned < prevOwned) { lostPlanets += prevOwned - owned; milestones.push('T' + S.turn + ' LOST a planet (' + prevOwned + '→' + owned + ')'); }
  prevOwned = owned;
  return lines;
}
for (let t = 0; t < MAX && !over && H.alive; t++) {
  const lines = playTurn();
  if (lines.length && verbose) console.log('--- T' + S.turn + ' (' + M.Data.Config.displayYear(S) + ') colonies=' + S.planets.filter(p => p.owner === 0).length + ' bc=' + H.bc + '\n  ' + lines.join('\n  '));
  if (S.turn % 25 === 0) { const st = Sim.stats(S); milestones.push('T' + S.turn + ' stats: ' + st.map(s => s.race + (s.alive ? '' : '†') + ' col' + s.colonies + ' pop' + s.pop + ' prod' + s.production + ' techs' + s.techs + ' ships' + s.ships + ' pw' + s.score).join(' | ')); }
}
console.log('\n=== SUMMARY seed=' + settings.seed + ' ' + settings.size + '/' + settings.difficulty + '/opp' + settings.opponents + ' race=' + settings.race + ' turns=' + S.turn + (passive ? ' PASSIVE' : '') + ' ===');
console.log('counts:', JSON.stringify(counts));
for (const b of Object.keys(perBucket).sort((a, b) => a - b)) console.log('  T' + b + '-' + (+b + 24) + ': ' + Object.entries(perBucket[b]).map(([k, v]) => k + '=' + v).join(' '));
console.log('milestones:\n  ' + milestones.join('\n  '));
console.log('human alive=' + H.alive + ' lostPlanets=' + lostPlanets + ' battles=' + battlesHuman + ' over=' + (over ? over.reason : 'none'));
