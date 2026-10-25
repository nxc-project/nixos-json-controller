{
  description = "NixOS JSON Controller";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
    nixos-appstream-data = {
      url = "github:snowfallorg/nixos-appstream-data";
      inputs.nixpkgs.follows = "nixpkgs";
    };
  };

  outputs = { self, nixpkgs, nixos-appstream-data }:
    let
      system = "x86_64-linux";
      pkgs = import nixpkgs {
        inherit system;
      };
      appstreamData = nixos-appstream-data.packages.${system}.appstream-data-all;
      gsettingsSchemaDirs = [
        "${pkgs.gsettings-desktop-schemas}/share/gsettings-schemas/${pkgs.gsettings-desktop-schemas.name}"
        "${pkgs.gtk3}/share/gsettings-schemas/${pkgs.gtk3.name}"
      ];
      gsettingsSchemasPath = builtins.concatStringsSep ":" gsettingsSchemaDirs;
    in
    {
      devShells.${system}.default = pkgs.mkShell {
        nativeBuildInputs = with pkgs; [
          cargo
          nodejs
          pkg-config
          pnpm
          rustc
          wrapGAppsHook4
        ];

        buildInputs = with pkgs; [
          dbus
          glib
          gsettings-desktop-schemas
          gtk3
          librsvg
          libsoup_3
          openssl
          webkitgtk_4_1
        ];

        # WebKitGTK on Wayland needs these schemas to detect the display scale.
        GSETTINGS_SCHEMAS_PATH = gsettingsSchemasPath;
        shellHook = ''
          export XDG_DATA_DIRS="$GSETTINGS_SCHEMAS_PATH:''${XDG_DATA_DIRS:-/usr/local/share:/usr/share}"
        '';
      };

      packages.${system} = {
        appstream-data = appstreamData;

        nxc-app = pkgs.rustPlatform.buildRustPackage (finalAttrs: {
          pname = "nxc-app";
          version = "0.1.0";

          src = ./.;

          # The Tauri crate has its own lockfile and depends on the root CLI crate.
          cargoRoot = "frontend/src-tauri";
          buildAndTestSubdir = "frontend/src-tauri";
          cargoLock.lockFile = ./frontend/src-tauri/Cargo.lock;

          # pnpm dependencies are fetched from the frontend lockfile into a
          # fixed-output store, then installed offline inside the build sandbox.
          pnpm = pkgs.pnpm_11;
          pnpmDeps = pkgs.fetchPnpmDeps {
            inherit (finalAttrs) pname version;
            src = ./frontend;
            inherit (finalAttrs) pnpm;
            fetcherVersion = 4;
            hash = "sha256-r1ODhx/zWEyTXugc9xMiV7ydrT6M4BwJKNVOw1pnUYM=";
          };
          pnpmRoot = "frontend";

          nativeBuildInputs = with pkgs; [
            cargo-tauri.hook
            nodejs
            pkg-config
            finalAttrs.pnpm
            pnpmConfigHook
            makeWrapper
            wrapGAppsHook4
          ];

          buildInputs = with pkgs; [
            glib
            glib-networking
            gtk3
            librsvg
            libsoup_3
            openssl
            webkitgtk_4_1
          ];

          # Desktop integration must work from a profile, without the dev shell.
          # wrapGAppsHook4 uses this at fixup time to preserve user XDG_DATA_DIRS
          # while adding the schema paths and default /usr/share fallbacks.
          GSETTINGS_SCHEMAS_PATH = gsettingsSchemasPath;

          # Cargo names the executable after the Rust package ("app"); expose
          # a stable command name and an explicit desktop entry with a static icon.
          postInstall = ''
            mv "$out/bin/app" "$out/bin/nxc-app"

            mkdir -p "$out/share/applications"
            rm -f "$out/share/applications/"*.desktop
            cat > "$out/share/applications/nxc-app.desktop" <<'EOF'
[Desktop Entry]
Type=Application
Name=nxc App Store
Comment=Browse and manage NixOS packages
Exec=nxc-app
Icon=nxc-app
Terminal=false
Categories=System;Utility;
EOF

            install -Dm644 ${./frontend/src-tauri/icons/32x32.png} \
              "$out/share/icons/hicolor/32x32/apps/nxc-app.png"
            install -Dm644 ${./frontend/src-tauri/icons/128x128.png} \
              "$out/share/icons/hicolor/128x128/apps/nxc-app.png"
            install -Dm644 ${./frontend/src-tauri/icons}/128x128@2x.png \
              "$out/share/icons/hicolor/256x256/apps/nxc-app.png"

            wrapProgram "$out/bin/nxc-app" \
              --set NXC_APPSTREAM_DATA ${appstreamData} \
              --prefix GSETTINGS_SCHEMAS_PATH : ${gsettingsSchemasPath}

            # Fail the build if the app launcher contract or its static assets
            # drift away from the command and icon names used by the package.
            for field in \
              "Type=Application" \
              "Name=nxc App Store" \
              "Exec=nxc-app" \
              "Icon=nxc-app" \
              "Terminal=false" \
              "Categories=System;Utility;"; do
              grep -Fxq "$field" "$out/share/applications/nxc-app.desktop"
            done
            test -x "$out/bin/nxc-app"
            test -s "$out/share/icons/hicolor/32x32/apps/nxc-app.png"
            test -s "$out/share/icons/hicolor/128x128/apps/nxc-app.png"
            test -s "$out/share/icons/hicolor/256x256/apps/nxc-app.png"
            grep -Fq "${appstreamData}" "$out/bin/nxc-app"
            grep -Fq "${builtins.elemAt gsettingsSchemaDirs 0}" "$out/bin/nxc-app"
            grep -Fq "${builtins.elemAt gsettingsSchemaDirs 1}" "$out/bin/nxc-app"
          '';

          doCheck = false;

          meta = {
            description = "nxc App Store GUI";
            mainProgram = "nxc-app";
            platforms = [ "x86_64-linux" ];
          };
        });

        default = pkgs.rustPlatform.buildRustPackage {
          pname = "nixos-json-controller";
          version = "0.1.0";

          src = ./.;

          cargoLock = {
            lockFile = ./Cargo.lock;
          };

          # Cargo tests run in the dedicated CI test job. Keep this derivation
          # focused on validating the distributable CLI and its wrapper.
          doCheck = false;

          nativeBuildInputs = [ pkgs.makeWrapper ];

          postInstall = ''
            mv $out/bin/nixos-json-controller $out/bin/nxc
            wrapProgram $out/bin/nxc \
              --set NXC_APPSTREAM_DATA ${appstreamData}
          '';
        };
      };
    };
}
