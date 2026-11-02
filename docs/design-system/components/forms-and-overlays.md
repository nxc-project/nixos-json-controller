# Forms and Overlays

入力とオーバーレイは、利用者に必要な情報を求め、操作の対象と結果を明確にするために使います。

## Input

実装: frontend/src/components/ui/input.tsx

現行 Input は Base UI Input を包み、w-full、min-w-0、rounded-lg、border-input、focus-visible ring、disabled / invalid 状態を持ちます。標準の高さは 32px です。通常時は `bg-transparent` で、親の surface を透過して表示します。ダークテーマでは `dark:bg-input/30` が適用され、disabled 状態では `disabled:bg-input/50`（ダークでは `dark:disabled:bg-input/80`）、invalid 状態では境界線と ring の色が上書きされます。

- 入力欄には常に視覚的ラベルまたは明確な accessible name を付けます。
- placeholder は入力例や補足であり、ラベルの代用にしません。
- 検索入力では Enter とボタンの両方で送信できるようにします。
- 入力値の検証に失敗した場合は、該当する入力欄の近くに理由を示します。
- パスワードなど秘密情報は必要な目的以外で保持・再表示しません。

## Password panel

実装: frontend/src/components/InstallButton.tsx

現在のインストール認証は、sudo が利用できない場合にパスワード入力パネルを表示します。利用者が対象アプリと入力の目的を理解できるようにし、続行とキャンセルを明確に区別します。

今後の改善では、dialog semantics、初期フォーカス、Tab のフォーカス制御、Escape / キャンセル、閉じた後のフォーカス復帰を確認します。パスワードを成功・失敗後に state から消去する既存動作を維持します。

## Overlay の原則

- モーダルを開いた理由と対象をタイトルで示します。
- 背景はモーダルの操作対象ではないことを視覚的に示します。
- 閉じる・キャンセルできる場合は、その方法を明確にします。
- キーボードと読み上げに対応し、背景の操作へフォーカスが逃げないようにします。
- 一時的な通知と、利用者の判断が必要なモーダルを混同しません。
