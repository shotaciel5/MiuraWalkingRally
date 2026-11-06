# 三崎下町の固定OSMデータ

このディレクトリのOSM抽出・加工データはOpenStreetMap contributorsに由来し、[Open Database License 1.0（ODbL）](https://opendatacommons.org/licenses/odbl/1-0/)に従って提供します。

**© OpenStreetMap contributors** — [著作権・ライセンス](https://www.openstreetmap.org/copyright)

- osm.json：小範囲の道路・地点・接続データ。編集者情報と経路検証に不要なタグを除いた固定スナップショット。
- stops.json：既存道路ノードによる仮の到着点、地点ID・訪問順・未確認事項。入口の確定や認証位置ではありません。
- junction-reference.json：P2-05の抽出前に手作業で固定した9地点の接続先・経路上の通過位置・進入/退出。現地の正解情報ではなく、同じOSMデータに基づく照合資料です。
- reference.json：最短探索より前に手作業で指定したwayと始終ノードの列。生成候補に合わせて書き換えず、全体地図で比較します。現地の正解経路ではありません。
- JSONの改行は.gitattributesでLFに固定し、Windowsを含む再クローン時もスナップショットのハッシュを維持します。
- source.json：出典、取得時刻、OSM基準時刻、範囲を含むクエリ、加工方法、原本・固定データのSHA-256。
- 経路探索と画面表示は固定データを使い、起動・ビルド・テストでOverpassへ接続しません。
- アプリケーションコードのライセンスを決定する文書ではありません。
- 観光地図・航空写真・他社地図から道路形状を転記していません。
- データは現地の通行可否・工事・安全性の確認結果ではありません。

再取得はプロジェクトルートから、対応するNode.jsで次を実行します。既存スナップショットを上書きする操作なので、通常の検証では実行しません。

~~~text
node scripts/fetch-misaki-osm.mjs --refresh
~~~

取得範囲を広げたり繰り返し要求したりする前に、[Overpass運用方針](https://dev.overpass-api.de/overpass-doc/en/preface/commons.html)を確認してください。再取得で変更が生じた場合は、地点・接続・経路・ライセンス表示を再レビューします。

## 補足表示用の固定データ（P2-06b）

- context.json：ルートと手動参照の範囲から約80mを加えた矩形の建物・施設・店舗等。4,683ノード・789ウェイ、446,291バイト。抽出後に描画対象となった建物778件、目印は道路ノード由来を含め140件です。画面は表示範囲と件数を制限します。
- context-source.json：取得クエリ・取得日時・指定基準時刻・サーバーの基準時刻・ハッシュ・正規化方法。道路のosm.jsonは更新していません。
- Overpassの[date指定](https://wiki.openstreetmap.org/wiki/Overpass_API/Overpass_QL#Date)を使い、道路と同じ2026-11-06T12:46:21Zの状態を取得しました。取得日時は2026-11-06T15:55:21.314Z（日本時間11月7日）。サーバーの基準時刻と、検索対象として指定した時刻は別項目です。
- context.jsonのSHA-256：840b106523a427b9619115577b9dddd42c1d2c30ad1f517858309c75af771e24。
- 道路osm.jsonのSHA-256：13cd793e7ba64c3fdfd1d86438a5eddfa37befaba5458f544a75dca388a65c84。
- 補足情報は経路探索・通行判定・道路接続に使いません。単純な閉じたウェイとノードを扱い、リレーションによる複合形状、開いた施設ウェイ、未登録/無名の一般施設等は描画対象外です。編集者・連絡先・住所タグは保存していません。

補足データのみの明示的な再取得は次のコマンドです。通常の起動では不要です。元の道路基準時刻を維持して取得します。OSMの修正履歴やAPIの状況により取得結果が変わり得るため、再取得後はハッシュと表示を再レビューします。

~~~text
node scripts/fetch-misaki-context.mjs --refresh
~~~

建物・目印にも上記の© OpenStreetMap contributors / ODbL 1.0が適用されます。公共Overpassへの高頻度取得や実行時依存は導入していません。
