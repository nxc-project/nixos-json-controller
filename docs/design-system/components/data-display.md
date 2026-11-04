# Data Display

アプリ情報を表示する部品は、利用者が候補を見つけ、比較し、詳細へ進めるように情報の順序と密度を揃えます。

## Card

実装: frontend/src/components/ui/card.tsx

Card は関連する情報を一つのまとまりとして示すために使います。現行実装は card background、foreground、rounded-xl、foreground の薄い ring を基本とし、header / content / footer の領域を提供します。

- ただの区切りに Card を多用しないでください。
- Card 内の余白は内部コンテンツの量に合わせ、入れ子の Card を避けます。
- Card 自体がクリック可能か、内部のリンクやボタンが操作可能かを明確に分けます。

## AppCard

実装: frontend/src/components/AppCard.tsx

検索結果で使う行型のアプリ表示です。アプリアイコン、アプリ名、説明、インストール状態、カテゴリ・タグ、インストール操作を含みます。

情報の優先順位は、アプリ名 → 説明 → カテゴリ・タグ → 操作です。アプリ詳細へのリンクとインストールボタンの操作領域を混同しません。説明やタグが長くても操作ボタンが押し出されないようにします。

アイコンから詳細へ移動するリンクには、アプリ名を含む accessible name（例: ``aria-label={`${name} の詳細を表示`}``）を付けます。同じリンク内の `AppIcon` は `aria-hidden` で装飾扱いにし、画像の有無でリンク名が失われたり重複したりしないようにします。

## RecommendationAppCard

実装: frontend/src/components/RecommendationAppCard.tsx

おすすめ画面で使うカードです。featured と genre ranking の密度を使い分けます。

- Featured: 総合ランキングと対象アプリを強調し、統計の出典・指標の意味を近くに表示します。
- Ranking: 順位・人気度・アプリ名・説明・カテゴリを一定の順序で表示します。
- ジャンルごとの色は分類を補助するためにだけ使い、ブランドカラーやインストール状態の代わりにしません。
- カルーセル内のカード幅・高さ・情報の揃え方を統一し、横方向に比較しやすくします。

人気度は Arch Linux の公開統計であり、NixOS の利用率ではありません。見出し・注釈・単位を省略して誤解させないようにします。

## AppIcon

実装: frontend/src/components/AppIcon.tsx

AppStream やローカルアイコンテーマなどからアプリのアイコンを解決するプロダクト固有部品です。画像が見つからない場合も、アプリ名や識別情報が失われない fallback を用意します。

- アイコン画像は装飾用アイコンと区別します。
- アプリ名が別途読み上げられる場合、重複する代替テキストを付けないようにします。
- サイズ・object-fit・fallback の見た目をカード種別ごとに揃えます。
