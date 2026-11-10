"use client";
import {useEffect,useRef,useState} from "react";
import KomaFigure,{type ContextLayers} from "./koma-figure";
import {expandShortKoma} from "../lib/route/koma-display";
import type {KomaMap} from "../lib/route/koma";
import type {KomaContext} from "../lib/route/context";
export default function OperatorKomaDisplay({map,context,referenceContext,name,layers,minimal=false}:{map:KomaMap;context:KomaContext;referenceContext:KomaContext|null;name:string;layers:ContextLayers;minimal?:boolean}){
 const primary=useRef<HTMLDivElement>(null),[width,setWidth]=useState<number|null>(null);
 useEffect(()=>{
  if(!map.shortGeometry||!primary.current)return;
  const element=primary.current,measure=()=>setWidth(Math.min(300,Math.floor(element.getBoundingClientRect().width)));
  measure();if(typeof ResizeObserver==="undefined")return;
  const observer=new ResizeObserver(measure);observer.observe(element);return()=>observer.disconnect();
 },[map.shortGeometry]);
 if(!map.shortGeometry||!referenceContext)return <KomaFigure map={map} name={name} context={context} layers={layers} minimal={minimal}/>;
 const display=width===null?null:expandShortKoma(map,referenceContext,width);
 return <div className="operator-koma-display" data-koma-expansion={width===null?"measuring":display?"ready":"held"} data-koma-width={width??undefined} data-koma-factor={display?.zoomFactor}>
  {!minimal&&<p className="operator-koma-status">{display?"近接した分岐を拡大表示":"近接した分岐・表示を確認"}<small>元の枝・形状を保った表示です。入口・通行・安全性は現地未確認です。</small></p>}
  <div className="operator-koma-primary" ref={primary}>{width===null?<p role="status">図の表示幅を確認しています…</p>:display?<KomaFigure map={display.map} name={name} context={display.context} layers={layers} minimal={minimal} clipDetails/>:<KomaFigure map={map} name={name} context={context} layers={layers} minimal={minimal}/>}</div>
  {!minimal&&<p className="preview-caption">{display?"見切れる目印や周辺の道路は30mの参照図で確認できます。":"この表示幅では記号を確実に区別できません。図の保留を継続します。"}枝端は隣の分岐や表示範囲で止めています。道路がそこで終わるとは限りません。</p>}
  <details data-koma-reference-toggle><summary>{minimal?"周辺図を見る":"周辺30mの参照図を開く"}</summary><KomaFigure map={map} referenceGeometry={map.shortGeometry} name={name} context={referenceContext} layers={layers} minimal={minimal}/>{!minimal&&<p className="preview-caption">道路と目印を確認する参照図です。短い枝には進入点・矢印を置いていません。</p>}</details>
 </div>;
}
