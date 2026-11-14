# ez.darts — design reference

Static mockups for v1. They show layout and visual style only; there's no real game logic in them.

## Chosen designs
| Screen | Design | Files |
|---|---|---|
| x01 in-game | **Big Keys** (Concept 1 in `x01-concepts.html`; concepts 2–4 were not chosen) | `x01-concepts.html` (section `#c1`), `screenshots/x01-big-keys-phone.png`, `screenshots/x01-big-keys-tablet.png` |
| Stats | Player view + household view (draft) | `stats-screen.html`, `screenshots/stats-player-phone.png`, `screenshots/stats-household-phone.png` |

Open the HTML files in a browser for the full detail; the PNGs are quick references.

## Big Keys: what to keep
- Input first: the dart pad fills about half the screen. Keys ≥ 56 px on phone, about 128×110 px on tablet.
- Single / Double / Triple modifier above the numbers, picked before the number; it **resets to Single after each dart**.
- Number keys show the value for the selected modifier in the corner (with Triple selected, 18 shows 54).
- Bull is disabled when Triple is selected (no triple bull). Miss and Undo are always visible.
- The current thrower's remaining score is the largest thing on screen, with the turn's 3 dart slots and the checkout hint just below.
- Other players: compact chips on phone, a list on tablet.
- Phone portrait: everything stacked. Tablet landscape: game state on the left, pad on the right.

## Stats: what to keep
- Same dark theme and S/D/T colours as the game pad.
- Player view: win ratio headline with change vs the previous period → stat tiles → "where your darts land" rows (S/D/T/Miss) → three weekly trend charts → head to head → by game → recent games.
- Household view: win ratio per player, head-to-head grid (row finished ahead of column), x01 average by player, dart mix per player.
- Filters at the top: player, period (4 wk / 12 wk / year / all), game.

## Visual tokens (from the mockups)
```css
--bg: #0a0d12;        /* page */
--surface: #121821;   /* cards, keys */
--line: #222a35;      /* borders */
--ink: #e9eef4;       /* primary text */
--muted: #93a0b0;     /* secondary text */
--single: #5b6b80;    /* S */
--double: #22a55c;    /* D */
--triple: #e8890c;    /* T */
--bust: #e5484d;
--accent: #38bdf8;    /* current player, focus, charts */
```
Font: system sans (`system-ui, -apple-system, "Segoe UI", Roboto, sans-serif`). Large numbers use heavy weights (800–850).

## Language
The mockups are in English. The app is Icelandic (default) + English; leave room for Icelandic labels running 20–30% longer. The Icelandic wording behind the EN/IS switch in `x01-concepts.html` is a draft that needs a native-speaker review.
