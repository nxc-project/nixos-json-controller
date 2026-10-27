# NixOS JSON Controller（NXC）

NXC は、NixOS の設定を安全に変更する CLI コントローラーと、Nixpkgs のパッケージを検索・管理するデスクトップ GUI「NXC LOUNGE」を開発するプロジェクトです。

CLI ではパッケージの追加・削除やサービスの有効化・無効化を NixOS の宣言的な設定に反映し、必要に応じて nixos-rebuild switch まで実行します。GUI では Nixpkgs のパッケージを検索し、アプリの詳細やインストール状態を確認してインストール操作を行えます。

## 現在の状態

- **CLI：** Nix profile からインストールして利用できます。
- **GUI（NXC LOUNGE）：** React / TypeScript と Tauri 2 で実装し、Nix Flake の `nxc-app` package として `x86_64-linux` 向けに提供しています。
- **GUI の配布：** Nix profile からのインストール・更新・削除と、アプリランチャーからの起動を実機で確認済みです。CLI の `nxc` とは独立して管理できます。
- **開発中の GUI 機能：** インストール済みアプリの管理、インストール制約に合うパッケージの表示、スクロール時の表示問題などを Issue で管理しています。主な項目は [#102](https://github.com/nxc-project/nixos-json-controller/issues/102)、[#134](https://github.com/nxc-project/nixos-json-controller/issues/134)、[#162](https://github.com/nxc-project/nixos-json-controller/issues/162) です。

現在の Flake package は x86_64-linux を対象としています。

## 主な機能

### CLI

- NixOS パッケージの追加・削除
- NixOS サービスの有効化・無効化
- 登録された日本語名などの別名によるパッケージ・サービス指定
- NixOS 用 Flake の探索と選択結果の保存
- 現在の system generation、パッケージ、コマンド、サービス状態の表示
- NixOS 設定に宣言されたパッケージの一覧・検索
- パッケージやサービスの状態、宣言元、編集対象の説明
- 実行計画を確認する dry-run
- Nix 評価や rebuild 後の検証、および失敗時のロールバック処理

### GUI（NXC LOUNGE）

- Nixpkgs を利用したパッケージ検索
- アプリの説明・バージョン・カテゴリ・タグ・ホームページなどの詳細表示
- 現在の NixOS におけるインストール状態の表示
- 検索結果や詳細画面からのインストール操作
- sudo 認証が必要な場合のパスワード入力 UI
- AppStream やローカルのアイコンテーマを利用したアイコン解決

NXC LOUNGE は `nxc-app` という GUI 専用の Flake package として配布できます。インストール・更新・削除は CLI の `nxc` と独立して行えます。手順は「GUI のインストールと管理」を参照してください。

---

# CLI のインストール

## Nix profile からインストールする

NixOS 上で、リポジトリの default package をインストールします。

    nix profile install github:nxc-project/nixos-json-controller

インストールできたら、コマンドを確認します。

    nxc --help

NXC 自身を利用者の NixOS configuration の flake.nix に追加する必要はありません。ユーザーの Nix profile で管理できます。

### 更新

まず、インストール済みの profile element 名を確認します。

    nix profile list

表示された NXC の element 名を使って更新します。通常は次のコマンドを利用できます。

    nix profile upgrade nixos-json-controller

profile element 名が異なる場合は、nix profile list の結果に合わせて指定してください。

### 削除

profile 内の NXC の element 名を確認し、その element を削除します。

    nix profile list
    nix profile remove nixos-json-controller

削除対象の名前が異なる場合は、実際に表示された名前を指定してください。NXC を profile から削除しても、NixOS の設定に NXC 自身を登録しているわけではありません。

## ソースから CLI をビルドする

開発や調査のためにソースからビルドする場合は、Rust と Cargo が必要です。

    git clone https://github.com/nxc-project/nixos-json-controller.git
    cd nixos-json-controller
    cargo build --release

生成される CLI 実行ファイルは次の場所です。

    target/release/nixos-json-controller

ローカルで nxc という名前で利用したい場合は、PATH の通ったユーザー用ディレクトリなどへ配置してください。

    install -Dm755 target/release/nixos-json-controller ~/.local/bin/nxc

これはソースから実行ファイルを配置する方法です。Nix profile による管理や、GUI の本番インストールとは別の方法です。

---

# CLI の基本的な使い方

設定を変更する前に、NixOS configuration の Flake を探索します。

    nxc discover

Discovery が完了したら、パッケージやサービスの操作を行います。

## パッケージ

インストール：

    nxc i firefox

操作名を省略してもインストールできます。

    nxc firefox

削除：

    nxc r firefox

変更を行わず、実行予定の内容だけを確認する場合：

    nxc i firefox --dry-run

dry-run は設定変更と nixos-rebuild を実行せず、実行計画を確認するための機能です。実際の設定変更が必要な操作では、権限や対象の設定構造などに応じて処理が拒否されることがあります。

## サービス

サービスの有効化：

    nxc e openssh

無効化：

    nxc d openssh

辞書に登録された別名も利用できます。たとえば ssh や sshd は openssh として解決されます。

## 状態確認

NXC と現在の NixOS system の情報：

    nxc status

NixOS configuration で宣言されているパッケージ一覧：

    nxc list

宣言されているパッケージの検索：

    nxc search firefox

パッケージの状態・宣言元を確認：

    nxc explain package firefox

サービスの状態・宣言元を確認：

    nxc explain service openssh

すべてのコマンドとオプションは次で確認できます。

    nxc --help

---

# NixOS configuration の Discovery

NXC は対象となる NixOS Flake と configuration を探索し、選択結果を保存します。

    nxc discover

Discovery は単純に flake.nix の存在だけで判断するものではありません。候補となる Flake を調査し、Nix の評価によって nixosConfigurations などを確認して対象を決めます。

Discovery 結果は次の場所に保存されます。

    ~/.config/nxc/discovery.json

通常の操作では、この保存済み情報が使われます。flake.nix / flake.lock や環境が Discovery 時点から変わっているなど、保存情報が現在の環境と一致しない場合、NXC は古い情報を使ったまま変更を続けず、Discovery の再実行を要求します。

NixOS 設定の場所や構成を変更した場合は、再度 Discovery を実行してください。

    nxc discover

---

# CLI の一覧・検索について

## nxc list

nxc list は、評価された NixOS configuration の environment.systemPackages に宣言されているパッケージを一覧表示します。

これは、現在の system に存在するすべてのアプリやコマンドの一覧でも、Nixpkgs 全体の検索結果でもありません。

## nxc search

nxc search は、NixOS configuration に宣言されているパッケージ集合から検索します。

    nxc search firefox

検索結果では主に次の情報を確認できます。

- パッケージが NixOS 設定に宣言されていること
- 現在の system に存在するかどうか
- 宣言元の設定ファイル
- system-wide な実行ファイルの場所（該当する場合）

そのため、Nixpkgs のパッケージを自由に検索する GUI のカタログ検索とは役割が異なります。

---

# 安全性と設定変更の流れ

NXC はユーザーの NixOS 設定を無条件に書き換えることを目的としていません。対象、変更先、設定構造を確認し、可能な場合は NXC 専用 module へ変更を分離します。書き換え先を確実に判断できない場合などは、安全側に停止することがあります。

概念的な処理の流れは次のとおりです。

    入力
      ↓
    入力検証
      ↓
    パッケージ・サービス名の解決
      ↓
    実行計画の作成
      ↓
    設定変更
      ↓
    Nix 評価
      ↓
    nixos-rebuild switch
      ↓
    結果の検証

パッケージの追加・削除とサービスの有効化・無効化では、`rebuild` が有効で変更があった場合、または実行計画が再ビルドを要求する場合に再ビルド後の状態検証を行います。パッケージはアクティブなシステム上の存在状態を確認し、サービスは有効な NixOS option を `verify_service_state(...)` で確認します。再ビルド自体に失敗した場合は、変更した設定の復元を試みます。再ビルド成功後の状態検証に失敗した場合は、設定の復元と復元後の再ビルドを試みます。`rebuild` が無効な実行では再ビルド後の状態検証を行わず、検証失敗を契機とする復元処理も行いません。過去のサービス検証課題の背景は [Issue #138](https://github.com/nxc-project/nixos-json-controller/issues/138) に記録されています。

NixOS の宣言的な設定変更と rebuild を伴うため、変更操作では必要に応じて sudo 認証が求められます。

---

# GUI の開発環境

GUI は React / TypeScript、Vite、Tailwind CSS、Tauri 2 を利用しています。Nix profile からインストールできる `nxc-app` package を提供しています。以下の手順はソースコードを変更する開発者向けです。

Nix Flake の開発シェルを用意しています。**Wayland では WebKitGTK が正しい画面倍率を取得できるよう、GTK / GSettings のスキーマパスを設定するため、GUI の開発起動前に必ず `nix develop` を実行してください。** システムの通常のシェルから直接 `pnpm tauri dev` を実行すると、この環境設定が不足する場合があります。

## 必要なもの

- Nix が利用できる NixOS / Linux 環境
- Rust / Cargo
- Node.js（CI では Node.js 24 を利用）
- pnpm（CI では pnpm 11.9.0 を利用）
- Tauri 2 の Linux ビルド・実行に必要なライブラリ

`nix develop` の実行時に `nix-command` または `flakes` が無効というエラーが出る場合は、ユーザー設定ファイル `~/.config/nix/nix.conf` に次の設定を追加してから再実行してください。ディレクトリやファイルが存在しない場合は作成します。

    experimental-features = nix-command flakes

## 起動する

リポジトリを取得し、Frontend のディレクトリで依存関係をインストールします。

    git clone https://github.com/nxc-project/nixos-json-controller.git
    cd nixos-json-controller
    nix develop

開発シェルに入ったら、別のコマンド入力行で Frontend に移動し、依存関係をインストールします。

    cd frontend
    pnpm install --frozen-lockfile

その後、リポジトリの Flake を使って AppStream データを用意し、Tauri の開発環境を起動します。

    pnpm tauri dev

frontend/package.json の tauri スクリプトは、リポジトリルートの Nix Flake から appstream-data 出力をビルドし、そのパスを NXC_APPSTREAM_DATA として渡して Tauri CLI を実行します。開発シェルは GTK / GSettings のスキーマを XDG_DATA_DIRS に追加し、Wayland 上で WebKitGTK の表示倍率が異常な値になる問題を避けます。AppStream データはソースに同梱せず、Nix Flake の入力から取得・ビルドします。したがって、GUI の開発起動にはリポジトリの Nix Flake と Nix が必要です。

## Frontend の確認コマンド

frontend ディレクトリで実行します。

    pnpm format:check
    pnpm test
    pnpm lint
    pnpm build

- pnpm format:check：Frontend のフォーマットチェック
- pnpm test：Frontend の自動テスト
- pnpm lint：ESLint による静的チェック
- pnpm build：TypeScript のビルドチェックと Vite の本番用 Frontend ビルド

これらは開発者向けコマンドです。`pnpm build` は Frontend の型チェックと Vite ビルドを確認するもので、Tauri と Nix package の全工程を検証するものではありません。GUI package の確認には `nix build .#nxc-app --no-link --print-out-paths` を使い、CI では Desktop Entry・静的アイコン・AppStream / GSettings の wrapper 設定も検査します。

## GUI のインストールと管理

NXC LOUNGE は CLI の `nxc` とは独立した Flake package です。対象は現在 `x86_64-linux` です。

### インストール

```sh
nix profile install github:nxc-project/nixos-json-controller#nxc-app
```

インストール後、アプリランチャーの **NXC LOUNGE** から起動できます。ターミナルから起動する場合は次を使います。

```sh
nxc-app
```

### 更新

最初に profile element 名を確認します。

```sh
nix profile list
```

実機で確認した更新コマンドは次のとおりです。

```sh
nix profile upgrade nxc-app --refresh
```

profile element 名が異なる環境では、`nix profile list` に表示された名前を指定してください。

### 削除

GUI の profile element だけを削除します。

```sh
nix profile remove nxc-app
```

この操作は CLI の `nxc` を削除しません。削除対象の名前が異なる場合は、`nix profile list` に表示された実際の名前を指定してください。

### パッケージに含まれるもの

Flake package は `nxc-app` 実行ファイル、`NXC LOUNGE` の Desktop Entry、静的ランチャーアイコンを提供します。AppStream データを package に組み込み、GTK / GSettings のスキーマパスを起動環境に設定するため、通常利用時に開発シェルやソース checkout は必要ありません。 おすすめデータは GitHub Releases から定期更新し、取得できない場合は同梱の fallback データを利用します。GUI package の build と成果物の基本検査は CI でも実行されます。実機での profile 更新、更新後のランチャー起動、Store path の切り替えと CLI 側の Store path が変わっていないことの確認記録は [Issue #170](https://github.com/nxc-project/nixos-json-controller/issues/170) を参照してください。

GUI の機能改善やインストール済みアプリ管理などは引き続き開発中です。配布方法が利用可能であることと、すべての GUI 機能が完成していることは区別してください。

---

# 主なコマンド一覧

| コマンド | 説明 |
| --- | --- |
| nxc &lt;package&gt; | パッケージをインストール |
| nxc i &lt;package&gt; | パッケージをインストール |
| nxc r &lt;package&gt; | パッケージを削除 |
| nxc e &lt;service&gt; | サービスを有効化 |
| nxc d &lt;service&gt; | サービスを無効化 |
| nxc discover | NixOS Flake を探索 |
| nxc list | 設定に宣言された system packages を一覧表示 |
| nxc search &lt;query&gt; | 宣言された system packages を検索 |
| nxc status | 現在の system / Discovery 状態を表示 |
| nxc explain package &lt;name&gt; | パッケージの状態・宣言元を表示 |
| nxc explain service &lt;name&gt; | サービスの状態・宣言元を表示 |
| nxc --help | ヘルプを表示 |

設定変更コマンドでは dry-run オプションを使えます。参照・表示用コマンドに dry-run を指定するとエラーになります。

---

# 開発・Issue運用

開発計画は次のIssueを起点に管理しています。

- [プロジェクト憲章 #166](https://github.com/nxc-project/nixos-json-controller/issues/166)：目的・スコープ・成功基準
- [PBL #167](https://github.com/nxc-project/nixos-json-controller/issues/167)：優先順位付きバックログ、依存関係、完了・見送り履歴
- [Issueの書き方](docs/project-management/issue-writing.md)：PBI・Task・Bugの使い分け、Why中心の書き方、Ready / Done基準
- [プロジェクトとバックログの運用](docs/project-management/backlog-management.md)：Issue間の関係、優先度、PBLの更新ルール

新しいIssueは適切なIssue Formから作成してください。原因・実装方法・環境情報が未確定でも、確認できた事実と未確認事項を区別して相談できます。クローズ済みIssueは履歴として保持し、実装完了と対応見送りを区別します。

---

# 関連 Issue（開発中の作業）

## GUI 機能・品質

- [#102 — GUIからインストール済みアプリを確認・管理する](https://github.com/nxc-project/nixos-json-controller/issues/102)
- [#134 — 高速スクロール時にサイドバーの描画が重なる](https://github.com/nxc-project/nixos-json-controller/issues/134)
- [#162 — インストール制約に合うパッケージをApp Storeで表示する](https://github.com/nxc-project/nixos-json-controller/issues/162)

GUI package の再現可能なビルド（#169）、デスクトップ統合と本番起動環境（#170）、CSP / Tauri 権限監査（#106）、ライセンス情報（#139）は完了しています。GUI package のインストール・起動・更新・削除については上の手順を参照してください。

完了済みの改善と対応見送りの履歴は [PBL #167](https://github.com/nxc-project/nixos-json-controller/issues/167) を参照してください。

---

# ライセンス

NXC が作成した CLI / コア機能、GUI のソースコード、Nix 定義、スクリプトおよびドキュメントは、特別な記載がない限りルートの [MIT License](./LICENSE) の対象です。改変・再配布にあたり、MIT ライセンス本文と著作権表示を保持してください。NXC を利用した派生ソフトウェアを同じライセンスにする義務はありません。

このライセンスは、外部 API サービス、API から得られるデータ、AppStream の個別メタデータやアイコン、Iconify のアイコン、フォント、依存ライブラリ、商標などに一律適用されません。NXC のソースコードに含まれる外部サービス呼び出しのコードと、外部サービスやそのデータ自体は区別してください。

第三者資産の出典・ライセンスの確認方法は [THIRD_PARTY_NOTICES.md](./THIRD_PARTY_NOTICES.md) にまとめています。GUI package には、本体の `LICENSE`、第三者資産の説明、フォントライセンス、Vite のバンドル依存ライセンス一覧、Cargo の依存ライセンスレポート、実際に同梱する AppStream データの `metadata_license` 一覧を `share/licenses/nxc-app/` に同梱します。これらのレポートは確認を助けるインベントリであり、再配布条件が未確定の外部データや画像の利用許可を自動的に保証するものではありません。
