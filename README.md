# 三浦市ウォーキングラリー

三崎下町の短い周回を題材に、徒歩ルートと従来型コマ地図を検証するWebアプリです。現在はPhase 2・P2-03の最小実行環境と準備画面までです。ルート探索・コマ生成・QR認証・参加進捗・クーポンは未実装です。

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

### 3. 別ターミナルで型検査・HTTPスモークテスト

同じNode.jsを有効にして、同じプロジェクトルートから実行します。

~~~text
npm run typecheck
npm test
~~~

npm run typecheckはNext.jsのルート型を生成してから型検査するため、生成ファイルがない新規クローンでも実行できます。

npm testは、起動済みのローカルサーバーに対してHTML・日本語設定・main要素・viewport、参照CSSの配信、存在しないパスの404応答を検査します。ブラウザの描画・操作や、道順・歩行安全性を検証するテストではありません。

3000番以外で起動した場合は、同じシェルで接続先を指定します。

~~~powershell
$env:SMOKE_BASE_URL = "http://127.0.0.1:3001"
npm test
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

npm startは本番用ビルドの起動です。先にnpm run buildが必要です。別ターミナルから同じnpm testでHTTP配信を確認できます。終了時はCtrl+Cで停止します。

## AWS互換性と保守

2026-11-06に、[AWS公式のNext.js対応](https://docs.aws.amazon.com/amplify/latest/userguide/ssr-amplify-support.html)と[Node.jsランタイム対応](https://docs.aws.amazon.com/amplify/latest/userguide/ssr-supported-features.html)を確認し、Next.js 15／Node.js 24の範囲で選定しています。未確認のEdge機能やstreamingには依存せず、現在のページは静的に生成できる内容です。

Next.js 15のセキュリティ更新期限は[公式保守方針](https://nextjs.org/support-policy)で2027-01-31とされています。公開前には、保守対象の版とAmplify Hostingの対応範囲を再確認してください。必要な更新は別タスクとして扱います。

ローカルでのビルド成功はAWS上での動作保証ではありません。AWSリソース、リポジトリ接続、Amplify設定ファイルは今回作成していません。AWS利用可能後に、明示承認を得て最小構成を検証します。

## 歩行ルールの合意

歩道の存在は経路候補にするための必須条件にしません。自動車が通れる一般道路も、歩道なし・歩道情報なしを理由に一律除外しない方針です。一方、明示的な歩行禁止・自動車専用・立入制限等は別に判定します。徒歩専用路を車が通れない理由だけで除外することもありません。

今回は方針の記録までで、経路フィルターは未実装です。タグの優先順位・例外・確認が必要な道路はP2-04の設計とテストで具体化します。詳細は [PoC検証記録](docs/poc-route-map.md) を参照してください。
