# コンポーネント

コンポーネントは、共通した見た目だけでなく、用途・状態・操作・アクセシビリティを共有するための部品です。既存実装を利用し、画面ごとに似た部品を作り直さないようにします。

## カタログ

| コンポーネント | 実装 | 仕様 |
| --- | --- | --- |
| Button | frontend/src/components/ui/button.tsx | [Actions and feedback](actions-and-feedback.md) |
| Badge | frontend/src/components/ui/badge.tsx | [Actions and feedback](actions-and-feedback.md) |
| InstallButton / InstallProgressIndicator | frontend/src/components/InstallButton.tsx / InstallProgressIndicator.tsx | [Actions and feedback](actions-and-feedback.md) |
| Card | frontend/src/components/ui/card.tsx | [Data display](data-display.md) |
| AppCard | frontend/src/components/AppCard.tsx | [Data display](data-display.md) |
| RecommendationAppCard | frontend/src/components/RecommendationAppCard.tsx | [Data display](data-display.md) |
| AppIcon | frontend/src/components/AppIcon.tsx | [Data display](data-display.md) |
| Input | frontend/src/components/ui/input.tsx | [Forms and overlays](forms-and-overlays.md) |
| Install password panel | frontend/src/components/InstallButton.tsx | [Forms and overlays](forms-and-overlays.md) |

## 使い分け

- Button / Input / Card / Badge は ui/ の共通 primitive を基本にします。
- アプリ情報・おすすめ・インストール状態など、NXC のドメイン知識が必要な UI はプロダクト固有コンポーネントを使います。
- 画面固有のレイアウトは、必ずしも component に切り出す必要はありません。2つ以上の画面で同じ意味・振る舞いがある場合に共通化を検討します。
- 見た目が似ていても用途や状態遷移が異なる場合は、無理に一つの API にまとめません。

## variant と className

共通部品の variant が用途を表せる場合は variant を使用します。className による上書きは画面のレイアウト調整に限定し、色・角丸・高さ・状態の意味を場当たり的に変えないようにします。

例外が繰り返し使われるようになった場合は、variant または専用 component API として昇格させます。
