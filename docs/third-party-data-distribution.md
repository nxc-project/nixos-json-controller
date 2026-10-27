# 外部データのライセンス調査と配布方法

> 調査日: 2026-10-27  
> 対象: NXC GUI の pkgstats 由来レコメンドデータ、および生成済みデータを GitHub Releases / Nix package で配布する案

この文書は、配布方式の先例とライセンス確認の結果を記録するための調査メモです。法的助言ではなく、第三者データの再配布許可を認定するものでもありません。

## 結論

- **GitHub Releases に生成済みデータを置き、Nix 側で URL とハッシュを固定して取得する方式は、NXC のデータ配布方法として参考になる先例がある。**
- ただし、Release はデータのバージョン管理・取得・再現性を改善する仕組みであり、データ自体のライセンスや再配布権を与えるものではない。
- 調査した pkgstats API 文書からは、API レスポンスの統計データに対する明示的な再配布ライセンスを確認できていない。サーバーのソースコードのライセンスと API レスポンスの利用条件は分けて扱う。
- この未確認事項だけを理由に、既存のレコメンド機能や定期更新を直ちに削除する必要はない。一方、GUI package へ同梱して正式配布する前には、提供元への確認、条件が明示された別データソースへの移行、または保守者による明示的な配布方針の判断が必要。

## 調べた類似プロジェクト

### 1. nix-community/nix-index-database — 生成データを Release 配布する先例

- Repository: <https://github.com/nix-community/nix-index-database>
- License file: <https://github.com/nix-community/nix-index-database/blob/main/LICENSE>
- Release 更新 workflow: <https://github.com/nix-community/nix-index-database/blob/main/.github/workflows/update.yml>
- 生成された URL / hash: <https://github.com/nix-community/nix-index-database/blob/main/generated.nix>
- Nix 側の取得定義: <https://github.com/nix-community/nix-index-database/blob/main/default.nix>

README は、nix-index 用データベースを週次更新するプロジェクトであると説明している。GitHub Actions workflow が Release を作成し、生成済みデータベースを成果物として公開する。生成された `generated.nix` には Release URL とシステムごとの hash が記録され、`default.nix` は `fetchurl` を使って取得する。

この例から NXC が参考にできるのは、データ生成とアプリのソースコードを分け、バージョン付きの成果物とハッシュによって、どのデータを利用したかを追跡できるようにする設計である。

一方、確認した README、LICENSE、Release 取得処理からは、生成データベースに対する独立したライセンス宣言を確認できなかった。リポジトリの MIT License を根拠に、生成データベースも自動的に MIT であると判断してはならない。このプロジェクトは配布設計の先例であり、NXC の pkgstats データに対する再配布許可の根拠ではない。

### 2. archlinux-de/pkgstats-cli — 同じ API を利用する CLI

- Repository: <https://github.com/archlinux-de/pkgstats-cli>
- License file: <https://github.com/archlinux-de/pkgstats-cli/blob/master/LICENSE>
- pkgstats API documentation: <https://pkgstats.archlinux.de/api/doc>

このリポジトリの LICENSE は GPL-3.0 のライセンス文書であり、pkgstats の利用・検索を行うクライアントコードのライセンスと、API から返る統計データの利用条件を混同しないことが重要である。API をクライアントが利用していることだけでは、NXC が統計レスポンスを選別して JSON に変換し、他の利用者へ再配布できるかどうかまでは証明しない。

### 3. byronshock/purelyfreefonts — pkgstats の実データを小さな fixture として保管する例

- Data fixture notice: <https://github.com/byronshock/purelyfreefonts/blob/main/tests/fixtures/collectors/pkgstats/NOTICE>
- Project decisions: <https://github.com/byronshock/purelyfreefonts/blob/main/AUTHORITY.md>

このプロジェクトには、pkgstats から取得した少量の実データを加工・切り詰めてテスト fixture として保管する例がある。NOTICE にはデータソース、取得日、対象期間、選別・再計算した項目が記録され、pkgstats がデータのライセンスを示していない旨も記載されている。

これは出典や加工内容を説明する文書の参考になる。ただし、テスト用の少量データであることと、製品に含めて本番配布することは同じではない。この例も、再配布権が確認されたことを意味しない。

## NXC に適用する方針

### ソースコードとデータのライセンスを分ける

- NXC の `LICENSE` は、NXC が作成したコード等に適用する。
- pkgstats サーバー実装のライセンスは、API レスポンスのライセンスであるとは限らない。
- 出典表示、統計期間、取得日、生成日を付けることは透明性と追跡可能性を改善するが、それ自体で再配布許可を作り出すわけではない。
- AppStream の各レコード、アイコン、フォント、各依存パッケージも、それぞれ該当するライセンスや条件を確認する。すべてを NXC の MIT License に一括で含めない。

### Release 成果物方式の案

将来、レコメンドデータをソース管理から分離する場合は、例えば次の成果物構成が考えられる。

```text
GitHub Release: recommendations-YYYY-MM-DD
├── recommendations.json
└── DATASET_README.md
```

`DATASET_README.md` には、最低限次を記録する。

- 元データの提供元と API URL
- 取得日、統計対象期間、生成日時
- データを選別・加工する手順と生成スクリプトの revision
- 出典表示、確認できたライセンス、未確認の利用条件
- 成果物の SHA-256、対象バージョン
- 再生成や内容比較に関する補足事項

Nix package から Release 成果物を取り込む場合は、特定のバージョン URL と hash を固定して取得する。これにより生成データのバージョンを追跡しやすくし、変更があったときの検証をしやすくする。

**注意:** GUI package がこの JSON を同梱して配布する限り、Release 経由で取得する形に変更しても、データを利用者へ再配布する点は変わらない。アプリ実行時にネットワークから取得する設計に変えても、データの利用条件を自動的に解決するものではない。Release 化を、ライセンス確認の代替策として扱わない。

現行の NXC は `frontend/public/data/recommendations.json` をソースツリーで管理し、定期 workflow から更新している。この PR は Release 成果物方式への切り替え自体を実装するものではなく、既存の方式を維持したまま調査結果と未確認点を記録する。

## `THIRD_PARTY_NOTICES.md` での表記案

次は、現時点で確認できている事実と未確認事項を分けるための文案例である。**再配布を許可する宣言ではない。** 実際に利用条件の明示や提供元からの許可を確認できた場合は、その根拠に合わせて更新する。

```markdown
## Arch Linux pkgstats recommendation statistics

- **Source:** [Arch Linux pkgstats](https://pkgstats.archlinux.de/)
- **API documentation:** https://pkgstats.archlinux.de/api/doc
- **Included data:** Selected package-popularity records used to generate NXC's package recommendations.
- **Acquisition:** Retrieved from the public pkgstats API.
- **Processing:** The API response is filtered and transformed into NXC's recommendation dataset. The bundled dataset is a derived selection, not a copy of the complete API database.
- **Data period:** See the period recorded in the generated dataset.
- **Generated / updated:** See the generation date recorded in the generated dataset or release metadata.
- **Upstream data license:** No explicit license for redistribution of the API response data was identified in the API documentation reviewed on 2026-10-27.
- **Redistribution status:** Permission to redistribute the API-derived dataset has not been independently confirmed. The license of NXC's source code and the license of the pkgstats server implementation are not assumed to grant rights to the API response data.
- **Attribution:** The data source is identified as Arch Linux pkgstats. NXC records the source URL, data period, and update date alongside the recommendation data.

This notice documents the source and the current state of the license review. It does not grant a license to upstream data or establish redistribution permission.
```

この PR では Release 成果物への移行も実装する。

- `.github/workflows/update-recommendations.yml` は最新の `recommendations-latest` アセットを前回値として取得し、一時ディレクトリで次の JSON を生成する。
- データ内容が変わった場合だけ、内容を固定した `recommendations-<timestamp>-<run-id>` Release を作成し、その後 rolling alias の `recommendations-latest` アセットを更新する。
- `frontend/public/data/recommendations.json` は、アプリの初期表示・オフライン用の同梱 fallback として残す。定期更新はこのファイルを Git に commit しない。
- GUI は Tauri backend の固定 URL ダウンロード command を使う。GitHub Release asset のブラウザ fetch は CORS で失敗しうるため、WebView の直接 fetch にはしない。
- 更新がない週は新しい Release を作らない。生成失敗時は既存の Release asset を置き換えない。

生成スクリプトは `NXC_RECOMMENDATIONS_OUTPUT` で出力先を指定でき、通常のローカル実行では従来どおり public の fallback JSON を出力する。

この変更は配布方式を変えるもので、データの権利関係を解決するものではない。pkgstats の再配布条件は引き続き未確認として記録し、Release 説明にもその旨を表示する。

## この調査時点の判断

| 項目 | 判断 |
| --- | --- |
| Release と hash で生成データを配布する方式 | Nix プロジェクトに実例あり。NXC でも技術的な選択肢 |
| Release 化によるライセンス問題の解消 | 解消しない |
| pkgstats API のデータ再配布条件 | 確認した API 文書では明示条件を確認できず、未確定 |
| 既存のデータ更新処理・レコメンド機能 | 条件未確認だけを理由に、この調査 PR で削除しない |
| GUI package の正式配布 | 再配布条件の確認、または未確認リスクについて保守者が方針を決定する必要あり |

## 参照資料

- [pkgstats API documentation](https://pkgstats.archlinux.de/api/doc)
- [nix-index-database README](https://github.com/nix-community/nix-index-database)
- [nix-index-database update workflow](https://github.com/nix-community/nix-index-database/blob/main/.github/workflows/update.yml)
- [nix-index-database generated URL and hashes](https://github.com/nix-community/nix-index-database/blob/main/generated.nix)
- [pkgstats-cli LICENSE](https://github.com/archlinux-de/pkgstats-cli/blob/master/LICENSE)
- [PurelyFreeFonts pkgstats fixture NOTICE](https://github.com/byronshock/purelyfreefonts/blob/main/tests/fixtures/collectors/pkgstats/NOTICE)
