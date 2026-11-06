# ADR-002：ローカルPoCのWeb実行環境

- 日付：2026-11-06
- 状態：採用（P2-03のローカル実行環境）
- 関連：[基本設計](../design.md)、[実行手順](../../README.md)、[PoC検証記録](../poc-route-map.md)

## 選定と根拠

| 項目 | 採用版・方法 | 選定理由 |
| --- | --- | --- |
| Node.js | 24.22.2 | Amplify HostingのSSR対応メジャーに含まれるLTS。既存PCのNode.jsとは分けて検証する。 |
| npm | 11.19.1 | 上記Node.js公式配布に同梱される版。package-lock.jsonで再現性を持たせる。 |
| Next.js | 15.5.29、App Router | AWS公式のNext.js 12〜15対応範囲内で、選定時点の15系安定版を固定する。 |
| React／React DOM | 19.3.1 | Next.jsのpeerDependenciesに整合する19系安定版を固定する。 |
| TypeScript | 5.9.3 | 基本方針に従い、型検査をローカルで行う。 |
| UI | Reactと通常のCSS | 最小画面に新しいUIライブラリやTailwindを導入する必要がない。 |
| テスト | Node.js組込みtest runnerとHTTP fetch | 外部テストサービス・ブラウザの追加導入なしで、起動・HTML/CSS配信・404を確認する。 |

2026-11-06に[AWSのNext.js対応機能](https://docs.aws.amazon.com/amplify/latest/userguide/ssr-amplify-support.html)と[SSR・Node.js対応](https://docs.aws.amazon.com/amplify/latest/userguide/ssr-supported-features.html)を確認した。Edge API、streaming等の非対応機能に依存しない。現時点は静的生成できる準備画面であり、SSRやクラウドバックエンドの必須化はしない。

各パッケージの安定版、engines・peerDependenciesはnpm公式レジストリで確認し、Node.js配布版は[公式リリース一覧](https://nodejs.org/dist/index.json)で確認した。Next.jsの対応表はAWSでの実機動作検証と区別する。

## 依存監査で行った補正

初回のnpm auditでNext.js 15の間接依存PostCSSに既知の脆弱性が検出されたため、Next.js配下のPostCSSを8.5.32に限定してoverridesで固定する。Next.jsのメジャー更新でAWS公式の対応範囲を外す方法は採らない。

PostCSS公式の[リリース](https://github.com/postcss/postcss/releases/tag/8.5.32)と[アドバイザリー](https://github.com/postcss/postcss/security/advisories/GHSA-6g55-p6wh-862q)を確認した。補正後にロックファイルを更新し、npm ci、監査、CSS配信、ビルドで検証する。これは互換性を永続的に保証するものではなく、Next.js更新時にはoverrideの要否を見直す。

## 保守上の制限

[Next.jsの保守方針](https://nextjs.org/support-policy)による15系のセキュリティ更新期限は2027-01-31。今回はAmplify Hostingとの文書上の互換性を優先し、ローカルPoCの構成として使う。本番公開前には保守対象のNext.jsとAmplify対応を再確認し、必要な更新を行う。期限を過ぎた版の継続利用を承認するものではない。

[Node.jsのリリース方針](https://nodejs.org/en/about/previous-releases)も確認し、メンテナンス対象のLTSを使用する。今後の依存更新は、公式対応、セキュリティ更新、相互互換性、ローカルの検証結果に基づいて行う。

## ローカル環境と検証範囲

Windowsでは公式Node.jsのzipをSHA-256照合後、Git対象外の.toolsへ展開して検証する。グローバルのNode.jsは更新しない。各開発者が同じNode.jsを用意できれば、.toolsは必須ではない。

READMEに依存インストール、開発起動、型検査・HTTPテスト、ビルド、本番用起動の手順を記載する。HTTPスモークテストは起動済みのサーバーを対象にし、描画・操作・実道路の正確性を確認したことにはしない。

AWS認証情報、Amplify sandbox、DB、管理画面、経路探索、コマ生成、QR認証は今回導入しない。AWSの最小配信検証は別途承認後に行う。
