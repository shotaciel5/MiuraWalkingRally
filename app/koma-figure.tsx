"use client";

import { useId } from "react";
import { arrowPath, KOMA_VIEW } from "../lib/route/koma";
import type { KomaMap, KomaGeometry } from "../lib/route/koma";
import LandmarkLayer from "./landmark-layer";
import type { KomaContext } from "../lib/route/context";
export type ContextLayers={buildings:boolean;landmarks:boolean;details:boolean};

function line(points: {x:number;y:number}[]) { return points.map(p=>p.x.toFixed(3)+","+p.y.toFixed(3)).join(" "); }
export default function KomaFigure({ map, name, context, layers, compact=false, referenceGeometry, clipDetails=false }: {map:KomaMap;name:string;context:KomaContext;layers:ContextLayers;compact?:boolean;referenceGeometry?:KomaGeometry;clipDetails?:boolean}) {
  const id=useId().replaceAll(":","");
  if(map.state==="held"&&!referenceGeometry)return (
    <div className="koma-held" data-koma-held={compact?undefined:map.sequence} role="note">
      <span aria-hidden="true">!</span><strong>このコマの図は確認待ちです</strong>
      <p>近接した分岐や方向・形状の不足により、進む枝を確実に区別できません。全体地図と根拠を確認してください。</p>
    </div>
  );
  const branches=referenceGeometry?.branches??map.branches;
  const incoming=branches.find(branch=>branch.arrival);
  const outgoing=branches.find(branch=>branch.departure);
  const inlet=incoming?.points.at(-1);
  return (
    <svg className="koma-figure" viewBox={`0 0 ${KOMA_VIEW.width} ${KOMA_VIEW.height}`} role="img" aria-labelledby={id+"-title "+id+"-desc"} data-koma-svg={compact||referenceGeometry?undefined:map.sequence} data-koma-thumb={compact&&!referenceGeometry?map.sequence:undefined} data-koma-reference={referenceGeometry?map.sequence:undefined}>
      <title id={id+"-title"}>{"コマ"+map.sequence+" "+name}</title>
      <desc id={id+"-desc"}>{referenceGeometry?"周辺30mの参照図です。短い枝には進入点・矢印を置きません。":map.kind==="return"?"入ってきた同じ道を戻ります。":map.kind==="start"?"出発点から緑の矢印へ進みます。":map.kind==="finish"?"このコマが終了地点です。":"黒点のある道から入り、緑の矢印の枝へ進みます。"} 元データに接続する枝は{branches.length}本。現地の通行・安全性は未確認です。</desc>
      <defs><clipPath id={id+"-clip"}><rect x="9" y="9" width="282" height="232" rx="7"/></clipPath><marker id={id+"-arrow"} markerWidth="16" markerHeight="16" viewBox="0 0 10 10" refX="8" refY="5" orient="auto" markerUnits="userSpaceOnUse"><path d="M0 0L10 5L0 10Z" fill="#17634f"/></marker></defs>
      <rect x="1" y="1" width="298" height="278" rx="14" fill="#f5f6ef"/>
      <g clipPath={`url(#${id}-clip)`} pointerEvents="none">
        {layers.buildings&&context.buildings.map(b=><polygon key={b.id} data-context-building={b.id} points={line(b.points)} fill="#e4dfcf" stroke="#d0c8b5" strokeWidth="1"/>)}
      </g>
      <g fill="none" strokeLinecap="round" strokeLinejoin="round">
        {branches.map(branch=><polyline key={branch.neighborNodeId} points={line(branch.points)} data-koma-branch={branch.neighborNodeId} stroke={branch.exit==="review"?"#aa7d33":branch.exit==="excluded"?"#8c958b":"#b7c5b9"} strokeWidth={7} strokeDasharray={branch.exit==="review"?"2 5":branch.exit==="excluded"?"6 5":undefined}/>)}
        {incoming&&<polyline data-koma-inlet={incoming.neighborNodeId} points={line(incoming.points)} stroke="#263d34" strokeWidth={7}/>}
        {outgoing&&<polyline data-koma-exit={outgoing.neighborNodeId} points={line(referenceGeometry?outgoing.points:arrowPath(outgoing.points))} stroke="#17634f" strokeWidth={4} markerEnd={referenceGeometry?undefined:`url(#${id}-arrow)`}/>}
      </g>
      {layers.details&&<g stroke="#6b5541" strokeWidth="1.3" pointerEvents="none" clipPath={clipDetails?`url(#${id}-clip)`:undefined}>{context.steps.flatMap((s,i)=>{
        const dx=s.to.x-s.from.x,dy=s.to.y-s.from.y,length=Math.hypot(dx,dy);
        if(length<4)return [];
        const count=Math.max(1,Math.floor(length/7));
        return Array.from({length:count},(_,j)=>{const t=(j+.5)/count,x=s.from.x+dx*t,y=s.from.y+dy*t;return <line key={i+"-"+j} data-context-steps={s.wayIds.join(",")} x1={x-dy/length*5} y1={y+dx/length*5} x2={x+dy/length*5} y2={y-dx/length*5}/>});
      })}</g>}
      {layers.landmarks&&<LandmarkLayer features={context.landmarks} width={300} height={280} roads={branches.map(b=>b.points)} compact={compact}/>}

      {inlet&&!referenceGeometry&&<circle cx={inlet.x} cy={inlet.y} r={6} fill="#263d34" data-koma-inlet-dot="true"/>}
      <circle cx={KOMA_VIEW.centerX} cy={KOMA_VIEW.centerY} r={map.kind==="start"?6:4} fill={map.kind==="start"?"#263d34":"white"} stroke="#263d34" strokeWidth={2}/>
      {!compact&&<text x="150" y="263" textAnchor="middle" className="koma-orientation">{map.kind==="start"?"出る方向が上":map.kind==="finish"?"入ってきた道から、ここで終了":"入ってきた道が下"}</text>}
    </svg>
  );
}
