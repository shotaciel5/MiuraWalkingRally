"use client";
import {useEffect,useRef,useState} from "react";
import ReviewedLandmarkLayer,{ReviewedLandmarkNotice,type ReviewedLandmarks,type LandmarkEditor} from "./reviewed-landmark-layer";
import KomaFigure,{type ContextLayers} from "./koma-figure";
import {expandShortKoma} from "../lib/route/koma-display";
import type {KomaMap} from "../lib/route/koma";
import type {KomaContext} from "../lib/route/context";
import type {LandmarkPresentation,SymbolLimit} from "../lib/route/visual-landmarks";
export default function OperatorKomaDisplay({map,context,referenceContext,name,layers,minimal=false,presentation="source",symbolLimit=2,reviewed,editor}:{map:KomaMap;context:KomaContext;referenceContext:KomaContext|null;name:string;layers:ContextLayers;minimal?:boolean;presentation?:LandmarkPresentation;symbolLimit?:SymbolLimit;reviewed?:ReviewedLandmarks;editor?:LandmarkEditor}){
 const primary=useRef<HTMLDivElement>(null),[width,setWidth]=useState<number|null>(null);
 useEffect(()=>{
  if(!map.shortGeometry||!primary.current)return;
  const element=primary.current,measure=()=>setWidth(Math.min(300,Math.floor(element.getBoundingClientRect().width)));
  measure();if(typeof ResizeObserver==="undefined")return;
  const observer=new ResizeObserver(measure);observer.observe(element);return()=>observer.disconnect();
 },[map.shortGeometry]);
 const figure=(m:KomaMap,c:KomaContext,reference=false,factor=1,clip=false)=><><KomaFigure map={m} referenceGeometry={reference?map.shortGeometry:undefined} name={name} context={c} layers={layers} minimal={minimal} presentation={reviewed?"roads":presentation} symbolLimit={symbolLimit} mandatorySteps={!!reviewed} interactive={!!editor} clipDetails={clip}>{reviewed&&layers.landmarks&&<ReviewedLandmarkLayer map={reference?{...m,branches:map.shortGeometry!.branches}:m} landmarks={reviewed} factor={factor} editor={editor}/>}</KomaFigure>{reviewed&&!minimal&&layers.landmarks&&(m.state==="ready"||reference)&&<ReviewedLandmarkNotice map={reference?{...m,branches:map.shortGeometry!.branches}:m} landmarks={reviewed} factor={factor}/>}</>;
 if(!map.shortGeometry||!referenceContext)return figure(map,context);
 const display=width===null?null:expandShortKoma(map,referenceContext,width);
 return <div className="operator-koma-display" data-koma-expansion={width===null?"measuring":display?"ready":"held"} data-koma-width={width??undefined} data-koma-factor={display?.zoomFactor}>
  {!minimal&&<p className="operator-koma-status">{display?"近接した分岐を拡大表示":"近接した分岐・表示を確認"}<small>元の枝・形状を保った表示です。入口・通行・安全性は現地未確認です。</small></p>}
  <div className="operator-koma-primary" ref={primary}>{width===null?<p role="status">図の表示幅を確認しています…</p>:display?figure(display.map,display.context,false,display.zoomFactor,true):figure(map,context)}</div>
  {!minimal&&<p className="preview-caption">{display?"見切れる目印や周辺の道路は30mの参照図で確認できます。":"この表示幅では記号を確実に区別できません。図の保留を継続します。"}枝端は隣の分岐や表示範囲で止めています。道路がそこで終わるとは限りません。</p>}
  <details data-koma-reference-toggle><summary>{minimal?"周辺図を見る":"周辺30mの参照図を開く"}</summary>{figure(map,referenceContext,true)}{!minimal&&<p className="preview-caption">道路と目印を確認する参照図です。短い枝には進入点・矢印を置いていません。</p>}</details>
 </div>;
}
