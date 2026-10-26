# GUI 開発ガイド

NXC LOUNGE は Nixpkgs のパッケージを検索・管理するデスクトップ GUI で、React / TypeScript、Vite、Tailwind CSS、Tauri 2 を利用しています。Nix profile から導入できる `nxc-app` Flake package を提供しています。このページでは、GUI をソースから変更・起動するための開発環境を説明します。

## 必要な環境

- Nix が利用可能な x86_64 Linux 環境（`x86_64-linux`）
- Rust / Cargo
- Node.js（CI では Node.js 24 を利用）
- pnpm（CI では pnpm 11.9.0 を利用）
- Tauri 2 の Linux ビルド・実行に必要なライブラリ

開発に必要なシステムライブラリと環境変数は、リポジトリの Nix Flake 開発シェルで用意します。

## リポジトリを取得して開発シェルへ入る

```sh
git clone https://github.com/nxc-project/nixos-json-controller.git
cd nixos-json-controller
nix develop
```

Wayland では、WebKitGTK が正しい画面倍率を取得できるように GTK / GSettings の環境設定が必要です。通常のシェルから直接起動すると設定が不足することがあるため、リポジトリルートで `nix develop` を実行してください。

Nix で `nix-command` または `flakes` が無効だというエラーが出る場合は、ユーザー設定ファイル `~/.config/nix/nix.conf` に以下を設定してから、再度 `nix develop` を実行します。

```ini
experimental-features = nix-command flakes
```

## Frontend の依存関係をインストール

開発シェル内で実行します。

```sh
cd frontend
pnpm install --frozen-lockfile
```

## GUI を起動

```sh
pnpm tauri dev
```

Frontend の `tauri` スクリプトは、リポジトリの Nix Flake から AppStream データを用意し、そのパスを `NXC_APPSTREAM_DATA` として Tauri CLI に渡します。GUI の開発起動には Nix とリポジトリの Flake が必要です。

## Frontend のチェック

すべて `frontend` ディレクトリで実行します。

```sh
pnpm format:check
pnpm test
pnpm lint
pnpm build
```

| コマンド | 内容 |
| --- | --- |
| `pnpm format:check` | Frontend のフォーマットチェック |
| `pnpm test` | Frontend の自動テスト |
| `pnpm lint` | ESLint による静的チェック |
| `pnpm build` | TypeScript のチェックと Vite の本番用 Frontend ビルド |

Frontend のビルドに成功しても、Tauri の本番パッケージやデスクトップランチャー統合が完成したことにはなりません。

## Nix profile からの利用

GUI は CLI から独立した package としてインストールできます。通常利用ではリポジトリの checkout や開発シェルは必要ありません。

インストール：

```sh
nix profile install github:nxc-project/nixos-json-controller#nxc-app
```

インストール後はアプリランチャーの **NXC LOUNGE** から起動するか、ターミナルで `nxc-app` を実行します。

更新する際は、先に profile element 名を確認します。

```sh
nix profile list
nix profile upgrade nxc-app --refresh
```

削除する場合：

```sh
nix profile remove nxc-app
```

element 名が異なる環境では、`nix profile list` に表示された実際の名前を使用してください。GUI の更新・削除は CLI `nxc` の profile element には影響しません。

package は現在 `x86_64-linux` 向けです。Flake package のビルドと Desktop Entry・静的アイコン・AppStream / GSettings の実行環境の基本検査は CI で確認しています。実機の profile 更新とランチャー起動も確認済みです。