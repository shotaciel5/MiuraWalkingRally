"use client";

import { useId, useState } from "react";
import type { KomaCardData } from "../lib/misaki-koma";
import { arrowPath, KOMA_VIEW } from "../lib/route/koma";
import type { DiagramPoint, KomaMap } from "../lib/route/koma";

function line(points: DiagramPoint[]) { return points.map(p=>p.x.toFixed(3)+","+p.y.toFixed(3)).join(" "); }
function KomaFigure({ map, name }: {map:KomaMap;name:string}) {
  const id=useId().replaceAll(":","");
  if(map.state==="held")return (
    <div className="koma-held" data-koma-held={map.sequence} role="note">
      <span aria-hidden="true">!</span><strong>このコマの図は確認待ちです</strong>
      <p>近接した分岐や方向・形状の不足により、進む枝を確実に区別できません。全体地図と根拠を確認してください。</p>
    </div>
  );
  const incoming=map.branches.find(branch=>branch.arrival);
  const outgoing=map.branches.find(branch=>branch.departure);
  const inlet=incoming?.points.at(-1);
  return (
    <svg className="koma-figure" viewBox={`0 0 ${KOMA_VIEW.width} ${KOMA_VIEW.height}`} role="img" aria-labelledby={id+"-title "+id+"-desc"} data-koma-svg={map.sequence}>
      <title id={id+"-title"}>{"コマ"+map.sequence+" "+name}</title>
      <desc id={id+"-desc"}>{map.kind==="return"?"入ってきた同じ道を戻ります。":map.kind==="start"?"出発点から緑の矢印へ進みます。":map.kind==="finish"?"このコマが終了地点です。":"黒点のある道から入り、緑の矢印の枝へ進みます。"} 元データに接続する枝は{map.branches.length}本。現地の通行・安全性は未確認です。</desc>
      <defs><marker id={id+"-arrow"} markerWidth="16" markerHeight="16" viewBox="0 0 10 10" refX="8" refY="5" orient="auto" markerUnits="userSpaceOnUse"><path d="M0 0L10 5L0 10Z" fill="#17634f"/></marker></defs>
      <rect x="1" y="1" width="298" height="278" rx="14" fill="#f5f6ef"/>
      <g fill="none" strokeLinecap="round" strokeLinejoin="round">
        {map.branches.map(branch=><polyline key={branch.neighborNodeId} points={line(branch.points)} data-koma-branch={branch.neighborNodeId} stroke={branch.exit==="review"?"#aa7d33":branch.exit==="excluded"?"#8c958b":"#b7c5b9"} strokeWidth={7} strokeDasharray={branch.exit==="review"?"2 5":branch.exit==="excluded"?"6 5":undefined}/>)}
        {incoming&&<polyline data-koma-inlet={incoming.neighborNodeId} points={line(incoming.points)} stroke="#263d34" strokeWidth={7}/>}
        {outgoing&&<polyline data-koma-exit={outgoing.neighborNodeId} points={line(arrowPath(outgoing.points))} stroke="#17634f" strokeWidth={4} markerEnd={`url(#${id}-arrow)`}/>}
      </g>
      {inlet&&<circle cx={inlet.x} cy={inlet.y} r={6} fill="#263d34" data-koma-inlet-dot="true"/>}
      <circle cx={KOMA_VIEW.centerX} cy={KOMA_VIEW.centerY} r={map.kind==="start"?6:4} fill={map.kind==="start"?"#263d34":"white"} stroke="#263d34" strokeWidth={2}/>
      <text x="150" y="263" textAnchor="middle" className="koma-orientation">{map.kind==="start"?"出る方向が上":map.kind==="finish"?"入ってきた道から、ここで終了":"入ってきた道が下"}</text>
    </svg>
  );
}

export default function KomaBrowser({generated,reference}:{generated:KomaCardData[];reference:KomaCardData[]}) {
  const [source,setSource]=useState<"generated"|"reference">("generated");
  const [index,setIndex]=useState(0);
  const cards=source==="generated"?generated:reference;
  const card=cards[index], map=card.map;
  const name=card.stops.map(s=>s.name).join(" / ") || "分岐";
  const roleNames:Record<string,string>={S:"出発",C1:"チェックポイント候補",W1:"経由地候補",C2:"チェックポイント候補",G:"終了"};
  const changeSource=(value:"generated"|"reference")=>{setSource(value);setIndex(0)};
  const ready=cards.filter(c=>c.map.state==="ready").length;
  return (
    <section className="panel koma-section" aria-labelledby="koma-title" data-koma-count={cards.length} data-koma-source={source}>
      <div className="card-heading"><div><p className="eyebrow">KOMA MAP / LOCAL POC</p><h2 id="koma-title">ひとコマずつ、道を確かめる</h2></div><span className="status">現地未確認</span></div>
      <p className="koma-intro">黒点のある道から入り、矢印の枝へ。入ってきた道が下になる向きの模式図です。安全に停止できる場所で確認してください。</p>
      <div className="koma-layout">
        <div className="koma-card">
          <div className="koma-card-heading"><span className="koma-count">コマ {map.sequence} / {cards.length}</span><span className="koma-kind">{map.kind==="return"?"同じ道を戻る":map.kind==="start"?"出発":map.kind==="finish"?"終了":"分岐・到着点"}</span></div>
          <h3 data-koma-name={name}>{name}</h3>
          <KomaFigure map={map} name={name}/>
          <div className="koma-distance" aria-live="polite" data-koma-sequence={map.sequence}>
            <span>{map.metersToNext===null?"このコースの終了地点":"次のコマまで"}</span>
            {map.metersToNext!==null&&<strong>{Math.round(map.metersToNext)}<small> m</small></strong>}
            <span className="koma-cumulative">出発から {Math.round(map.metersFromStart)} m</span>
          </div>
          <div className="koma-navigation">
            <button type="button" onClick={()=>setIndex(i=>i-1)} disabled={index===0} aria-label="前のコマ">← 前のコマ</button>
            <button type="button" onClick={()=>setIndex(i=>i+1)} disabled={index===cards.length-1} aria-label="次のコマ">次のコマ →</button>
          </div>
        </div>
        <div className="koma-context">
          <label htmlFor="koma-select">通過順にコマを選ぶ</label>
          <select id="koma-select" value={index} onChange={event=>setIndex(Number(event.target.value))}>{cards.map((c,i)=><option key={c.map.pathIndex} value={i}>#{c.map.sequence} {c.stops.map(s=>s.name).join(" / ")||"分岐"} · 累積{Math.round(c.map.metersFromStart)}m</option>)}</select>
          <p className="koma-legend"><span><i className="inlet-symbol"/>入ってきた道</span><span><i className="exit-symbol">→</i>出る方向</span><span><i className="restricted-symbol"/>探索から除外した枝</span></p>
          {card.stops.length>0&&<aside className="koma-stop" aria-labelledby="koma-stop-title"><p className="eyebrow">SPOT</p><h3 id="koma-stop-title">このコマのスポット</h3>{card.stops.map(stop=><div key={stop.id} data-koma-stop={stop.id}><span className="koma-stop-role">{roleNames[stop.id]??"到着点"}</span><strong>{stop.name}</strong><p>道路データ上の仮の到着点です。入口・滞在できる場所・利用条件は確認待ちです。</p><details><summary>位置の確認事項</summary><p>{stop.note}</p></details></div>)}</aside>}
          <p className="route-caption">局所の道路形状を切り出した模式図です。道幅・歩道・横断位置を表しません。距離は図上の長さではなく、次のコマまで道路に沿って集計しています。</p>
          <details className="koma-evidence"><summary>この図の根拠と確認状態</summary>
            <p><a href={`https://www.openstreetmap.org/node/${map.nodeId}`}>OSM node/{map.nodeId}</a> · 通過位置{map.pathIndex}。接続{card.candidate.branches.length}枝。描画は各枝30m以内、次の分岐・終端までです。</p>
            <p>{map.state==="held"?"図は保留しています。":"元データの局所形状を描画できました。現地での正確性・安全性は未確認です。"}</p>
            {map.issues.length>0&&<p>近接分岐、または方向・形状・通行条件に確認が必要な情報があります。</p>}
            <ul>{card.candidate.branches.map(branch=><li key={branch.neighborNodeId}>接続先 <a href={`https://www.openstreetmap.org/node/${branch.neighborNodeId}`}>{branch.neighborNodeId}</a>{branch.arrival?" / 進入":""}{branch.departure?" / 退出":""} · 退出条件 {branch.exit==="candidate"?"候補":branch.exit==="review"?"保留":"除外"}</li>)}</ul>
          </details>
          <details className="koma-compare"><summary>手動参照のコマと比較する</summary><div className="junction-source"><button type="button" aria-pressed={source==="generated"} onClick={()=>changeSource("generated")}>生成経路 {generated.length}コマ</button><button type="button" aria-pressed={source==="reference"} onClick={()=>changeSource("reference")}>手動参照 {reference.length}コマ</button></div><p>表示中：{source==="generated"?"生成経路":"手動参照"}。描画{ready}件・図の確認待ち{cards.length-ready}件。候補の省略・統合は行っていません。</p></details>
        </div>
      </div>
      <p className="map-attribution">道路データ © <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a> · ODbL 1.0</p>
      <p className="route-caption">コマの切替は閲覧用です。スポットの訪問や達成を記録するものではありません。施設写真は未登録です。</p>
    </section>
  );
}
