# 三崎下町の固定OSMデータ

このディレクトリのOSM抽出・加工データはOpenStreetMap contributorsに由来し、[Open Database License 1.0（ODbL）](https://opendatacommons.org/licenses/odbl/1-0/)に従って提供します。

**© OpenStreetMap contributors** — [著作権・ライセンス](https://www.openstreetmap.org/copyright)

- osm.json：小範囲の道路・地点・接続データ。編集者情報と経路検証に不要なタグを除いた固定スナップショット。
- stops.json：既存道路ノードによる仮の到着点、地点ID・訪問順・未確認事項。入口の確定や認証位置ではありません。
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
