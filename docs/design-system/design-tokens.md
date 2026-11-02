# デザイントークン

トークンはデザイナー・エンジニア・AI エージェントが値を指し示すための共通言語です。名前は見た目の値ではなく、役割と目的を表します。

## トークンの考え方

SmartHR Design System の分類を参考に、値そのものを表す Primitive と、UI 上の役割を表す Semantic を区別します。

- **Primitive:** 色相や段階など、用途に依存しない基礎値。
- **Semantic:** primary、background、muted など、UI での意味を表す値。
- **Component:** ボタンやカードなど、特定部品に適用する組み合わせ。

現行 NXC は CSS custom properties に Semantic token を中心に実装しています。共通の Primitive palette はまだ独立して定義されていないため、この文書では存在するかのように値を作りません。

## ライトテーマ（現行実装）

正本: frontend/src/index.css の :root

| Semantic token | 現行値 | 主な用途 |
| --- | --- | --- |
| background | oklch(0.995 0.004 255) | ページ背景 |
| foreground | oklch(0.205 0.025 255) | 主要テキスト |
| card | oklch(1 0 0) | カード・パネル背景 |
| card-foreground | oklch(0.205 0.025 255) | カード内テキスト |
| primary | oklch(0.52 0.19 255) | 主要操作・リンク・選択 |
| primary-foreground | oklch(1 0 0) | primary 上のテキスト |
| secondary | oklch(0.965 0.025 250) | 補助面 |
| secondary-foreground | oklch(0.27 0.035 255) | secondary 上のテキスト |
| muted | oklch(0.965 0.025 250) | 静かな面 |
| muted-foreground | oklch(0.49 0.026 255) | 補助テキスト |
| accent | oklch(0.93 0.055 250) | 淡いハイライト |
| accent-foreground | oklch(0.29 0.085 255) | ハイライト上のテキスト |
| border | oklch(0.90 0.026 250) | 境界 |
| input | oklch(0.88 0.032 250) | 入力部品の境界 |
| ring | oklch(0.52 0.19 255) | フォーカスリング |
| destructive | oklch(0.58 0.22 25) | エラー・危険な操作 |
| radius | 0.75rem | 角丸の基準 |

## ダークテーマ（CSS 定義）

正本: frontend/src/index.css の .dark

| Semantic token | 現行値 |
| --- | --- |
| background | oklch(0.15 0.004 255) |
| foreground | oklch(0.97 0.002 255) |
| card | oklch(0.19 0.004 255) |
| card-foreground | oklch(0.97 0.002 255) |
| primary | oklch(0.69 0.16 255) |
| primary-foreground | oklch(0.15 0.004 255) |
| secondary | oklch(0.235 0.005 255) |
| secondary-foreground | oklch(0.95 0.002 255) |
| muted | oklch(0.235 0.005 255) |
| muted-foreground | oklch(0.70 0.008 255) |
| accent | oklch(0.25 0.025 255) |
| accent-foreground | oklch(0.95 0.002 255) |
| border | oklch(1 0 0 / 10%) |
| input | oklch(1 0 0 / 14%) |
| ring | oklch(0.69 0.14 255) |
| destructive | oklch(0.70 0.18 25) |

ダークテーマの CSS 値が存在することは、ユーザーがテーマを切り替えられる UI が存在することを意味しません。テーマ切り替えの提供状況・適用範囲は別途確認します。

## Typography

現行フォントは @fontsource-variable/geist で読み込む Geist Variable です。html の基準 font-size は 100% で、利用者のブラウザー設定を尊重します。

| Semantic role | 基準サイズ | 用途 |
| --- | ---: | --- |
| display | 36px | ページの大見出し |
| heading-lg | 30px | ページ・主要領域の見出し |
| heading-md | 24px | セクション・featured item |
| title | 20px | カード・項目タイトル |
| body | 16px | 標準本文・入力 |
| body-sm | 14px | 補助説明・メタ情報 |
| label | 14px | ボタン・ラベル |

この表は現行コードで使われている Tailwind の文字サイズ階層を整理した基準です。すべてが CSS custom property やコンポーネント variant として実装済みという意味ではありません。個別用途で別のサイズを使う場合は、理由を明記して追加します。

## Spacing

Tailwind CSS の標準 spacing scale を使用します。基本単位は 4px です。

| Token | Value | Tailwind 例 |
| --- | ---: | --- |
| xs | 4px | 1 |
| sm | 8px | 2 |
| md | 12px | 3 |
| lg | 16px | 4 |
| xl | 24px | 6 |
| 2xl | 32px | 8 |
| 3xl | 40px | 10 |
| 4xl | 48px | 12 |

Tailwind の標準値を優先し、任意値を増やす前に既存 scale で表現できないか確認します。

## Radius

--radius は 0.75rem を基準とし、Tailwind theme で以下のように派生します。

| Role | Formula / value | 主な用途 |
| --- | --- | --- |
| sm | --radius × 0.6 | 小さな補助要素 |
| md | --radius × 0.8 | 小さな操作面 |
| lg | --radius | ボタン・入力 |
| xl | --radius × 1.4 | カード |
| 2xl | --radius × 1.8 | 大きなタイル |
| 3xl | --radius × 2.2 | 大きなパネル |
| full | 9999px | バッジ・pill |

## 追加・変更ルール

- 既存の Semantic token に意味が合う場合は新しい色を作らず再利用します。
- 新しい色は、その値を何の意味で使うか説明できる場合に限り追加します。
- 同じ色でも用途が異なるなら、無理に一つの意味にまとめません。
- トークン変更時は CSS とこの表、必要に応じて DESIGN.md の YAML を同じ PR で更新します。
- 色を変更した場合は通常・hover・focus・disabled・error の状態とライト／ダーク双方を確認します。
