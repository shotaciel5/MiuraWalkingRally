# 配布する学習済みモデル

corrected-697.jsonはtools/koma-omission-reference/models/corrected-candidate/model.jsonのバイト同一コピーです。再学習/手編集はしていません。

- 原本SHA-256：14cdee63223ecd402627d65e414c5c811051af91381b88855f14db333ecab9f6
- canonical JSON SHA-256：47c788f645b8afe88d68b7d7614b3d856bb4cfb1ab9a70921b8ce639f4dcb1d1
- 350特徴・200木・float32入力、junction-correspondence-entry-curve-v1:D
- ③の閾値0.2と角度30度はmodel.keepThreshold（単独分類用0.5）と区別します。
- 学習/利用条件・データの位置付け：[原資料](../../../../tools/koma-omission-reference/docs/ATTRIBUTION_AND_DATA.md)
- 移植・検証・旧版互換：[仕様](../../../../docs/hybrid-koma-omission.md)

起動時の学習/モデル取得はしません。ハッシュ/構造が異なる場合は省略せず保持します。元の評価結果をこのアプリでの精度保証として使わないでください。
