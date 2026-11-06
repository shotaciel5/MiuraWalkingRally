# 三浦市ウォーキングラリー

三崎下町の短い周回を題材に、徒歩ルートと従来型コマ地図を検証するWebアプリです。現在はPhase 2・P2-04まで。固定OSMデータによる経路候補、区間距離・推定時間、手動参照との比較地図を表示します。入口・現地安全性は確認待ちです。コマ生成・QR認証・参加進捗・クーポンは未実装です。

要件は [docs/requirements.md](docs/requirements.md)、設計は [docs/design.md](docs/design.md)、進捗は [docs/backlog.md](docs/backlog.md)、PoCの検証記録は [docs/poc-route-map.md](docs/poc-route-map.md) を参照してください。

## 前提

- Node.js **24.22.2**、npm **11.19.1**。Node.jsの版は.node-versionにも記録しています。
- Next.js **15.5.29**、React／React DOM **19.3.1**、TypeScript **5.9.3**。直接依存とpackage-lock.jsonで版を固定しています。間接依存のPostCSSは監査結果に基づいて8.5.32へ固定しています（[選定記録](docs/decisions/002-local-web-runtime.md)）。
- 初回の依存取得にはインターネットが必要です。起動・テスト・ビルドにAWSアカウント、認証情報、AWS CLI、Amplify sandbox、APIキーは必要ありません。
- 起動・ビルドに必須の環境変数はありません。.env.exampleにその旨を記載しています。.env.local等はGit対象外です。
- 既存の古いNode.jsが選ばれる場合は、バージョン管理ツール等で上記の版を有効にしてから実行してください。システム全体のNode.js更新はこの作業では行っていません。

このワークスペースのWindows検証用Node.jsは、Git対象外の.tools/node-v24.22.2-win-x64に置いています。存在する場合、そのシェルだけで次のように有効化できます。新規クローンには.toolsは含まれないため、[Node.js公式配布](https://nodejs.org/dist/v24.22.2/)から対象版を用意してください。

~~~powershell
$taskNodeDirectory = (Resolve-Path -LiteralPath ".tools/node-v24.22.2-win-x64").Path
$env:Path = $taskNodeDirectory + ";" + $env:Path
node --version
npm --version
~~~

## ローカルで install → start → test → build

### 1. 依存をインストール

~~~text
npm ci
~~~

package-lock.jsonに従ってインストールします。Node.jsとnpmの対応版は前項を確認してください。

### 2. 開発サーバーを起動

~~~text
npm run dev
~~~

表示された http://127.0.0.1:3000 を開きます。3000番が使用中なら、表示された実際のポートを確認してください。このターミナルは起動したままにします。Next.jsの起動時に.env.localを用意する必要はありません。

### 3. 別ターミナルで型検査・単体テスト・HTTPスモークテスト

同じNode.jsを有効にして、同じプロジェクトルートから実行します。

~~~text
npm run typecheck
npm test
npm run test:smoke
~~~

npm run typecheckはNext.jsのルート型を生成してから型検査するため、生成ファイルがない新規クローンでも実行できます。

npm testはサーバーやネット接続なしで、歩行ルール・接続・距離・経路探索・固定データを検査します。

npm run test:smokeは、起動済みのローカルサーバーに対してHTML・日本語設定・main要素・viewport、経路/参照の図形・帰属表示・確認待ち表示、参照CSSの配信、存在しないパスの404応答を検査します。ブラウザの描画・操作や、道順・歩行安全性を検証するテストではありません。

3000番以外で起動した場合は、同じシェルで接続先を指定します。

~~~powershell
$env:SMOKE_BASE_URL = "http://127.0.0.1:3001"
npm run test:smoke
~~~

接続先はローカルHTTPに限定しています。サーバー未起動時はテストが失敗し、起動手順を示します。SMOKE_BASE_URLはテスト用の設定であり、.env.localからの自動読込みは行いません。

### 4. 開発サーバーを停止してビルド

開発サーバーのターミナルでCtrl+Cを押してから実行します。開発サーバーとビルドで.nextを同時に更新しないようにします。

~~~text
npm run build
~~~

### 5. ビルド結果を起動

~~~text
npm start
~~~

npm startは本番用ビルドの起動です。先にnpm run buildが必要です。別ターミナルからnpm run test:smokeでHTTP配信を確認できます。終了時はCtrl+Cで停止します。

## AWS互換性と保守

2026-11-06に、[AWS公式のNext.js対応](https://docs.aws.amazon.com/amplify/latest/userguide/ssr-amplify-support.html)と[Node.jsランタイム対応](https://docs.aws.amazon.com/amplify/latest/userguide/ssr-supported-features.html)を確認し、Next.js 15／Node.js 24の範囲で選定しています。未確認のEdge機能やstreamingには依存せず、現在のページは静的に生成できる内容です。

Next.js 15のセキュリティ更新期限は[公式保守方針](https://nextjs.org/support-policy)で2027-01-31とされています。公開前には、保守対象の版とAmplify Hostingの対応範囲を再確認してください。必要な更新は別タスクとして扱います。

ローカルでのビルド成功はAWS上での動作保証ではありません。AWSリソース、リポジトリ接続、Amplify設定ファイルは今回作成していません。AWS利用可能後に、明示承認を得て最小構成を検証します。

## 歩行ルールの合意

歩道の存在は経路候補にするための必須条件にしません。自動車が通れる一般道路も、歩道なし・歩道情報なしを理由に一律除外しない方針です。一方、明示的な歩行禁止・自動車専用・立入制限等は別に判定します。徒歩専用路を車が通れない理由だけで除外することもありません。

P2-04でこのフィルターを実装しました。footの指定を一般accessより優先し、徒歩向け一方通行を扱います。未解決の条件付き制限・障害物・矛盾するタグは確認待ちとして探索から外します。通常の車向けonewayだけでは徒歩を一方通行にしません。詳細は [PoC検証記録11節](docs/poc-route-map.md#p2-04) を参照してください。

## 経路候補を再現する

~~~text
npm run route:report
~~~

サーバー不要で区間ごとの道路ID・ノード列・距離・参照との共通区間を出力します。固定訪問順は三崎港 → 海南神社 → 光念寺 → 本瑞寺 → 三崎港。合計約1.027km、時速4kmの仮定で約16分です。坂・階段の減速、待機・休憩・撮影は含めません。到着点は既存道路ノードの仮置きで、バス停周辺の基準点は道路中心線上です。現地で操作・待機する位置を示していません。

画面で区間を選ぶと重なる往復を確認でき、手動参照の表示を切り替えられます。生成候補は距離最短で、交通量・坂・景観を考慮した推奨経路ではありません。手動参照と異なる区間の通行条件は確認待ちです。

固定データは [data/misaki](data/misaki/README.md) に出典・取得時点・クエリ・SHA-256とともに保存しています。**© OpenStreetMap contributors / ODbL 1.0**。起動・テスト・ビルドは外部の道路APIや地図タイルに接続しません。手動参照は同じOSMデータから生成前に固定した机上候補で、現地確認済みの正解ではありません。

データ更新が必要な場合だけ、出典・条件を確認して `node scripts/fetch-misaki-osm.mjs --refresh` を実行します。通常の再現確認では取得し直さず、コミット済みデータを使ってください。更新後は到着点・手動参照・経路を再検証します。
