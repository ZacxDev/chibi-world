# Chibi World — a tiny 3D demo in Defold

A chibi-style 3D demo world built with [Defold](https://defold.com/) 1.13.2.
Everything is procedural — no downloaded assets. A controllable chibi
character explores a meadow biome with a house, trees, a pond, and
snow-capped mountains.

![spawn](screenshots/01_spawn.png)

## Controls

- **WASD / arrow keys** — walk around
- **Space** — hop

## Run it

**Option 0 — zero setup (Nix):** the flake pins the whole Defold 1.13.2
toolchain (bob.jar, `dmengine_headless`, Temurin 25) by hash and fixes the
NixOS loader walls — no `nix-shell`, no manual downloads:

```sh
nix run .#build-native    # headless build + run (prints CHIBI WORLD READY)
nix run .#bundle-html5    # wasm-web release bundle -> html5-build/
nix develop               # shell: bob, dmengine_headless, python3, node
```

Serve the bundle over HTTP (WASM won't run from `file://`) and open it in a
WebGL2 browser:

```sh
cd html5-build && python3 -m http.server 8080
# open http://localhost:8080
```

**Option A — Defold editor:** open `tiny-game/game.project` in the Defold
editor and hit Project → Build.

**Option B — command line** (needs the Defold toolchain — see `NOTES.md`):

```sh
# build + run headless (prints CHIBI WORLD READY)
node drive-defold-mcp.mjs
```

Screenshots from an actual headless-Chrome playthrough are in
`screenshots/` (`01_spawn` → `06_release`).

## Project layout

- `tiny-game/` — the Defold project: `game.project`, scripts (`main/`), input
  bindings, tests, and generated assets under `assets/meshes/`
  (39 flat-shaded `.gltf` meshes) plus 12 collections
- `tiny-game/tools/gen_meshes.py` — generates the procedural meshes
- `tiny-game/tools/gen_collections.py` — generates the collections
- `tools/` — dev/probe scripts (screenshots, headless runs, HTTP server)
- `drive-defold-mcp.mjs` — idempotent driver: scaffold → build → headless run
  → tests, via the Defold MCP server (`.mcp.json`)
- `NOTES.md` — full build notes, quirks, and gotchas

The world spawns deterministically (seed 1234).

---

## Civlings (Phase 1: Foundation & Auth)

Civlings is the real game this project is becoming — a sandbox/economic sim
with generative AI assets, shipped as a Defold game embedded in a Civitai
App, with Buzz as the in-game currency. The chibi world above was its proof
of concept.

Phase 1 (in `civlings/`) is done and verified:

- **Defold project** — clean base scaffolded from the proof-of-concept
  patterns; boots headless (`CIVLINGS READY`).
- **Civitai App wrapper** (`civlings/web/`) — dark-default shell that embeds
  the game and speaks the Civitai app postMessage protocol
  (`BLOCK_INIT`/`BLOCK_READY`, `GET_BUZZ_BALANCE` → `BUZZ_BALANCE_RESULT`).
  Viewer identity and the Buzz balance (blue/green/yellow pools) render in
  the header. Standalone runs use a clearly-labeled mock host.
- **Lua ↔ JS bridge** — Lua polls `window.CivlingsGame.drain()` via
  `html5.run`; the wrapper relays viewer/balance into the game and can ping
  it. Verified end-to-end in headless Chrome
  (`civlings/tools/verify-web.mjs`, screenshot
  `civlings/screenshots/01_bridge.png`).

Build/verify:

```sh
cd civlings && ./package-web.sh          # bob bundle -> web/game/ (+ bridge injection)
cd web && python3 -m http.server 8611 &  # then open http://127.0.0.1:8611/?mock=1
node civlings/tools/verify-web.mjs       # ALL GREEN expected
```

### Phase 2: isometric city grid + first Civling

- **Fixed 45° isometric camera** (orthographic) over a **10×10 Genesis
  City grid**: plaza / core / outer / edge tiers, stepped tile tops,
  border planting outside the plots.
- **First Civling**: the chibi humanoid spawns on the plaza. Click any
  tile and it pathfinds there (BFS over the grid) with its walk cycle.
- Verified end-to-end: `civlings/tools/verify-phase2.mjs` (6/6 PASS,
  including a click whose target cell is computed from the game's own
  pick math), screenshots `civlings/screenshots/02_grid.png` and
  `03_moved.png`.

Next phase: generation + the Jev task system.
