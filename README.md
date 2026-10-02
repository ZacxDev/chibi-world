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
