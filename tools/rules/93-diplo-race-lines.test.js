// Race diplomacy lines (js/data/diplo/<race>.js → MOO.Data.diploRace[race][situation] = [lines]): every race has every situation,
// at least four lines each, plain ASCII, only the placeholders that situation is given, and the ones it must carry.
module.exports = function (M, t) {
  const RACES = ['human', 'mrrshan', 'silicoid', 'sakkra', 'psilon', 'alkari', 'klackon', 'bulrathi', 'meklar', 'darlok'];
  const BASE = ['leader2', 'race2'];
  // situation → [allowed extra placeholders, placeholder every line must use]
  const SIT = {
    firstContact: [[]], greeting: [[]], greetingAlly: [[]], greetingCool: [[]], greetingAtWar: [[]],
    offerNap: [[]], offerAlliance: [[]], offerTrade: [[]], offerTech: [['tech'], 'tech'], incentive: [['x'], 'x'],
    proposalAccepted: [[]], proposalRejected: [[]], proposalRejectedUntrust: [[]],
    declareWar: [[]], warAnnounced: [[]], demandTribute: [['bc'], 'bc'], payTribute: [['bc']], refuseTribute: [[]],
    threaten: [[]], backDown: [[]], askPeace: [[]], acceptPeace: [[]], rejectPeace: [[]], breakTreaty: [['treaty'], 'treaty'],
    spiesCaughtThem: [[]], spiesCaughtUs: [[]], borderWarning: [['star']], thanksGift: [[]], insultReply: [[]], farewell: [[]],
    callForAid: [[]], refuseAid: [[]], congratulate: [[]], councilVoteRequest: [[]], councilVoteThanks: [[]],
  };
  const D = M.Data.diploRace || {};
  M.Data.DIPLO_SITUATIONS = Object.keys(SIT);
  for (const r of RACES) t.test(r + ': every situation, 4+ lines, ASCII, the right placeholders', () => {
    const L = D[r]; t.ok(L, 'MOO.Data.diploRace.' + r + ' exists');
    for (const sit of Object.keys(SIT)) {
      const set = L[sit]; t.ok(Array.isArray(set) && set.length >= 4, r + '.' + sit + ': at least 4 lines');
      const [extra, must] = SIT[sit], ok = BASE.concat(extra);
      for (const s of set) {
        t.ok(typeof s === 'string' && s.length >= 12 && s.length <= 240, r + '.' + sit + ': 12..240 chars: ' + s);
        t.ok(/^[\x20-\x7e]+$/.test(s), r + '.' + sit + ': plain ASCII: ' + s);
        for (const m of s.match(/\{[^}]*\}/g) || []) t.ok(ok.indexOf(m.slice(1, -1)) >= 0, r + '.' + sit + ': placeholder ' + m + ' not allowed here: ' + s);
        if (must) t.ok(s.indexOf('{' + must + '}') >= 0, r + '.' + sit + ': every line uses {' + must + '}: ' + s);
      }
      t.eq(new Set(set).size, set.length, r + '.' + sit + ': no duplicate lines');
    }
    for (const k of Object.keys(L)) t.ok(SIT[k], r + ': unknown situation ' + k);
  });
};
