# Chibi World — NixOS-friendly dev environment for the Defold 1.13.2 project.
#
#   nix run .#build-native    build headless + run it (prints CHIBI WORLD READY)
#   nix run .#bundle-html5    fresh wasm-web release bundle -> html5-build/
#   nix develop               interactive shell (bob, dmengine_headless, python3, node)
#
# Why this exists (walls hit on NixOS, see NOTES.md for the project-level story):
# - bob 1.13.2 requires Java 25+ (system JDK 21 fails with UnsupportedClassVersionError).
# - bob unpacks bundled native libs AND executables (gltf_validator...) into a
#   fresh /tmp dir every run and System.load/exec's them. On NixOS they fail:
#   the .so's need libstdc++/X11 and the executables need /lib64/ld-linux. They
#   cannot be patchelf'd in place (ephemeral unpack), so bob runs the JVM inside
#   an FHS env providing those libs.
# - dmengine_headless is a plain dynamic binary -> auto-patched into the store.
{
  inputs.nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";

  outputs = { self, nixpkgs }:
    let
      system = "x86_64-linux";
      pkgs = nixpkgs.legacyPackages.${system};

      defoldRev = "20692b3a510a29dde4df99401f0881bfcec1d9fb"; # Defold 1.13.2

      bobJar = pkgs.fetchurl {
        url = "https://d.defold.com/archive/${defoldRev}/bob/bob.jar";
        hash = "sha256-WKvio52WqtSfFkkg/D84dBG/6uIGrN3BBl38zZNt4CY=";
      };

      dmengineHeadless = pkgs.stdenv.mkDerivation {
        pname = "dmengine-headless";
        version = "1.13.2";
        src = pkgs.fetchurl {
          url = "https://d.defold.com/archive/${defoldRev}/engine/x86_64-linux/dmengine_headless";
          hash = "sha256-S2TaGBFrxlS9FUqT0jOJh+ugx3iIsRySgbc7WgMmRvU=";
        };
        nativeBuildInputs = [ pkgs.autoPatchelfHook ];
        buildInputs = with pkgs; [ gcc.cc.lib libx11 libxext libxi openal ];
        dontUnpack = true;
        installPhase = ''
          install -Dm755 "$src" "$out/bin/dmengine_headless"
        '';
      };

      bob = pkgs.buildFHSEnv {
        name = "bob";
        runScript = pkgs.writeShellScript "bob-run" ''
          exec java -jar ${bobJar} "$@"
        '';
        targetPkgs = p: with p; [
          p.temurin-jre-bin-25
          p.gcc.cc.lib
          p.libx11
          p.libxext
          p.libxi
          p.zlib
        ];
      };

      buildNativeScript = pkgs.writeShellScript "build-native" ''
        cd tiny-game
        ${bob}/bin/bob resolve build --variant headless --archive
        exec ${dmengineHeadless}/bin/dmengine_headless build/default
      '';

      bundleHtml5Script = pkgs.writeShellScript "bundle-html5" ''
        cd tiny-game
        rm -rf build html5-build
        ${bob}/bin/bob build --platform=wasm-web --variant=release --archive
        ${bob}/bin/bob bundle --platform=wasm-web --variant=release
        cp -r build/default/tiny-game html5-build # bundle lands at build/default/<project-name>
        echo "html5-build/ ready: serve it over HTTP and open in a WebGL2 browser"
      '';

    in
    {
      packages.${system} = {
        bob = bob;
        dmengine-headless = dmengineHeadless;
      };

      buildNativeScript = pkgs.writeShellScript "build-native" ''
        cd tiny-game
        ${bob}/bin/bob resolve build --variant headless --archive
        exec ${dmengineHeadless}/bin/dmengine_headless build/default
      '';

      apps.${system} = {
        # Run from the repo root. Native headless build + run; the engine prints
        # CHIBI WORLD READY / WORLD SPAWNED and keeps running (Ctrl-C to stop).
        build-native = {
          type = "app";
          program = "${buildNativeScript}";
        };

        # Run from the repo root. NOTES.md "web-boot saga": bundle packs whatever
        # archive the LAST bob build left — always rm + rebuild for wasm-web
        # before bundling, never bundle over a native --archive build.
        bundle-html5 = {
          type = "app";
          program = "${bundleHtml5Script}";
        };
      };

      devShells.${system}.default = pkgs.mkShell {
        packages = with pkgs; [
          bob
          dmengineHeadless
          python3 # tiny-game/tools/gen_meshes.py, gen_collections.py
          nodejs # tools/*.mjs probe/driver scripts
          zip # package html5-build/ for release
        ];
      };
    };
}