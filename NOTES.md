# Defold MCP scratch setup — notes

Proves an AI agent can build a Defold game end-to-end on this machine:
scaffold → write script → edit collection → build → run headless → Lua unit
test. All green as of 2026-10-01.

## Versions
- Defold **1.13.2** (sha1 `20692b3a510a29dde4df99401f0881bfcec1d9fb`)
- bob.jar 1.13.2 — canonical download:
  `https://d.defold.com/archive/20692b3a510a29dde4df99401f0881bfcec1d9fb/bob/bob.jar`.
  **Requires Java 25+** (class file v69). System Java is OpenJDK 21, which
  fails with `UnsupportedClassVersionError`. Fix: Eclipse Temurin 25 JRE at
  `~/workspace/tools/jdk25/`; `.mcp.json` puts `~/workspace/tools/jdk25/bin`
  first on the MCP server's PATH.
- dmengine_headless 1.13.2 (x86_64-linux) — canonical download:
  `https://d.defold.com/archive/20692b3a510a29dde4df99401f0881bfcec1d9fb/engine/x86_64-linux/dmengine_headless`
- MCP server: `rochana-sadila/defold-mcp` (MIT), built with `npm run build`
- Node v24.20.0

## Paths
⚠ **The `~/workspace/tools/*` paths below are machine-specific** (the scratch
machine this project was built on) — they will not exist on a fresh checkout.
On other machines use the flake instead (see "Zero-setup via Nix" below); it
downloads both artifacts from the canonical archive URLs above.
- Toolchain: `~/workspace/tools/defold-toolchain/` (`bob.jar`, `dmengine_headless`, `version.json`)
- JDK 25: `~/workspace/tools/jdk25/`
- MCP server: `~/workspace/tools/defold-mcp/` (`dist/index.js`)
- Scratch project + driver: `~/workspace/scratch-defold/`
  - `.mcp.json` — MCP client config (node + env: DEFOLD_PROJECT_PATH, BOB, DMENGINE_HEADLESS, PATH with jdk25)
  - `drive-defold-mcp.mjs` — the full end-to-end driver (JSON-RPC stdio client, no deps)
  - `tiny-game/` — the Defold project it builds
  - `logs/` — per-run evidence (`tools.json`, `build-*.json`, `run.log`, `test.log`, `RESULT.txt`)

## How to re-run
```bash
cd ~/workspace/scratch-defold && node drive-defold-mcp.mjs
```
The driver is idempotent (tolerates the existing scaffold). Manual equivalents:
```bash
# build
cd ~/workspace/scratch-defold/tiny-game
export PATH=$HOME/workspace/tools/jdk25/bin:$PATH
java -jar ~/workspace/tools/defold-toolchain/bob.jar resolve build --variant headless --archive
# run the built game
cd build/default && ~/workspace/tools/defold-toolchain/dmengine_headless
```

## What the driver does (tool call order + fallbacks)
1. `tools/list` → 10 tools (project_info, list_project, read_file, write_script,
   init_project, build, edit_collection, run_headless, run_tests, hot_reload)
2. `defold_init_project` (name=tiny-game; refuses overwrite on re-run — tolerated)
3. `defold_project_info`, `defold_write_script` (main/hello.script),
   `defold_edit_collection` set_property ×2 (rename GO main→go; repoint its
   script component to /main/hello.script), `defold_read_file`,
   `defold_list_project`
4. **Shell fallbacks** (no MCP tool covers these — done via fs, documented):
   - `game.project`: bob 1.13.2 strips the last char of resource refs assuming
     *compiled* paths, so `main_collection` must be `/main/main.collectionc`
     (scaffold writes the source path → "can't be found")
   - create `input/game.input_binding` (bob root node missing from scaffold)
   - prepend `name: "main"` to the collection (MCP serializer drops it;
     bob errors "Message missing required fields: name")
5. `defold_build` {variant headless, archive:true} → success=true.
   (MCP tool has a 120s internal cap; driver retries then does one manual
   `java -jar bob.jar` warm-up up to 900s if needed.)
6. Run: `defold_run_headless` first (it looks in build/headless|build/debug,
   bob emits build/default → captures nothing), then **fallback**: direct
   `dmengine_headless` in the discovered `build/default` dir.
7. Lua test: MCP can't write `.lua`/`.collection`, so `main/math_util.lua`,
   `tests/test_main.script`, `tests/test.collection` go via fs. bob 1.13.2
   builds only the reachable closure, so bootstrap is temporarily swapped to
   `/tests/test.collectionc`, built via `defold_build`, run directly
   (PASS lines matched in the raw log — the engine prefixes prints with
   `DEBUG:SCRIPT: `), then the game bootstrap is restored and rebuilt.

## Verified results (2026-10-01, driver exit 0, ALL GREEN)
- Build: `defold_build` success=true, `tiny-game/build/default/` contains
  `game.projectc`, `game.arcd`, `game.arci`, compiled `main/*`.
- Run (direct dmengine_headless, exit=0 — the game self-quits after 30 frames):
  - `DEBUG:SCRIPT: TINY GAME RUNNING`
  - `DEBUG:SCRIPT: TINY GAME: 30 frames done, quitting`
- Lua test: 7/7 `PASS:` lines + `ALL TESTS PASSED` (add/mul/clamp module
  exercised through `require("main.math_util")`).
- Note: `require()` resolves `.lua` files, not `.script` — the test module is
  `main/math_util.lua` (fs fallback; MCP `defold_write_script` only writes
  `.script`).

## Known gaps / not attempted
- `defold_hot_reload` and `defold_run_tests` (MCP's own test runner) were not
  exercised — the test used the bootstrap-swap + direct-run path instead.
  `defold_run_tests` ignores its `testFile` param (only `settingsFile`
  matters) and its `^PASS:` regex likely misses the `DEBUG:SCRIPT: ` prefix.
- The game is a print-and-quit smoke test; no graphics/input exercised
  (headless engine uses the null graphics adapter).
- First-ever `bob` build downloads engine artifacts (~hundreds of MB through
  the egress proxy); the MCP 120s build cap may trip once before the cache
  warms — the driver handles this automatically.

## Zero-setup via Nix (2026-10-02)

`flake.nix` makes the repo runnable on a fresh machine with zero manual
setup — verified end-to-end on NixOS:

```sh
nix run .#build-native    # headless build + run -> CHIBI WORLD READY / WORLD SPAWNED
nix run .#bundle-html5    # fresh wasm-web release bundle -> html5-build/
nix develop               # bob, dmengine_headless, python3 (generators), node (tools/), zip
```

It pins `bob.jar` and `dmengine_headless` **by hash** from the canonical
`d.defold.com/archive/20692b3a…/` URLs above (Temurin 25 for Java) and
works around two walls hit when building on NixOS:

1. **bob 1.13.2 needs Java 25+** — the system JDK (21) fails with
   `UnsupportedClassVersionError`. The flake uses `temurin-jre-bin-25`.
2. **bob unpacks bundled native libs AND executables** (`libmodelc_shared.so`,
   `gltf_validator`, …) **into a fresh `/tmp` dir on every run** and
   `System.load`/exec's them. On NixOS the `.so`s need `libstdc++`/X11 and the
   executables need `/lib64/ld-linux` — none in default paths, and since the
   unpack dir is ephemeral they cannot be patchelf'd in place. Fix: bob runs
   the JVM inside an FHS env (`buildFHSEnv`) providing exactly those libs.
   `dmengine_headless` is a plain dynamic binary → an `autoPatchelfHook`
   derivation handles it.

## Phase 2 — chibi 3D world (2026-10-01)

A procedurally generated chibi-style 3D demo world in the same Defold
1.13.2 project (`tiny-game/`), built end-to-end from code — no external
assets. 39 flat-shaded `.gltf` meshes from `tools/gen_meshes.py` (pastel
palette, baked pseudo-lighting), 12 collections from
`tools/gen_collections.py`, and three Lua scripts:
`main/main.script` (deterministic spawner, seed 1234), `main/player.script`
(WASD/arrows + Space hop, walk-cycle limb animation, prints
`CHIBI WORLD READY` once), `main/cloud.script` (drifting clouds).
World: chibi player (~1.6u, oversized head), house with door/windows,
biome ring (52 scattered grass tufts/flowers/rocks, 12 trees incl. pink &
orange, a pond, 7 snow-capped mountains), third-person follow camera.

### The web-boot saga (root cause + fix)
The HTML5 bundle built clean and served fine, but the engine died before
executing a line (main returns 1, zero logs) in both headless-shell and
full Chrome. Debug-variant logs eventually exposed it:
`ERROR:RENDER: ... bad header in precompiled chunk` on
`builtins/render/default.render_script` → bootstrap load fails → exit(1).

**Root cause:** `bob bundle` does not rebuild; it packs whatever
`build/default/game.arci` a previous `bob build --archive` left behind.
The archive from the native (x86_64) headless regression builds held
LuaJIT bytecode; the wasm engine runs PUC Lua and rejects it. Every wasm
bundle silently inherited the stale native archive. Release builds were
log-silent (EMS release dmLog routes to the @log socket, no console), so
only a `--variant=debug` bundle showed the error.

**Fix (correct sequence, always from a matching platform build):**
```
rm -rf build
java ... -jar bob.jar build  --platform=wasm-web --variant=<v> --archive
java ... -jar bob.jar bundle --platform=wasm-web --variant=<v>
```
Do not let a native `--archive` build be the last build before bundling
for wasm (or vice versa). Also: bob failures can hide behind pipes —
`bob build ... | tail -1` exits 0 even on SEVERE; check bob's exit code
with `pipefail`.

### Renderer/world bugs found by actually looking at screenshots
The first successful web render was a black void with floating orbs;
the headless regression had never exercised graphics. Four real bugs:
1. **`EmbeddedComponentDesc` has no `scale3` field.** Component positions
   were emitted but scales silently rejected → every multi-part model
   collapsed to its GO origin (house inside itself, trees = floating
   balls, pond at spawn). Fix: bake scale into mesh variants
   (`sphere_cloud_a/b/c`, `box_path_slim`, squashed `sphere_hair`,
   resized `cone_mountain_snow`); `model_comp` now hard-fails on scale.
   (Instances *do* support scale3.)
2. **Clear color keys**: engine reads `render.clear_color_red/_green/
   _blue/_alpha` (engine.cpp:1302) — a single `clear_color = r g b a`
   line is ignored → black sky. Split into four keys.
3. **Ground plane winding**: triangles faced down → back-face culled
   from above. Flipped to (0,2,1),(0,3,2).
4. **Movement rotation sign**: `wz` used the wrong R_y sign, so "up"
   walked toward the camera. Camera also re-framed: child GO at
   (0, 2.4, 6.0), pitched −0.36 rad about X, so the chibi is in frame.

### Verified results
- Native headless: `CHIBI WORLD READY` + `WORLD SPAWNED`, zero errors.
- Debug wasm in full Chrome 154: boots, `CHIBI WORLD READY`, WebGL2.
- Release wasm boots and plays (smoke-tested with synthetic input).
- Screenshots `screenshots/01_spawn.png` … `05_back.png` (debug) +
  `06_release.png`: sky-blue, green ground, chibi on the path, house,
  trees/pond/mountains; walk/strafe/back sequences all move correctly.
- Package: `html5-build/` + `chibi-world-html5.zip` (2.5MB, includes
  README_RUN.txt). Controls: WASD/arrows move, Space hop. Serve
  `html5-build/` over HTTP (needs WebGL2); COOP/COEP only for the
  pthread variant.

## Civlings Phase 2 — isometric city grid (2026-10-02)

The `civlings/` project now renders the Genesis City hub and moves its
first worker:

- **Fixed 45° isometric camera**: an orthographic camera GO on the
  (+1,+1,+1) diagonal looking at the grid origin (no follow, no input).
- **10×10 grid, 4 tiers** (`main/iso.lua`): Chebyshev rings from the
  centre — plaza (4), core (12), outer (48), edge (36) — one baked tile
  mesh per tier, tops stepped 0.16 → 0.06 units. Border trees/rocks and
  the PoC mountains dress the outside; the PoC pond/paths were removed
  from the `world` GO.
- **First Civling** (`main/civling.script`): the chibi humanoid, spawned
  on the plaza. Mouse clicks unproject through the camera basis onto the
  ground plane (`iso.pick`), then BFS (`iso.find_path`) walks it
  cell-to-cell with the walk-cycle rig. Prints `CIVLING READY at (c,r)`,
  `CIVLING GOTO (c,r)`, `CIVLING ARRIVED (c,r)`.

### Gotchas found this phase
- Camera component fields are `orthographic_projection: 1` +
  `orthographic_mode: ORTHO_MODE_FIXED` — there is no `orthographic`
  field; bob rejects it (`dmGamesysDDF.CameraDesc.orthographic`).
- `collectionfactory.create` URLs are scoped: `#id` only finds
  components on the script's own GO. Factories on a sibling GO need the
  full `tilefactories#tile_plaza_factory` form.
- The shared `cube()` in `gen_meshes.py` winds every face **inward**
  (normals point into the box). Chunky boxes read fine, but thin slabs
  (0.06–0.16 tall) render inside-out under backface culling — the grid
  showed half-diamonds and wall "spikes". Tiles use a dedicated
  `tilebox()` with outward winding; winding verified per-face by cross
  product.
- Pick math is self-verifying: `tools/verify-phase2.mjs` clicks the
  screen point computed with the *inverse* of `iso.pick` and asserts the
  logged cell is the target — 6/6 PASS, screenshots
  `civlings/screenshots/02_grid.png` (grid at spawn) and `03_moved.png`
  (after the walk to (8,7)).
