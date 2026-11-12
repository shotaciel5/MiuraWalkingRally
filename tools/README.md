# 検証・再現資料

koma-omission-referenceは共同開発者から受領した一式の凍結コピーです。元の93ファイルのハッシュとREADME/AGENTS/出典を保持しています。配布データ・学習/評価スクリプトは公開画面やアプリ起動から読み込みません。

アプリ用の元ルールの最小コピーはlib/route/omission/vendor/routing.cjs、統合コード/契約はlib/route/omissionです。現行の仕様・互換性差・検証結果はdocs/koma-omission-integration.mdを参照してください。

WindowsでPython検証をする場合はPYTHONUTF8=1を設定してください。アプリの通常実行はNode/TypeScriptのみで、Python/学習ライブラリは不要です。
