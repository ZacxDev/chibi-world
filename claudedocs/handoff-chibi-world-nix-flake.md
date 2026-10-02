# Handoff: chibi-world-nix-flake — 2026-10-02

## Run this first — the index, one command
```bash
$DEVRC/scripts/cairn-ops/read.sh recall --repo "/home/zach/workspace/chibi-world"
```
Terse pointers this doc does not carry, curated by past sessions and outliving it.
🔴 RECALL, NOT LIVE OBSERVATION — every line is a pointer to VERIFY, never a current
reading. `scope-absent`/`scope-empty` means nothing is recorded yet: ordinary, not an
error. Non-blocking: if it exits non-zero, print the stderr line and carry on.

## Goal
Clone ZacxDev/chibi-world (Muse-built Defold 1.13.2 chibi 3D demo), get it running on NixOS, and make future runs zero-setup: a hash-pinned Nix flake plus docs that record the toolchain source and the NixOS walls.
- **closing-condition:** `check` — `cd /home/zach/workspace/chibi-world && timeout 90 nix run .#build-native 2>&1 | grep -c 'CHIBI WORLD READY'` returns 1, AND `git -C /home/zach/workspace/chibi-world log --oneline -3` shows flake `d15e663` and docs `e20d6d9` on main. VERDICT: ADDRESSED ⇒ arc CLOSED · NOT ⇒ name the one item.

## State now
- Branch/PR: `main` == `origin/main` at `e20d6d9`, clean tree, no open PRs.
- DONE this session:
  - Cloned repo to `/home/zach/workspace/chibi-world`; verified Muse's push claims live (`ZacxDev/chibi-world` public, 117 files on main).
  - Rebuilt the toolchain this host lacked: `~/workspace/tools/defold-toolchain/{bob.jar,dmengine_headless}` from `https://d.defold.com/archive/20692b3a510a29dde4df99401f0881bfcec1d9fb/bob/bob.jar` and `.../engine/x86_64-linux/dmengine_headless`; Java via `temurin-jre-bin-25` (system JDK is 21; bob 1.13.2 needs 25+).
  - Native headless build+run green: `CHIBI WORLD READY` + `WORLD SPAWNED: player at (0,0,6), house at (0,0,-7.5)`.
  - HTML5 bundle built with the NOTES.md-correct sequence (rm build → `bob build --platform=wasm-web --variant=release --archive` → `bob bundle`), served on `127.0.0.1:8899`, verified boots+renders in Brave (browser-bridge screenshots of own tabs; tabs closed after).
  - `flake.nix` + `flake.lock` (PR #1, merged `d15e663`): pins both artifacts by SRI hash; `buildFHSEnv` wraps bob (NixOS loader walls); `autoPatchelfHook` derivation for dmengine; apps `.#build-native`, `.#bundle-html5`; devShell with bob/dmengine/python3/node/zip. `nix flake check` clean; both apps verified live; devShell spot-checked (bob 1.13.2, Python 3.14, Node 24).
  - Docs per Muse's outlined change-set (PR #2, merged `e20d6d9`): README "Run it" leads with flake commands (editor/manual kept as fallback); NOTES.md carries the canonical d.defold.com URLs, a machine-specific warning on `~/workspace/tools/*`, and a "Zero-setup via Nix (2026-10-02)" section (Java 25 + ephemeral-/tmp native-unpack → FHS).
- IN FLIGHT: nothing.
- Deploy/verify: no deploy target; everything above verified against the real run paths. A background static server (`python3 -m http.server 8899` in `tiny-game/html5-build/`) is still serving — stop it via `ss -lptn 'sport = :8899'` → PID when done with it.
- Muse (the repo's author agent): its stored GitHub PAT went **401 "Bad credentials"** mid-docs-update, so it could not push (it committed `7ce2782` locally on its own machine). On follow-up it discarded that commit and mirrors `e20d6d9` byte-for-byte, and has no quarrel with the doc phrasing. Re-linking the connector is an operator browser action; until then Muse hands changes over instead of pushing.

## Next steps (ranked)
1. Re-link Muse's GitHub connector so it can push to ZacxDev/chibi-world itself — its PAT 401s on everything; the re-auth is an operator browser action on muse.ai (same "Connect" flow that created the credential).
   forcing: user
2. Decide repo visibility: Muse set ZacxDev/chibi-world **public** when it pushed ("you ship in the open"); flip to private with `gh repo edit ZacxDev/chibi-world --visibility private` if that's not wanted.
   forcing: user
3. Optional polish: re-run `tiny-game/tools/gen_meshes.py` + `gen_collections.py` through `nix develop` and confirm the generators still reproduce the assets the built archive contains — they were only exercised via the prebuilt bundle, never re-generated on this host.
   forcing: none
4. Register the `chibi-world` scope in the subsystem-index routing table so the store can hold an entry: add `"chibi-world": "personal"` to the source of `~/.config/subsystem-store/routes.json` in the devrc repo (the deployed file is a read-only nix-store symlink — needs a devrc PR + `home-manager switch`), then write the pending first entry: `python3 /home/zach/workspace/devrc/scripts/lib/subsystem_touch.py --template flake --scope chibi-world --writer handoff` → `cairn create --scope chibi-world --repo /home/zach/workspace/chibi-world --ref flake --file <filled>` (draft content in this session's scratch: `/tmp/opencode/cairn-entry-chibi-world-flake.md` — may be gone; re-derive from NOTES.md).
   forcing: none

## Defects (batched)
- None open.

## Gotchas / decisions / dead-ends
- **bob on NixOS**: its bundled native libs AND executables unpack into a FRESH `/tmp` dir every run — patchelf-in-place is impossible; the fix in flake.nix is an FHS env. Missing libs measured exactly: `libstdc++.so.6`, `libX11.so.6`, `libXext.so.6`, `libXi.so.6` (plus `libopenal.so.1` for `dmengine_headless`).
- **`nix run .#build-native` never exits on its own** — the world loops forever; wrap in `timeout` and grep for `CHIBI WORLD READY` (rc 124 = it ran fine until the timeout).
- `bob bundle` lands at `tiny-game/build/default/<project-name>/` (title from game.project), NOT `html5-build/` — the flake app copies it there.
- NOTES.md "web-boot saga" still applies: never let a native `--archive` build be the last build before a wasm bundle (LuaJIT bytecode breaks wasm) — the flake app does rm + fresh wasm build first.
- First `nix run` of the flake pulls a large store closure (nixpkgs-unstable + Temurin + ~233MB bob.jar); one-time, cached after.
- Flake authoring: app `program` must be a STRING (`program = "${script}"`); a bare derivation fails `nix flake check`, and interpolating `writeShellScript` inline inside the string mangles the generated script (produced a `}`-only file). Keep scripts as named `let` values.
- This fresh clone had no git identity; set repo-local `user.name "Zach Lowden"` / `user.email hello@zacx.dev` (matches devrc's).
- The html5 pthread variant needs COOP/COEP headers; the plain single-thread build does not.

## How to verify
```bash
cd /home/zach/workspace/chibi-world
timeout 90 nix run .#build-native 2>&1 | grep -m1 'CHIBI WORLD READY'
nix run .#bundle-html5 && ls tiny-game/html5-build/index.html
(cd tiny-game/html5-build && python3 -m http.server 8899)  # then open http://127.0.0.1:8899 in a WebGL2 browser
```
