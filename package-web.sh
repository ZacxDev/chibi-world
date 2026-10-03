#!/usr/bin/env bash
# Build the Civlings HTML5 bundle and package it under civlings/web/game/
# with the Lua<->JS bridge injected into the generated index.html.
# bob regenerates index.html on every bundle, so the injection is re-applied
# each run (idempotent). Debug variant so Lua prints reach the console.
set -euo pipefail
cd "$(dirname "$0")"
export PATH=$HOME/workspace/tools/jdk25/bin:$PATH
BOB=$HOME/workspace/tools/defold-toolchain/bob.jar
VARIANT=${VARIANT:-debug}

rm -rf build
java -jar "$BOB" build --platform=wasm-web --variant=$VARIANT --archive
java -jar "$BOB" bundle --platform=wasm-web --variant=$VARIANT --bundle-output bundle-tmp

rm -rf web/game
mkdir -p web/game
# bob nests the bundle under a folder named after the project title.
cp -r bundle-tmp/Civlings/. web/game/
rm -rf bundle-tmp
cp web/game-bridge.js web/game/game-bridge.js

python3 - <<'PY'
p = "web/game/index.html"
s = open(p).read()
tag = '<script type="text/javascript" src="game-bridge.js"></script>'
if "game-bridge.js" not in s:
    marker = 'src="dmloader.js"'
    i = s.index(marker)
    # Insert AFTER the dmloader element's closing tag — inserting right
    # after the opening tag would bury our tag in the script's raw text.
    j = s.index("</script>", i) + len("</script>")
    s = s[:j] + "\n\t" + tag + s[j:]
# Strip the template chrome: the white footer bar (Fullscreen button +
# "Made with Defold" credit) and its light page background. bob
# regenerates this file each build, so re-apply every time.
import re
s2 = re.sub(r'\s*<div class="buttons-background">.*?</div>\s*</div>', '', s, flags=re.S)
assert 'class="buttons-background"' not in s2, "chrome strip missed"
if 'civlings-chrome' not in s2:
    s2 = s2.replace('</head>',
      '<style id="civlings-chrome">body,.canvas-app-container{background:#0b0c0e !important}</style>\n</head>', 1)
open(p, "w").write(s2)
print("bridge injected + chrome stripped: web/game/index.html" if "game-bridge.js" not in s else "chrome stripped: web/game/index.html")
PY
echo "packaged: web/game/"
