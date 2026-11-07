import SiteHeader from "../site-header";
import type {Metadata} from "next";
import type { OverviewData } from "../route-overview";
import { createMisakiReviewPoc } from "../../lib/misaki-review";
import RouteReview from "../route-review";
import type { OsmNode } from "../../lib/route/types";

export const metadata:Metadata={title:"ルート・コマ確認（運営者向けPoC）"};

function meters(value: number) { return Math.round(value).toLocaleString("ja-JP"); }

export default function Home() {
  let poc: ReturnType<typeof createMisakiReviewPoc>;
  try {
    poc = createMisakiReviewPoc();
  } catch (error) {
    return (
      <main id="main-content">
        <SiteHeader view="poc"/>
        <section className="panel" id="page-content" tabIndex={-1}><p className="eyebrow">LOCAL ROUTE POC</p><h1>経路を生成できませんでした</h1><p>指定地点・道路の接続・通行条件・固定データを確認してください。欠けた区間を直線で補完せず、今回の結果は生成失敗として扱います。</p><details><summary>生成失敗の理由</summary><p>{error instanceof Error ? error.message : "原因を特定できませんでした"}</p></details></section>
      </main>
    );
  }
  const { graph, route, reference, source, junctions, referenceJunctions } = poc;
  const point = (id: number) => {
    const node = graph.nodes.get(id) as OsmNode;
    return { lat: node.lat, lon: node.lon };
  };
  const flatten=(legs:{nodeIds:number[]}[])=>legs.flatMap((leg,i)=>leg.nodeIds.slice(i?1:0)).map(point);
  const data: OverviewData = {
    context:poc.context,
    paths:{generated:flatten(route.legs),reference:flatten(reference)},
    junctions: junctions.candidates,
    referenceJunctions: referenceJunctions.candidates,
    roads: [...graph.ways.values()].map(way => ({
      id: way.id, points: way.nodes.map(point),
      walking: !graph.diagnostics.some(d => d.type === "way" && d.id === way.id),
    })),
    legs: route.legs.map((leg, i) => ({
      label: leg.from.name + " → " + leg.to.name,
      points: leg.nodeIds.map(point), reference: reference[i].nodeIds.map(point),
    })),
    stops: route.stops.map(stop => ({id: stop.id, name: stop.name.replace("周辺", ""), point: point(stop.nodeId)})),
  };
  const baselineMeters = reference.reduce((sum, leg) => sum + leg.meters, 0);
  return (
    <main id="main-content">
      <SiteHeader view="poc"/>
      <section className="intro" id="page-content" tabIndex={-1} aria-labelledby="page-title">
        <p className="eyebrow">MIURA / MISAKI</p>
        <h1 id="page-title">ルートとコマを、<br />見比べて確かめる。</h1>
        <p className="lead">三崎下町の固定ルートを使った、運営者向けの検証画面です。<br className="desktop-break" />一覧・コマ・全体地図を連動させ、公開前の確認方法を試しています。</p>
      </section>
      <section className="notice" aria-label="経路の確認状態">
        <span className="status">机上候補・確認待ち</span>
        <p>各施設の到着点は仮置きです。入口・横断・階段・最新の通行規制は現地未確認のため、この経路は散策案内として公開できません。</p>
      </section>
      <div className="metrics" aria-label="経路の計算結果">
        <div><span>道路に沿う距離</span><strong>{(route.meters / 1000).toFixed(3)}<small> km</small></strong></div>
        <div><span>推定歩行時間</span><strong>約{Math.ceil(route.minutes)}<small> 分</small></strong></div>
        <div><span>訪問順</span><strong>固定<small> · 4区間</small></strong></div>
      </div>
      <RouteReview generated={poc.koma} reference={poc.referenceKoma} data={data}/>
      <div className="route-details">
        <section className="panel itinerary" aria-labelledby="itinerary-title">
          <p className="eyebrow">FIXED ORDER</p><h2 id="itinerary-title">今回の訪問順</h2>
          <ol className="stop-list">
            {route.stops.map((stop, i) => (
              <li key={stop.id}>
                <span className="stop-number">{stop.id}</span>
                <div><span className="stop-name">{stop.name}</span><span className="stop-role">{["スタート基準点", "チェックポイント候補", "経由地候補", "チェックポイント候補", "ゴール基準点"][i]}</span>
                  {route.legs[i] && <span className="leg-distance">次まで {meters(route.legs[i].meters)} m · 約{Math.ceil(route.legs[i].minutes)}分</span>}
                </div>
              </li>
            ))}
          </ol>
          <p className="route-caption">指定した既存の道路ノードを順に通過する計算です。施設の訪問達成・入口確認を意味しません。経由順の自動決定は未検証です。</p>
        </section>
      </div>
      <section className="panel comparison" aria-labelledby="comparison-title">
        <p className="eyebrow">REFERENCE CHECK</p><h2 id="comparison-title">参照との違いを残す</h2>
        <p>手動参照は生成前にOSMの道路列を指定した机上候補です。海南神社から光念寺への区間と帰路に違いがあり、現地の通行条件を確認する必要があります。</p>
        <div className="table-scroll"><table><caption className="sr-only">区間ごとの生成距離と手動参照距離</caption><thead><tr><th scope="col">区間</th><th scope="col">生成候補</th><th scope="col">手動参照</th></tr></thead><tbody>
          {route.legs.map((leg, i) => <tr key={leg.to.id}><th scope="row">{leg.from.name} → {leg.to.name}</th><td>{meters(leg.meters)} m</td><td>{meters(reference[i].meters)} m</td></tr>)}
          <tr className="table-total"><th scope="row">合計</th><td>{meters(route.meters)} m</td><td>{meters(baselineMeters)} m</td></tr>
        </tbody></table></div>
        <p className="route-caption">公式散策冊子（2021年）の掲載区間は合計約1.3km・22分。地点の位置・経路・丸めが異なるため、距離精度の正解値にはしていません。</p>
      </section>
      <section className="panel notes" aria-labelledby="conditions-title">
        <p className="eyebrow">CONDITIONS & SOURCE</p><h2 id="conditions-title">計算条件と未確認事項</h2>
        <ul>
          <li>ルート探索（Dijkstra法）、分岐抽出、コマの投影・回転はプログラムによる計算です。生成AIは使用していません。同じコード・固定データ・地点順・設定から同じ結果を再計算します。訪問順・仮の到着点の選択と安全確認は人の判断です。</li>
          <li>歩道は必須にせず、一般道路と徒歩道を候補にします。徒歩禁止・自動車専用・立入制限を優先し、未解決の条件付き制限は探索に使いません。</li>
          <li>距離はOSM道路中心線の点間距離の合計。時間は時速{route.speedKmh}kmを仮定し、信号待ち・休憩・撮影・坂や階段による減速を含めていません。生成候補に階段区間があります。</li>
          <li>道路の接続が確認できない点を近さだけでつなぎません。コマ図と分岐・方位角は検証用です。表示できても、現地の正確性・安全性を確認済みとはしません。</li>
        </ul>
        <details><summary>仮の到着点と道路データの記録</summary>
          <dl className="anchor-list">{route.stops.map(stop => <div key={stop.id}><dt>{stop.id} · {stop.name} <a href={`https://www.openstreetmap.org/node/${stop.nodeId}`}>OSM node/{stop.nodeId}</a></dt><dd>{stop.note}</dd></div>)}</dl>
          <p>データ取得：{source.retrievedAt} ／ OSM基準時刻：{source.osmBaseTimestamp}。起動・生成時の外部API接続はありません。</p><p>目印データ取得：{poc.contextSource.retrievedAt} ／ 指定基準時刻：{poc.contextSource.requestedSnapshotAt}。建物は形状、施設の面はラベル位置として表示します。入口・通行許可・営業状況は示しません。未登録の情報、複数の面を使う建物・施設は表示できない場合があります。</p>
          <p>今回の範囲内の明示的な除外・確認待ち：{graph.diagnostics.map(d => d.type + "/" + d.id + " (" + (d.state === "review" ? "確認待ち" : "除外") + ")").join("、")}。これらを候補が通過したという意味ではありません。</p>
          <p>手動参照の根拠：{poc.referenceBasis}</p>
          <p><a href="https://www.city.miura.kanagawa.jp/material/files/group/27/12_misakiguchi_2109015_tenchi.pdf">公式散策冊子</a> ／ <a href="https://www.city.miura.kanagawa.jp/shisetsu-map/2897.html">三浦市の施設マップ（通行止め情報）</a></p>
        </details>
      </section>
      <footer>海とまちを、自分の足で。<span>ローカルでの検証用</span></footer>
    </main>
  );
}
