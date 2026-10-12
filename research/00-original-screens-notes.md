# Original game — layout & feel notes (reference only)

Observed from public Let's-Play screenshots of the 1993 game. **Purpose: understand the layout, flow and feel only.**
We do NOT copy any art, UI skins, fonts, portraits or text. Everything in the remake is drawn/written fresh,
in the "imperial observatory" style (indigo void, brass hairlines, ivory ink, chamfered panels).

## The overall shape of the game UI
- **One main "control screen"**: big galaxy map on the left (~75% width), a context **side panel** on the right (~25%),
  and a **bottom nav row of 8 buttons**: Game · Design · Fleet · Map · Races · Planets · Tech · Next Turn.
  The side panel changes with the selection: colony summary + spending sliders, fleet summary + ETA, "found a colony?" prompt,
  "scouts explored a new system" card.
- Everything else is a **full-screen modal-ish screen** that you open from that row and close with OK
  (Design, Planets list, Map overlay, Races, Tech/Research, Fleet deployment).
- Dramatic **"scene" screens with a character portrait** give events weight: a scientist at a console announcing each breakthrough
  (tech name + one-sentence effect), the High Council chamber when voting, the news broadcast (GNN), diplomacy audience.
- Text-forward, tabular, dense, fast to operate with the mouse. No tutorials needed — labels are blunt ("Ship / Def / Ind / Eco / Tech").

## Screen-by-screen notes
1. **Title**: big metallic logo, vortex/nebula backdrop, animated engines; menu = Continue / Load / New / Quit.
2. **New game**: three selectors only — Galaxy Size (Small/Medium/Large/Huge), Difficulty (Simple/Easy/Average/Hard/Impossible),
   Opponents (1–5). Remembers last choices. Then **Choose Race** list (10 names) with portrait + one-line tag (e.g. "Superior research techniques"),
   then **banner colour** (this also fixes your ship livery), then **name** (emperor) and homeworld name defaults.
3. **Galaxy map**: stars as coloured dots/crosses (colour = star class, hints at planets), unexplored stars plain; owner flags;
   labels on selected/owned stars; moving fleets are small arrows with a thin line to their destination; selection reticle (corner brackets).
   Starfield over a faint blue dotted nebula texture on the overview map.
4. **Colony panel (right side)**: system name header; planet picture + type + "POP n MAX"; Pop / Bases; Production n (after costs) (total);
   **five spending sliders** (Ship, Def, Ind, Eco, Tech) each with a right-hand readout (e.g. "None", "2.2/9", "Clean", "0 RP");
   a **build-item box** showing the current ship design with a count, and buttons **Ships / Reloc / Trans**
   (choose build, rally point, transport up to half the pop).
5. **Fleet deployment (right panel swap)**: list of ship stacks with ◀◀ ◀ ▶ ▶▶ number selectors, prompt "choose destination and number",
   Cancel / Accept. Fleet-in-flight panel shows owner banner, "ETA n turns", ship types, destination.
6. **Galaxy Map overlay screen**: whole-galaxy view with filter buttons **Colonies / Environments / Minerals** and a **Map Key** legend
   (empire flags, planet-type letters, "unable to land on").
7. **Planets list screen**: table — #, Planet, Population (↑ growth), Factories, Shields, Bases, Waste, Production, Space Dock (what's building), Notes;
   footer: **Spending Costs** (Ships %, Spying %, Bases %, Security %), **Total Income** (Trade, Planets), Reserve BC, tax/transfer slider, Transfer, OK.
8. **Design screen**: library grid of saved designs (rows × role columns) + "Ship maintenance cost/yr"; Specs / Scrap / OK.
   **New Ship Design editor**: summary strip (Attack level, Missile def, Hit points, Warp, Def, Combat speed) over slots —
   Computer, Shield, ECM, Armor, Engine, Maneuver, **Weapons 1–4** (each with count ▲▼, damage, arc, notes), **Special 1–3**;
   bottom: Ship Size selector (Small/Medium/Large/Huge), Ship Icon picker, Name, Ship Cost, Total Space, Available Space; Cancel / Clear / Build.
   Component pickers pop up as tables: name, description, cost, size, power, space.
9. **Tech/Research screen**: six field tabs (Computers, Construction, Force Fields, Planetology, Propulsion, Weapons) +
   **six allocation sliders (one per field)** with a one-line summary of what the field currently gives you
   ("Scanner range 3, robotic controls 2/col", "Ship range 3 parsecs" …), a "level" column, a light-bulb marker where a choice is pending,
   total research readout and OK. A picture pane shows the highlighted technology.
10. **"Choose the area of research" scene**: when a field finishes, a scientist character (our own race) stands at a console; a list box shows
    the next techs available in that field with a description and RP cost; pick one to research.
11. **"Breakthrough" scene**: same scientist, headline "<Race> scientists achieve a <field> breakthrough", tech name, one-sentence effect.
12. **Races screen**: three race rows per page; each = portrait, race name button, treaty status ("No treaty / No trade"), an **attitude bar**
    from hostile (red) to friendly (green) with a label (Unease, Neutral…), **spy allocation** slider + Hide / Sabotage / Espionage modes,
    plus "Overall security"; footer: Status · Report · Audience · OK. **Report** shows that empire's known tech per field + personality
    ("Aggressive Expansionist") + alliances + wars. **Audience** opens the diplomacy conversation.
13. **High Council**: an arched chamber, leaders' portraits in alcoves around a glowing pedestal; running vote tallies along the top
    ("n votes <name>… total"), prompt lines at the bottom; player chooses Yourself / Candidate / Abstain.
14. **Combat**: starfield battlefield, ships as sprites, selected ship boxed, bottom command bar:
    **Auto · Planet · Scan · Missiles · Special · Retreat · Wait · Done** with the ship name at left.
15. **Event cards** in the side panel: "Scout ships explore a new star system" with the planet's picture, environment flags
    ("Hostile Environment: population growth halved", "Mineral Rich: resource points doubled"), Continue.
16. **GNN**: periodic production/score rankings and news bulletins as a broadcast.

## What we keep vs. what we upgrade
| Keep (feel) | Upgrade (graphics/UX) |
|---|---|
| Map + right panel + 8-button bottom bar; blunt labels | Fluid hi-res layout, zoom/pan map, glowing stars, nebulae, territory glow, animated fleet lanes |
| Five colony spending sliders + build box | Live numbers, tooltips, rotating lit planet render with city lights |
| Scene screens with characters (scientist, council, GNN, diplomacy) | Fresh illustrated/animated race portraits, richer chambers & backdrops |
| Design editor slots (Computer/Shield/ECM/Armor/Engine/Maneuver/Weapons×4/Specials×3, 4–5 hull sizes) | Live ship render preview, stat deltas, drag-free quick pickers |
| Six research sliders + choose-next-tech list | Tech tree view, search, ETA per tech |
| Tactical combat command bar (Auto/Planet/Scan/Missiles/Special/Retreat/Wait/Done) | Smooth animation, beam/missile/explosion FX, shields, camera |
