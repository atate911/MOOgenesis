# tools/soak.js - AI-vs-AI soak / balance runner

Plays whole headless games (`MOO.Sim.newGame` -> `autoTurn` until `isOver` or the turn cap) on every CPU thread with
`worker_threads`, then prints balance tables and a sanity-warning list and writes the full results as JSON.
Uses the real `MOO.Sim.*` when `MOO.Sim.newGame` exists, else `tools/mock-sim.js` (toy economy; `--mock` forces it).
Empire 0 is an AI too (`playerAI:true`): "slot 0" = the rotating race under test, the other empires are the Sim's own picks.

## Commands
    node tools/soak.js                                  # 24 games, races rotate, medium/average, 3 opponents, 250-turn cap
    node tools/soak.js --games 120 --difficulty hard --size large --opponents 5 --seed 500
    node tools/soak.js --matrix --games 12              # race x difficulty grids; --games per cell, same seeds in every cell
    node tools/soak.js --determinism --games 48         # replay each game's first 40 turns twice, compare state hashes
    node tools/soak.js --replay 17 human hard           # ONE verbose game: line per turn, events, stack on failure (--events)
    node tools/soak.js --profile | --bench              # per-phase turn-time percentiles | games/s vs thread count
`--help` lists every option. Lists work for size/age/difficulty/opponents/races (`--difficulty easy,hard`, `all`); game i uses
seed `S+i`, races rotate fastest, then difficulty, size, age, opponents. Ctrl+C stops cleanly and reports what finished.
Every warning/failure prints a `--replay` line that reproduces it exactly (same seed and settings).

## What it measures
- **Outcome**: finished vs turn-cap, end-turn median/p10/p90, endings (conquest/council/...), slot-0 win rate per difficulty/size/age.
- **Win rates** by race, personality, objective: wins / appearances in finished games, 95% Wilson CI, chance level, `HIGH`/`LOW` flag when
  the CI excludes chance, score-leader share (`lead%`, uses `stats().score`, else a colonies/pop/production/techs proxy), elimination %.
- **Growth curves** at `--stats-at` (default 25,50,100,150,200): colonies, pop, production, RP, techs, ships, bc, score (median [p10-p90]),
  plus the same metrics per race at turn ~100 (who expands/techs faster).
- **Turn time**: wall + each `report.timings` phase (mean/p50/p90/p99/max), worst turn with seed; `--profile` adds it by game stage.
- **Diplomacy** from `report.events` (strings or `{type}`): types matching /contact/, /war/, /treaty|peace|alliance/ (regexes at the top of `soak-worker.js`).
  Needs the Sim to emit such events: today's `autoTurn` reports only interrupt names (aiPlan, gnn), so contact/war/treaty counts stay empty (`NO_WARS` info).

## Sanity warnings (ERROR fails the exit code; WARN with `--strict`)
ERROR: `NAN` NaN/Infinity anywhere in S | `NEG_POP` negative pop/factories/counts | `NOT_PLAIN` undefined/function/Map/Set/class in S | `CYCLE` |
`ROUNDTRIP` S != JSON.parse(JSON.stringify(S)) | `BAD_OWNER` planet owner is no empire | `TURN_COUNTER` S.turn skips | `NONDET` same seed gives a
different state (path of first differing field) | `IMPURE_QUERY` stats()/isOver() mutate S | `MATH_RANDOM` sim called Math.random (first call site
shown) | `API` | exceptions, worker crashes, timeouts (FAILURES section: seed, race, turn, phase, stack).
WARN: `EARLY_ELIM` (<turn 30) | `NO_EXPANSION` (turn 40) | `STUCK_PRODUCTION/RESEARCH/TECH` | `SAVE_SIZE` (`--max-save-kb`) | `SAVE_GROWTH`
(`--max-growth-kb` per turn, names the biggest keys) | `SLOW_TURN` (`--slow-ms`) | `HUGE_VALUE` (>=1e14) | `SHARED_REF` aliasing | `DEAD_OWNER` |
`DIFFICULTY_ORDER`. INFO: `CAP_RATE`, `NO_CONTACT`, `NO_WARS`, `BALANCE`. Deep scans run every `--scan-every` turns (default 10) and at the end.

## Robustness
Workers claim jobs from a shared atomic counter (no per-job round trip). An exception is recorded and that worker reloads the sim; a thread that
dies (OOM, `process.exit`, uncaught error) or hangs (watchdog: `--timeout-ms` soft check between turns, kill after 1.25x+2s) is recorded with
seed/race/last turn and respawned. `--fresh` reloads the sim for every game; `--max-mem-mb`, `--young-mb` set per-worker V8 limits.

## Output
Console report + `tools/out/soak-<time>.json` (`--json name` -> tools/out/name, `--no-json` skips): `meta`, `config`, `aggregates`, `games[]`
(one per line: settings, status, end turn/reason, winner/leader, per-empire snapshots, event counts, timing summaries, byte sizes, warnings, error).
Exit codes: 0 clean, 1 failures/ERROR warnings, 2 usage or startup error, 130 interrupted.

## Mock sim and fault injection
`--mock-fail kind@turn[:prob[:arg]],...` makes the mock misbehave to prove the runner catches it: throw, error, exit, hang, oom (needs
`--max-mem-mb`), slow, nan, negpop, undef, cycle, badowner, leak, nondet, elim, stuck, norp, noexpand, badturn, impure.
Example: `node tools/soak.js --games 48 --mock-fail throw@30:0.2,hang@45:0.1 --timeout-ms 3000`. `--mock-work X` scales mock CPU cost
(`--mock-fail`/`--mock-work` imply `--mock`; repro lines add `--mock` whenever the toy sim was used).

## Scaling (Ryzen 9 7900X: 12 cores / 24 threads, mock sim)
`--bench` plays the same games on 1,2,4,8,12,16,20,24 threads and shows speedup, efficiency and "workers busy" (pool idle gaps; ~93%+ means
the pool is not the limit). Measured 3.7x at 4 threads, 7x at 8, 10.7x at 24 (50 games/s vs 4.7): the same ceiling as a pure CPU loop with no
messaging at all (10.6x), since SMT only shares the 12 real cores. Allocation-heavy sims scale worse (V8 GC / memory bound; a pure-allocation loop
reaches only ~3x here); try `--young-mb 8` and compare with `--bench`. Games run slower per thread at high thread counts, so size `--timeout-ms` accordingly.
