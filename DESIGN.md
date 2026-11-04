---
version: alpha
name: NXC LOUNGE
description: Nixpkgsのソフトウェアを見つけ、内容と状態を理解し、安心してNixOSへ導入するためのデスクトップアプリのデザイン基準。
colors:
  primary: "oklch(0.52 0.19 255)"
  primary-foreground: "oklch(1 0 0)"
  background: "oklch(0.995 0.004 255)"
  foreground: "oklch(0.205 0.025 255)"
  card: "oklch(1 0 0)"
  card-foreground: "oklch(0.205 0.025 255)"
  secondary: "oklch(0.965 0.025 250)"
  secondary-foreground: "oklch(0.27 0.035 255)"
  muted: "oklch(0.965 0.025 250)"
  muted-foreground: "oklch(0.49 0.026 255)"
  accent: "oklch(0.93 0.055 250)"
  accent-foreground: "oklch(0.29 0.085 255)"
  border: "oklch(0.90 0.026 250)"
  input: "oklch(0.88 0.032 250)"
  ring: "oklch(0.52 0.19 255)"
  destructive: "oklch(0.58 0.22 25)"
typography:
  display:
    fontFamily: Geist Variable
    fontSize: 36px
    fontWeight: 600
    lineHeight: 1.2
  heading-lg:
    fontFamily: Geist Variable
    fontSize: 30px
    fontWeight: 600
    lineHeight: 1.25
  heading-md:
    fontFamily: Geist Variable
    fontSize: 24px
    fontWeight: 600
    lineHeight: 1.35
  title:
    fontFamily: Geist Variable
    fontSize: 20px
    fontWeight: 600
    lineHeight: 1.4
  body:
    fontFamily: Geist Variable
    fontSize: 16px
    fontWeight: 400
    lineHeight: 1.5
  body-sm:
    fontFamily: Geist Variable
    fontSize: 14px
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: Geist Variable
    fontSize: 14px
    fontWeight: 500
    lineHeight: 1.4
spacing:
  xs: 4px
  sm: 8px
  md: 12px
  lg: 16px
  xl: 24px
  2xl: 32px
  3xl: 40px
  4xl: 48px
rounded:
  sm: 7.2px
  md: 9.6px
  lg: 12px
  xl: 16.8px
  2xl: 21.6px
  3xl: 26.4px
  4xl: 1.95rem
  full: 9999px
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.primary-foreground}"
    typography: "{typography.label}"
    rounded: "{rounded.lg}"
    height: 32px
  button-secondary:
    backgroundColor: "{colors.secondary}"
    textColor: "{colors.secondary-foreground}"
    typography: "{typography.label}"
    rounded: "{rounded.lg}"
    height: 32px
  input:
    backgroundColor: "transparent"
    textColor: "{colors.foreground}"
    typography: "{typography.body}"
    rounded: "{rounded.lg}"
    height: 32px
  card:
    backgroundColor: "{colors.card}"
    textColor: "{colors.card-foreground}"
    rounded: "{rounded.xl}"
---

# NXC LOUNGE Design System

NXC LOUNGE の画面を、デザイナー・エンジニア・AI エージェントが同じ基準で設計・実装するための入口です。先頭の YAML は機械可読なトークン、本文と詳細ドキュメントは意図・使い方・判断基準を定義します。

## Overview

NXC LOUNGE は、Nixpkgs のソフトウェアを探し、パッケージの情報と現在の状態を理解し、NixOS へ導入するためのデスクトップアプリです。

**見つけやすく、判断しやすく、操作の結果が分かる。** これを UI の中心に置きます。

- **コンテンツが主役。** アプリ名、説明、アイコン、カテゴリ、パッケージ ID を読み取りやすくし、装飾や操作部品が情報を邪魔しないようにします。
- **青は行動の手がかり。** 主色は検索・インストールなどの主要アクション、選択、フォーカスに使います。広い面を青で塗りつぶしません。
- **状態を正確に伝える。** インストール済み、確認中、処理中、失敗、未確認を区別し、色だけに依存せずテキストや形でも伝えます。
- **静かで整ったデスクトップ体験。** 余白、文字の階層、控えめな境界線を使い、過剰な影・グラデーション・アニメーションを避けます。

## Colors

色は見た目ではなく役割で選びます。現行のライトテーマ値は frontend/src/index.css の CSS custom properties が正本です。

- **Primary:** 青。主要アクション、リンク、選択、キーボードフォーカスに使います。
- **Background / Card:** ページ背景とコンテンツ面を分離します。カードは原則白、背景はわずかに青みのある白です。
- **Foreground / Muted:** 本文と補足情報の階層を作ります。重要情報を muted にしません。
- **Secondary / Accent:** 補助的な面や選択中の弱いハイライトに使います。主要アクションと競合させません。
- **Destructive:** 失敗・危険な操作の伝達に使います。単なる注意や通常状態には使いません。

ジャンル別の色はコンテンツ分類の補助表現です。ブランドカラーや主要操作の色として再利用しません。

## Typography

Geist Variable を基本書体とし、サイズ・ウェイト・行間で階層を作ります。アプリ名や画面見出しは明確に、説明文は落ち着いて、パッケージ ID や技術情報は読み間違えにくく表示します。

標準の本文サイズは 16px、補助情報は 14px です。12px 未満は原則避け、情報密度の高い特殊な表示でのみ理由を明記して使います。

## Layout

余白は Tailwind の 4px 基準を使います。画面全体はデスクトップでの一覧性を優先しつつ、狭いウィンドウでも情報と操作が欠けないように再配置します。

検索・おすすめ・検索結果・詳細の各画面で、ページの開始位置、見出し、コンテンツ幅、セクション間隔を揃えます。横スクロールはランキングなど、横方向に並べる意味がある情報に限定します。

## Elevation & Depth

奥行きは背景・カード・オーバーレイの差で表現します。カードは薄い境界または控えめな ring を基本とし、常時強い影を付けません。ダイアログや認証パネルは背後の画面から明確に分離します。

## Shapes

基本の角丸は CSS の --radius（12px）を起点にします。ボタン・入力欄は控えめ、カードはやや大きく、アイコンタイルはカードより大きく、バッジは pill 形状を基本とします。形状の違いは装飾ではなく部品の役割を表すために使います。

## Components

既存実装の共通部品と NXC 固有の部品を組み合わせます。Button / Input / Card / Badge は frontend/src/components/ui/ が実装の正本です。アプリカードやインストール操作などのプロダクト固有部品は frontend/src/components/ にあります。

YAML の `components.input.backgroundColor` は現行 Input の通常時（ライトテーマ）の `bg-transparent` を表します。ダークテーマでは `dark:bg-input/30` が上書きし、disabled 状態には `disabled:bg-input/50` と `dark:disabled:bg-input/80` の背景指定があります。`aria-invalid` 状態は境界線と ring を変更しますが、背景は変更しません。これは全状態共通の塗り色や、未実装の推奨値を示すものではありません。

新しい画面で既存部品を独自に再実装せず、既存の variant・状態・余白を優先します。詳細は docs/design-system/components/ を参照してください。

## Do's and Don'ts

- 主要アクションは画面内で一つの視覚的優先順位にします。
- インストール状態と実行結果は、状態名と補足説明を含めて伝えます。
- パッケージ ID や技術的な値は、省略・翻訳によって意味を変えません。
- 色だけで状態を表現しません。
- 理由のないグラデーション、強い影、ランダムな角丸、過剰なモーションを追加しません。
- 既存トークンと共通コンポーネントで表現できる値を、画面内に直接ハードコードしません。

## Current implementation and adoption

この文書は現行 UI を調査した初期基準です。トークンが定義されていることと、全画面がすでに完全準拠していることは同じではありません。現状の CSS・共通部品・画面固有の例外は詳細ドキュメントに記録し、新規実装から基準を適用しながら差分を段階的に減らします。

- 詳細なナビゲーション: docs/design-system/README.md
- 基本原則: docs/design-system/principles.md
- Foundations と実装状況: docs/design-system/foundations.md
- トークン一覧: docs/design-system/design-tokens.md
- コンポーネント: docs/design-system/components/README.md
- 画面パターン: docs/design-system/patterns/README.md
- アクセシビリティ: docs/design-system/accessibility.md
- UI ライティング: docs/design-system/writing.md
- 更新・レビュー: docs/design-system/governance.md
