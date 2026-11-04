# 運用とガバナンス

デザインシステムは一度書いて終わりではなく、プロダクトの変化に合わせて更新します。ドキュメントと実装を別々に管理して乖離させないことを基本とします。

## ドキュメントの役割

- リポジトリルートの DESIGN.md: AI エージェントと開発者向けの短い入口。機械可読トークンと最重要原則を置く。
- docs/design-system/: 役割・背景・コンポーネント・パターンなど詳細な仕様を置く。
- frontend/src/index.css: 実際に画面へ適用する CSS custom properties と Tailwind theme の正本。
- frontend/src/components/: 共通 UI と NXC 固有 UI の実装の正本。

ドキュメントが実装を上書きするわけではありません。実装を変更する PR では、意図した仕様・現行実装・変更後の値を照合します。

## 新しいコンポーネントを作るとき

1. 既存コンポーネントで表現できない理由を確認します。
2. 同じ用途・状態・操作を複数画面で使うかを確認します。
3. API、variant、size、disabled / loading / error / focus の状態を定義します。
4. キーボード・読み上げ・コントラストを確認します。
5. カタログと関連する画面パターンを更新します。

単一画面だけのレイアウトは、共通化のためだけに component にしません。意味や振る舞いが異なる部品を、見た目が似ているという理由だけで統合しません。

## デザイン変更 PR のチェック

- [ ] 変更の理由と利用者への影響が説明されている
- [ ] 既存トークン・コンポーネントを再利用している
- [ ] 新しい token / variant を追加する場合、必要性と用途が説明されている
- [ ] 通常・hover・active・focus-visible・disabled・error の状態を確認した
- [ ] ライト・ダークの CSS 定義への影響を確認した
- [ ] キーボード操作・読み上げ・コントラストを確認した
- [ ] 狭いウィンドウと通常のデスクトップ幅で確認した
- [ ] スクリーンショットまたは確認方法を PR に記載した
- [ ] 関連する DESIGN.md / docs / CSS を同じ変更で更新した

該当しない項目は理由を説明し、チェックを付けるためだけに未確認の内容を完了扱いしません。

## 変更の進め方

デザインシステムの変更は小さく分けて行います。まず基準と利用方法を決め、次にトークンや共通コンポーネントを必要な範囲で実装し、最後に既存画面の例外を段階的に減らします。ドキュメント導入 PR だけで全画面が新基準に準拠したとは扱いません。

## DESIGN.md の検査

DESIGN.md の YAML front matter とトークン参照は、Google Labs の DESIGN.md 仕様を参考にしています。必要に応じて次のコマンドで構造と token reference を検査します。

npx @google/design.md lint DESIGN.md

トークン値を変更した場合は lint を実行し、結果を PR の検証結果に記載します。CLI が実行できない環境では、未実行であることを明記します。

## 参考にした公開資料

- [SmartHR Design System](https://smarthr.design/): 基本原則・基本要素・アクセシビリティ・プロダクトという構成を参考にしています。
- [SmartHR Design System: デザイントークン](https://smarthr.design/products/design-tokens/): Primitive / Semantic の分類と役割で命名する考え方を参考にしています。
- [SmartHR Design System: 色](https://smarthr.design/products/design-tokens/color/): 色を情報や状態の唯一の伝達手段にしない考え方を参考にしています。
- [SmartHR Design System: タイポグラフィ](https://smarthr.design/products/design-tokens/typography/): 基準サイズを設け、役割に応じた文字階層を定義する考え方を参考にしています。
- [Google Labs DESIGN.md](https://github.com/google-labs-code/design.md): AI エージェントが参照しやすい YAML front matter と Markdown rationale の形式を参考にしています。

これらの資料から情報設計や考え方を参考にしたものであり、SmartHR の色・コンポーネント・文章・デザイン資産を NXC にコピーするものではありません。
