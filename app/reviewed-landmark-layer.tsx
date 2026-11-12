"use client";
import {useState} from "react";
import LandmarkIcon from "./landmark-icon";
import {layoutCandidates,type Candidate,type PhotoAsset} from "../lib/landmarks/model";
import type {KomaMap} from "../lib/route/koma";
import type {Point} from "../lib/route/types";
export type ReviewedLandmarks={center:Point;candidates:Candidate[];photos:Record<string,PhotoAsset>};
export type LandmarkEditor={candidates:Candidate[];photos:Record<string,PhotoAsset>;onToggle:(candidate:Candidate,value:boolean)=>void;busy:boolean};
export function ReviewedLandmarkNotice({map,landmarks,factor=1}:{map:KomaMap;landmarks:ReviewedLandmarks;factor?:number}){
 const {unplaced}=layoutCandidates({map,center:landmarks.center},landmarks.candidates,map.branches,factor);
 return unplaced.length>0?<p className="preview-caption" data-course-unplaced>この図で配置できない採用目印：{unplaced.map(c=>c.label).join("・")}。重なりや表示範囲のため省いています。候補一覧と30m参照図を確認してください。</p>:null;
}
export default function ReviewedLandmarkLayer({map,landmarks,factor=1,editor}:{map:KomaMap;landmarks:ReviewedLandmarks;factor?:number;editor?:LandmarkEditor}){
 const [failed,setFailed]=useState<Record<string,boolean>>({});
 const selected=new Set(landmarks.candidates.map(c=>c.id));
 // Keep adopted positions identical to the saved map; rejected candidates use the remaining space.
 const shown=editor?[...landmarks.candidates,...editor.candidates.filter(c=>!selected.has(c.id))]:landmarks.candidates;
 const {placed}=layoutCandidates({map,center:landmarks.center},shown,map.branches,factor);
 return <g data-course-landmarks>{placed.map(({candidate:c,x,y,anchor})=>{
  const active=selected.has(c.id),photo=c.kind==="unique"?(editor?.photos??landmarks.photos)[c.id.slice(10)]:undefined;
  const label=c.label+"："+(active?"採用中。押すと不採用":"不採用。押すと採用");
  const toggle=()=>{if(editor&&!editor.busy)editor.onToggle(c,!active)};
  return <g key={c.id} data-course-landmark={c.id} data-course-landmark-accepted={active} data-course-landmark-editable={editor?true:undefined} role={editor?"button":undefined} tabIndex={editor?(editor.busy?-1:0):undefined} aria-label={editor?label:undefined} aria-pressed={editor?active:undefined} aria-disabled={editor?editor.busy:undefined} onClick={editor?toggle:undefined} onKeyDown={editor?e=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();toggle()}}:undefined} style={editor?{cursor:editor.busy?"wait":"pointer",opacity:active?1:.45}:undefined}>
   <title>{editor?label:c.label}</title><circle cx={anchor.x} cy={anchor.y} r={2} fill="var(--accent)"/><path d={"M"+anchor.x+" "+anchor.y+"L"+(x+12)+" "+(y+12)} stroke="var(--muted)" strokeWidth=".7"/><g transform={"translate("+x+" "+y+")"}><rect width={24} height={24} rx={5} fill="var(--paper)" stroke={active?"var(--brand)":"var(--muted)"} strokeDasharray={active?undefined:"3 2"}/>{photo?.crop?failed[c.id]?<text x={12} y={17} textAnchor="middle" data-course-photo-error>?</text>:<image data-course-photo={photo.featureId} href={photo.crop.path} width={24} height={24} preserveAspectRatio="xMidYMid meet" onError={()=>setFailed(s=>({...s,[c.id]:true}))}/>:<LandmarkIcon symbol={c.symbol} size={22} x={1} y={1}/>}</g>
  </g>;
 })}</g>;
}
