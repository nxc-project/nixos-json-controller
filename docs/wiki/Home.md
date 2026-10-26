# NixOS JSON Controller (NXC)

NixOS JSON Controller（NXC）は、NixOS の設定変更を安全に扱う CLI ツールと、Nixpkgs のパッケージを検索・管理するデスクトップ GUI「NXC LOUNGE」を開発するプロジェクトです。

CLI はパッケージやサービスの変更を NixOS の宣言的な設定へ反映し、必要に応じてシステムの再ビルドまで実行します。NXC LOUNGE は React / TypeScript と Tauri 2 を利用しています。

## はじめに

- [CLI のインストール](Installation.md)：Nix profile を利用した CLI の導入方法
- [CLI の使い方](CLI-Usage.md)：パッケージ・サービスの操作と状態確認
- [安全設計と内部の流れ](Safety-and-Architecture.md)：設定変更・評価・検証について
- [GUI 開発環境](GUI-Development.md)：開発者向けの起動手順
- [トラブルシューティング](Troubleshooting.md)：エラー発生時の確認事項
- [開発への参加](Contributing.md)：テスト、Issue、PR の進め方

## 現在の状態

| 項目 | 状態 |
| --- | --- |
| CLI | Nix profile からインストールして利用可能 |
| CLI のパッケージ・サービス管理 | 対応済みのコマンドから操作可能。設定構造などによっては安全のため変更を拒否する |
| GUI | Nix Flake の `nxc-app` package として `x86_64-linux` 向けに提供 |
| GUI のインストール・更新・削除 | Nix profile とアプリランチャーでの動作を実機確認済み。CLI とは独立して管理可能 |

GUI package の再現可能なビルド、デスクトップ統合、CSP / Tauri 権限監査、ライセンス情報の整備は完了しています。GUI の機能開発は継続しており、主な作業は [#102 — インストール済みアプリの管理](https://github.com/nxc-project/nixos-json-controller/issues/102)、[#134 — サイドバー描画の問題](https://github.com/nxc-project/nixos-json-controller/issues/134)、[#162 — インストール制約に合うパッケージの表示](https://github.com/nxc-project/nixos-json-controller/issues/162) で管理しています。

## NXC の主な機能

### CLI

- NixOS パッケージの追加・削除
- NixOS サービスの有効化・無効化
- NixOS Flake と configuration の探索
- 設定で宣言されたパッケージの一覧・検索
- パッケージやサービスの状態・宣言元の確認
- 変更前に実行計画を確認する dry-run

### GUI：NXC LOUNGE

- Nixpkgs パッケージの検索
- 説明、バージョン、カテゴリなどの詳細表示
- 現在の NixOS におけるインストール状態の表示
- パッケージのインストール操作（CLI の `nxc` とは独立）
- AppStream やローカルのアイコンテーマを利用したアイコン解決
- `nix profile` 経由のインストールとアプリランチャーからの起動

## 安全に利用するために

NXC はユーザーの NixOS 設定を無条件に書き換えるものではありません。対象や設定構造を安全に判定できない場合には、変更を拒否することがあります。変更の前に対象を確認し、必要な場合は `--dry-run` を利用してください。

CLI のパッケージ操作は NixOS configuration の編集やシステムの再ビルドを伴う場合があります。実行内容を理解したうえで利用してください。

## 開発計画

- [プロジェクト憲章 #166](https://github.com/nxc-project/nixos-json-controller/issues/166)：目的・スコープ・成功基準
- [PBL #167](https://github.com/nxc-project/nixos-json-controller/issues/167)：優先順位付きバックログと完了履歴
- [Issue の書き方](https://github.com/nxc-project/nixos-json-controller/blob/main/docs/project-management/issue-writing.md)
- [プロジェクトとバックログの運用](https://github.com/nxc-project/nixos-json-controller/blob/main/docs/project-management/backlog-management.md)

CLI コマンドの詳細は [CLI Usage](CLI-Usage.md) を参照してください。
