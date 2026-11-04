# Actions and Feedback

操作部品は、実行できる操作と実行できない理由を明確にします。特にインストールはシステム状態を変えるため、通常のナビゲーションや表示操作より慎重に状態を伝えます。

## Button

実装: frontend/src/components/ui/button.tsx

### variant

| variant | 使いどころ |
| --- | --- |
| default | 画面の主操作 |
| outline | 主操作に並ぶ補助操作、再試行など |
| secondary | 優先度を下げた補助操作 |
| ghost | 低強調の補助操作、ツールバー |
| destructive | 破壊的・危険な操作。確認や文脈を伴う |
| link | 文中・リンクとして扱う操作 |

主操作を一つに絞り、同じ領域に default variant を多数並べないようにします。disabled は opacity だけに頼らず、必要に応じて操作できない理由を説明します。

### size

現行実装は default 32px、xs 24px、sm 28px、lg 36px、高さ 32px の icon variant を持ちます。画面側で独自高さを指定している箇所もあるため、新規実装では共通 size を優先し、既存例外を追加する場合は理由を明示します。

## Badge

実装: frontend/src/components/ui/badge.tsx

Badge はカテゴリ、属性、確定した状態など、短い補助情報に使います。ボタンの代わりに使わず、長文を入れません。

現行 variant は default / secondary / destructive / outline / ghost / link です。一般的な「インストール済み」は secondary を基本とし、警告や危険を示す値に destructive を使います。色だけで状態を表さず、短いテキストを含めます。

## InstallButton

実装: frontend/src/components/InstallButton.tsx

NXC 固有の操作部品です。パッケージごとの状態を受け取り、ボタン表示と操作可否を決定します。

| 状態 | 表示の意味 | UI の考え方 |
| --- | --- | --- |
| 未確認 | インストール状態が分からない | 状態確認中または確認失敗を示し、未確認のまま実行させない |
| checking | sudo / 実行可能性を確認中 | 重複操作を防ぎ「確認中」と表示 |
| password | 認証待ち | パスワード入力とキャンセルを提示 |
| installing | インストール処理中 | 進捗状態を示し、再実行を防ぐ |
| verification pending | 処理後の状態確認中 | 成功と断定せず、確認中と説明 |
| installed | インストール済み | 完了状態を明示し、操作を無効化 |
| error | 操作または確認に失敗 | エラー内容と可能な再試行を示す |

成功状態はバックエンドの verified state と対応させます。見た目だけでインストール済みに切り替えません。状態遷移を変更する場合は、実際の install flow と AppState の整合性を合わせて確認します。

## InstallProgressIndicator

実装: frontend/src/components/InstallProgressIndicator.tsx

処理中の補助表示に使います。role=status と aria-live=polite を持ち、ラベルは短く具体的にします。アニメーションは prefers-reduced-motion に対応させます。

## Interaction feedback

- 押下可能な部品は hover / focus-visible / active / disabled を揃えます。
- 処理中は重複実行を防ぐとともに、その理由が分かる表示を出します。
- 操作結果が非同期の場合、操作直後の表示と確定後の表示を区別します。
- 成功・失敗・未確認を同じ色や同じ文言で表現しません。
