# 元の道なり・形状比較ルール

routing.cjsは共同開発者のsource/site/routing.jsのバイト列を変えずにコピーしたものです。アプリから使うのは形状用graph/traceRoad/continuation/類似判定です。徒歩経路の探索を置き換えず、Python/AIモデルは読み込みません。

- 原典：ogawa333/kyoto-koma-map、cc6d9699a1d8df1ec42cd433ac40d8e016f70292
- SHA-256：7285f87f5aeeb182b8291cc40ac4c83b50d8a96e23cff98aed3d96bc17979250
- 元資料：[出典・利用条件](../../../../tools/koma-omission-reference/docs/ATTRIBUTION_AND_DATA.md)
- アプリの対応/検証：[統合仕様](../../../../docs/koma-omission-integration.md)

新しい公開ライセンスを付与するものではありません。型定義は受領側で追加し、元コードは別ファイルで保護を上乗せしています。

P4-08a：この元ルール自体は変更せず、隣接するTypeScript層で学習済みモデルの追加保持を統合しました。アプリ全体の現行仕様は[③の仕様](../../../../docs/hybrid-koma-omission.md)を参照してください。
