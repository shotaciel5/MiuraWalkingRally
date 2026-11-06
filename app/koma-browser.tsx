"use client";

import KomaFigure, {type ContextLayers} from "./koma-figure";
import type {ReviewCard} from "../lib/misaki-review";
import type {ReviewSelection} from "../lib/route/review";

export default function KomaBrowser({generated,reference,source,index,onSelect,layers}:{generated:ReviewCard[];reference:ReviewCard[];source:ReviewSelection["source"];index:number;onSelect:(selection:ReviewSelection)=>void;layers:ContextLayers}) {
  const cards=source==="generated"?generated:reference;
  const card=cards[index], map=card.map;
  const name=card.stops.map(s=>s.name).join(" / ") || "分岐";
  const roleNames:Record<string,string>={S:"出発",C1:"チェックポイント候補",W1:"経由地候補",C2:"チェックポイント候補",G:"終了"};
  return (
    <section className="panel koma-section" aria-labelledby="koma-title" data-koma-count={cards.length} data-koma-source={source}>
      <div className="card-heading"><div><p className="eyebrow">KOMA MAP / LOCAL POC</p><h2 id="koma-title">選択中のコマ地図</h2></div><span className="status">現地未確認</span></div>
      <p className="koma-intro">黒点のある道から入り、矢印の枝へ。入ってきた道が下になる向きの模式図です。一覧や全体地図からも、同じコマを選択できます。</p>
      <div className="koma-layout">
        <div className="koma-card">
          <div className="koma-card-heading"><span className="koma-count">コマ {map.sequence} / {cards.length}</span><span className="koma-kind">{map.kind==="return"?"同じ道を戻る":map.kind==="start"?"出発":map.kind==="finish"?"終了":"分岐・到着点"}</span></div>
          <h3 data-koma-name={name}>{name}</h3>
          <KomaFigure map={map} name={name} context={card.context} layers={layers}/>
          <div className="koma-distance" aria-live="polite" data-koma-sequence={map.sequence}>
            <span>{map.metersToNext===null?"このコースの終了地点":"次のコマまで"}</span>
            {map.metersToNext!==null&&<strong>{Math.round(map.metersToNext)}<small> m</small></strong>}
            <span className="koma-cumulative">出発から {Math.round(map.metersFromStart)} m</span>
          </div>
          {layers.landmarks&&map.state==="ready"&&<div className="landmark-key" data-context-key="true">
            <p>周辺の目印 <small>30m以内・近い順に最大4件</small></p>
            {card.context.landmarks.length?<ol>{card.context.landmarks.map(l=><li key={l.id}><a href={`https://www.openstreetmap.org/${l.id}`}>{l.name}</a><span>{l.kind} · 約{Math.round(l.meters)}m{l.anchor==="area-label"?" · エリア内の表示点":""}</span></li>)}</ol>:<p className="subtle">この範囲に表示対象の目印はありません。</p>}
            {card.context.availableLandmarks>4&&<p className="subtle">OSMにある{card.context.availableLandmarks}件から表示しています。</p>}
          </div>}
          {layers.details&&map.state==="ready"&&<p className="context-roadnames">道路名：{[...new Set(card.context.roads.map(r=>r.name).filter(Boolean))].join(" / ")||"OSMの記録なし"}{card.context.steps.length>0?" · 茶色の横線は階段区間":""}</p>}
          {map.state==="held"&&(layers.landmarks||layers.details)&&<p className="context-held-note route-caption">図と補足情報の描画を保留しています。全体地図の位置と元データを確認してください。</p>}
          <div className="koma-navigation">
            <button type="button" onClick={()=>onSelect({source,index:index-1})} disabled={index===0} aria-label="前のコマ">← 前のコマ</button>
            <button type="button" onClick={()=>onSelect({source,index:index+1})} disabled={index===cards.length-1} aria-label="次のコマ">次のコマ →</button>
          </div>
        </div>
        <div className="koma-context">
          <label htmlFor="koma-select">通過順にコマを選ぶ</label>
          <select id="koma-select" value={index} onChange={event=>onSelect({source,index:Number(event.target.value)})}>{cards.map((c,i)=><option key={c.map.pathIndex} value={i}>#{c.map.sequence} {c.stops.map(s=>s.name).join(" / ")||"分岐"} · 累積{Math.round(c.map.metersFromStart)}m</option>)}</select>
          <p className="koma-legend"><span><i className="inlet-symbol"/>入ってきた道</span><span><i className="exit-symbol">→</i>出る方向</span><span><i className="restricted-symbol"/>探索から除外した枝</span></p>
          {card.stops.length>0&&<aside className="koma-stop" aria-labelledby="koma-stop-title"><p className="eyebrow">SPOT</p><h3 id="koma-stop-title">このコマのスポット</h3>{card.stops.map(stop=><div key={stop.id} data-koma-stop={stop.id}><span className="koma-stop-role">{roleNames[stop.id]??"到着点"}</span><strong>{stop.name}</strong><p>道路データ上の仮の到着点です。入口・滞在できる場所・利用条件は確認待ちです。</p><details><summary>位置の確認事項</summary><p>{stop.note}</p></details></div>)}</aside>}
          <p className="route-caption">局所の道路形状を切り出した模式図です。道幅・歩道・横断位置を表しません。距離は図上の長さではなく、次のコマまで道路に沿って集計しています。</p>
          <details className="koma-evidence"><summary>この図の根拠と確認状態</summary>
            <p><a href={`https://www.openstreetmap.org/node/${map.nodeId}`}>OSM node/{map.nodeId}</a> · 通過位置{map.pathIndex}。接続{card.candidate.branches.length}枝。描画は各枝30m以内、次の分岐・終端までです。</p>
            <p>補足表示は目印30m以内・最大4件、建物は境界35m以内などから最大12件です。番号の引出線の先がOSMの表示点です。登録のない目印や入口は補完しません。</p>
            <p>{map.state==="held"?"図は保留しています。":"元データの局所形状を描画できました。現地での正確性・安全性は未確認です。"}</p>
            {map.issues.length>0&&<p>近接分岐、または方向・形状・通行条件に確認が必要な情報があります。</p>}
            <ul>{card.candidate.branches.map(branch=><li key={branch.neighborNodeId}>接続先 <a href={`https://www.openstreetmap.org/node/${branch.neighborNodeId}`}>{branch.neighborNodeId}</a>{branch.arrival?" / 進入":""}{branch.departure?" / 退出":""} · 退出条件 {branch.exit==="candidate"?"候補":branch.exit==="review"?"保留":"除外"}</li>)}</ul>
          </details>
        </div>
      </div>
      <p className="map-attribution">道路・目印データ © <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a> · ODbL 1.0</p>
      <p className="route-caption">コマの切替は閲覧用です。スポットの訪問や達成を記録するものではありません。施設写真は未登録です。目印の表示点は入口や通行可能な横断位置を示しません。</p>
    </section>
  );
}
