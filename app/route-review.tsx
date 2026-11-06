"use client";

import {useState} from "react";
import KomaBrowser from "./koma-browser";
import KomaFigure, {type ContextLayers} from "./koma-figure";
import RouteOverview, {type OverviewData} from "./route-overview";
import type {ReviewCard} from "../lib/misaki-review";
import type {ReviewSelection} from "../lib/route/review";

export default function RouteReview({generated,reference,data}:{generated:ReviewCard[];reference:ReviewCard[];data:OverviewData}){
  const [selection,setSelection]=useState<ReviewSelection>({source:"generated",index:0});
  const [layers,setLayers]=useState<ContextLayers>({buildings:true,landmarks:true,details:true});
  const cards=selection.source==="generated"?generated:reference;
  const select=(next:ReviewSelection)=>{
    const target=next.source==="generated"?generated:reference;
    if(!Number.isInteger(next.index)||next.index<0||next.index>=target.length)throw new Error("Invalid review selection");
    setSelection(next);
  };
  const ready=cards.filter(c=>c.map.state==="ready").length;
  return <section className="route-review" aria-labelledby="review-title">
    <div className="review-toolbar panel">
      <div><p className="eyebrow">OPERATOR REVIEW</p><h2 id="review-title">コマと全体地図を照合する</h2><p>アルゴリズム生成 · 固定OSMデータ · 訪問順は手動指定</p></div>
      <div className="review-options">
        <div className="junction-source review-source" aria-label="照合する経路">
          <button type="button" aria-pressed={selection.source==="generated"} onClick={()=>select({source:"generated",index:0})}>生成経路 {generated.length}コマ</button>
          <button type="button" aria-pressed={selection.source==="reference"} onClick={()=>select({source:"reference",index:0})}>手動参照 {reference.length}コマ</button>
        </div>
        <fieldset className="context-layers"><legend>OSMの補足表示</legend>{([["landmarks","目印"],["buildings","建物"],["details","道路名・階段"]] as const).map(([key,label])=><label key={key}><input type="checkbox" data-context-toggle={key} checked={layers[key]} onChange={e=>setLayers({...layers,[key]:e.target.checked})}/>{label}</label>)}</fieldset>
      </div>
    </div>
    <div className="review-columns">
      <KomaBrowser generated={generated} reference={reference} {...selection} onSelect={select} layers={layers}/>
      <section className="panel map-panel" aria-labelledby="overview-title">
        <div className="card-heading"><div><p className="eyebrow">LINKED OVERVIEW</p><h2 id="overview-title">このコマは、ここ</h2></div><span className="subtle">北が上</span></div>
        <RouteOverview data={data} selection={selection} onSelect={select} layers={layers} context={cards[selection.index].context}/>
      </section>
    </div>
    <section className="panel koma-gallery" aria-labelledby="gallery-title">
      <div className="card-heading"><div><p className="eyebrow">ALL KOMA MAPS</p><h2 id="gallery-title">通過順のコマ地図一覧</h2></div><span className="subtle" data-gallery-count={cards.length}>{cards.length}件</span></div>
      <p className="route-caption">選ぶと上のコマと地図が切り替わります。同じ場所の再訪も別のコマです。描画{ready}件・図の確認待ち{cards.length-ready}件。</p>
      <ol className="koma-grid">{cards.map((card,index)=>{
        const name=card.stops.map(s=>s.name).join(" / ")||"分岐";
        return <li key={card.map.pathIndex}><button type="button" className="koma-thumbnail" data-review-card={card.map.sequence} aria-pressed={selection.index===index} onClick={()=>select({...selection,index})}>
          <span className="thumbnail-heading"><strong>#{card.map.sequence.toString().padStart(2,"0")}</strong><span>{card.map.state==="held"?"図の確認待ち":card.map.kind==="return"?"折返し":card.map.kind==="start"?"出発":card.map.kind==="finish"?"終了":"分岐"}</span></span>
          <KomaFigure map={card.map} name={name} context={card.context} layers={layers} compact/>
          <span className="thumbnail-name">{name}</span><span className="thumbnail-distance">{card.map.metersToNext===null?"終了":`次まで ${Math.round(card.map.metersToNext)} m`} · 累積{Math.round(card.map.metersFromStart)}m</span>
        </button></li>;
      })}</ol>
    </section>
  </section>;
}
