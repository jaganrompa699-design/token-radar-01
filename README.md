# Token Radar — build the best token launch radar

[![make.fun](https://make.fun/badge/token-radar-01.svg)](https://make.fun/bounty/token-radar-01)

A program plus a web dashboard that ranks the protocols whose token does
not exist yet by what their launch would be worth, each with the steps to
farm it. An entry for the [token-radar-01 bounty on make.fun](https://make.fun/bounty/token-radar-01).

## What it does

`main.ts` (Node 22, standard library only) reads the sealed DefiLlama
snapshot at `/input/snapshot.json`, scores every rankable pre-token
protocol with the radar-2 model, and writes:

- `board.json` — 198 ranked rows: the 40 watchlist protocols (the floor)
  plus every other rankable pre-token protocol below the floor, so the
  radar finds launches early. Wrapped, staked and bridged products of
  tokens that already trade are never ranked.
- `data.js` + `dashboard/` — a static page with no network: a sortable,
  filterable board, a top-five spotlight, an early (below-floor) view, a
  live-token view set apart with market caps, and a detail view for every
  protocol with its model breakdown and farm plan.
- `screenshots/` — three 1440×900 PNGs painted by the program itself from
  the board it computed: the board, a protocol's detail view, and a
  filtered view.
- `dossier.json` — built with the vendored `vendor/makefun-board.ts`.

## The model (radar-2)

One function scores every protocol alike; no name is special-cased:

```
implied = round( tvl_usd x 0.30
  x (1 + clamp(change_7d, -50, +200) / 100 x 0.60)
  x (0.55 + min(age_days, 1460) / 1460 x 0.45)
  x (1 + 0.03 x min(chains - 1, 4)) )
```

TVL is the size a token would price. Seven-day growth is momentum,
clamped so one wild week cannot decide the board. Age with no token is
how long the protocol has run without launching (unknown age takes the
middle value, 365 days). Breadth is the chain count. Farm plans are
derived per protocol from its category, chains, TVL and age — six steps,
each with a cost and a time.

A protocol on this board *records* no token. That is the snapshot
speaking, never proof it has none. Implied value is this radar's own
claim, not a price and not a promise.

## Run it

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts --input <path to snapshot.json>
```

Deterministic: two runs on the same snapshot write the same bytes.

## Layout

```
main.ts                  entrypoint
lib/model.ts             the radar-2 model, board, farm plans
lib/shots.ts             the three screenshots, painted from the board
lib/png.ts               RGB canvas + PNG writer (stdlib only)
lib/font.ts              bitmap glyphs for the screenshot renderer
vendor/makefun-board.ts  make.fun's dossier library (kit copy)
dashboard/               index.html, app.css, app.js (static, no network)
screenshots/             the three PNGs, as the program paints them
```

License: MIT. See `LICENSE`.
