# Handoff — verify-diplo (independent verification of research/05 + 08/01 §5 against 1oom v1.3 "Classic")
Output: research/05-verification.md (verdict tables, CORRECTIONS 1-10, code audit). No game code was edited.

## Done (VERIFIED against source, mostly 2 independent reads)
- game_diplo.c in full (diplo_act, break_treaty, start_war, stop_war, break_trade, annoy, set_trade, battle_finish, esp_frame, mood relax/limit/get, is_gone).
- game_ai_classic.c: wage_war (+fleet_w/prod_w/do), vote fns, turn_diplo_p1 (+get_ai_trade_tech, sub1), turn_diplo_p2 (+sub1/sub2/sub3), all aud_* hooks, ground/bomb/tech_next.
- game_audience.c: all menus (treaty/trade/threat/tribute/tech/main), sweeten, AI-offer flows, audience start/end.
- game_turn.c: mood_blunder, update_trade, diplo_adjust, process order, coup, check_end, contact_broken, final_war.
- game_election.c, game_stat.c, game_num.c constants and trait tables, game_new.c relation matrix + init values, game_bomb.c fallout, game_spy.c build/turn/report, uiraces.c ladder/sliders.

## Wrong / missing in research (see CORRECTIONS in the report)
Stage F inverted; declare-war 7/8 subject; drift dead for human<->AI (lower-index mirror); battle_finish order; bombing-depopulation war path; trade % gain range; ally cascade runs every turn; wage_war_do NAP cap is 30 (not 20); sub2 clears diplo_type.

## Code audit result (static reading, no node repro run)
diplo.js/spy.js/council.js/events.js already adopt errata 1-8 and match the verified rules line by line.
Deviations found: dispatch/callToArms not clearing dipType (MEDIUM); per-treaty vs shared 50% goodwill roll; path-D draw pattern; breakTreaty early return (LOW).

## NOT verified (follow-up for another verifier)
- game_spy.c: game_spy_espionage/sabotage, esp_sub1/sub2/sub5 (mode semantics), get_value, esp_human/sab_human; turn_p3 spy settings (AI spy behaviour).
- game_event.c entirely (event_new/run, victim weights, event types, monsters, Guardian/Orion loot, coup->funeral route), game_misc.c production multiplier and other difficulty items, game_tech.c loot functions, ending UI text (§8.2).
- Per-brief repro snippets / `node tools/rules-test.js diplo|spy|council|events` were NOT run (session time limit).

## Pointers
Errata sent to the diplo engine (a96252100603ea058) as "ERRATA 1"; follow-ups below. Fetcher quirk: it refuses verbatim code (125-char limit); use statement-by-statement outlines, one function per call; file offsets are in characters (window up to 100k).
