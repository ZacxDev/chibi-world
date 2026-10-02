CHIBI WORLD — a tiny Defold 3D demo
==================================

A procedurally-built chibi-style 3D scene in Defold 1.13.2: a controllable
chibi player (oversized head, walk-cycle animation), a little house with a
door, pastel biome dressing (trees, grass tufts, flowers, rocks, drifting
clouds), generated from scratch as code (meshes + collections produced by
small Python generators — no external assets).

CONTROLS
--------
  W / A / S / D  or Arrow keys   Move
  Space                          Hop

HOW TO RUN (HTML5 build)
------------------------
The folder `html5-build/` contains a standard Defold web bundle:
  index.html, dmloader.js, tinygame.wasm, archive/

Serve the folder over HTTP (WASM/threads need a real origin; file:// will not
work). Any static server is fine, e.g.:

  cd html5-build
  python3 -m http.server 8899
  # then open http://127.0.0.1:8899/ in a desktop browser (Chrome/Edge/
  # Firefox/Safari). The engine needs WebGL2.

Tip: for the threaded (pthread) WebAssembly variant, serve with
Cross-Origin-Opener-Policy: same-origin and
Cross-Origin-Embedder-Policy: require-corp headers; the plain single-thread
build works without them.

PROJECT SOURCE
--------------
  Project:        scratch-defold/tiny-game/   (Defold 1.13.2 project)
  Mesh generator: tiny-game/tools/gen_meshes.py     (39 .gltf meshes)
  Scene builder:  tiny-game/tools/gen_collections.py (player/house/trees/…)
  Scripts:        tiny-game/main/player.script (movement + walk cycle),
                  main/cloud.script (drifting clouds), main/main.script
                  (deterministic world spawner)

Verified: native headless build+run is green (prints "CHIBI WORLD READY");
the HTML5 bundle was built with bob and verified running in Chrome
(boots, renders, WASD movement works — see scratch-defold/screenshots/,
01_spawn.png through 06_release.png).
