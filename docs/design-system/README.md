# NXC LOUNGE Design System

NXC LOUNGE の UI を一貫して設計・実装するためのガイドです。SmartHR Design System の「基本原則・基本要素・アクセシビリティ・プロダクト」という情報設計を参考にしつつ、NXC のプロダクト領域に合わせて構成しています。

## 目的

デザインシステムは完成した見た目を固定するためのルール集ではありません。機能追加や画面改修のたびに判断をやり直さず、利用者に一貫した体験を提供するための共通言語です。

NXC では、デザイントークン、共通コンポーネント、画面パターン、アクセシビリティ、ライティング、運用を関連づけます。仕様と実装の差がある場合は差分を明示し、実装を確認せずに「準拠済み」と扱いません。

## 対象範囲

- 対象: NXC LOUNGE のデスクトップ GUI（React / TypeScript / Tailwind CSS / Tauri）
- 対象外: CLI のターミナル表示、NixOS 設定ファイル、Web サイトやマーケティング素材
- 対象画面: アプリ発見・検索、おすすめ、検索結果、アプリ詳細、インストール状態と認証フロー

## ガイド一覧

| 領域 | ドキュメント | 役割 |
| --- | --- | --- |
| 基本原則 | [principles.md](principles.md) | UI 判断の優先順位と体験の価値 |
| 基本要素 | [foundations.md](foundations.md) | 色・文字・余白・形・奥行きの共通基盤 |
| デザイントークン | [design-tokens.md](design-tokens.md) | CSS / Tailwind 実装との対応 |
| コンポーネント | [components/](components/README.md) | 共通部品の用途・variant・状態 |
| デザインパターン | [patterns/](patterns/README.md) | 画面と操作の組み立て方 |
| アクセシビリティ | [accessibility.md](accessibility.md) | キーボード・読み上げ・視認性 |
| ライティング | [writing.md](writing.md) | 表示文言とエラーの書き方 |
| 運用 | [governance.md](governance.md) | 追加・変更・レビューの進め方 |

## どこを正本にするか

- AI エージェント・開発者が最初に読む全体基準: リポジトリルートの DESIGN.md
- 意図・使い方・判断理由: このディレクトリのドキュメント
- 実際に画面へ適用される値: frontend/src/index.css、Tailwind の設定、各コンポーネント実装
- 共通部品の API と状態: frontend/src/components/ui/ および frontend/src/components/

DESIGN.md の値と実装が食い違う場合、実装の現状を確認したうえで、仕様を更新するか実装を変更するかを PR で判断します。文書だけを根拠に UI の実態を推測しません。

## ステータス表記

- **現行実装:** コード上で確認できる値・動作
- **推奨基準:** 新規実装や変更時に採用するルール
- **要整備:** 現状に例外や未確認事項があり、後続作業で揃える領域

この区別は、デザインシステム導入を「一度に全画面を作り直す」作業にしないためのものです。
