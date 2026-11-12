"use client";
import {useState} from "react";
import LandmarkIcon from "./landmark-icon";
import {layoutCandidates,type Candidate,type PhotoAsset} from "../lib/landmarks/model";
import type {KomaMap} from "../lib/route/koma";
import type {Point} from "../lib/route/types";
export type ReviewedLandmarks={center:Point;candidates:Candidate[];photos:Record<string,PhotoAsset>};
export function ReviewedLandmarkNotice({map,landmarks,factor=1}:{map:KomaMap;landmarks:ReviewedLandmarks;factor?:number}){
 const {unplaced}=layoutCandidates({map,center:landmarks.center},landmarks.candidates,map.branches,factor);
 return unplaced.length>0?<p className="preview-caption" data-course-unplaced>この図で配置できない採用目印：{unplaced.map(c=>c.label).join("・")}。重なりや表示範囲のため省いています。候補一覧と30m参照図を確認してください。</p>:null;
}
export default function ReviewedLandmarkLayer({map,landmarks,factor=1}:{map:KomaMap;landmarks:ReviewedLandmarks;factor?:number}){
 const [failed,setFailed]=useState<Record<string,boolean>>({});
 const {placed}=layoutCandidates({map,center:landmarks.center},landmarks.candidates,map.branches,factor);
 return <g data-course-landmarks>{placed.map(({candidate:c,x,y,anchor})=>{const photo=c.kind==="unique"?landmarks.photos[c.id.slice(10)]:undefined;return <g key={c.id} data-course-landmark={c.id}><title>{c.label}</title><circle cx={anchor.x} cy={anchor.y} r={2} fill="var(--accent)"/><path d={"M"+anchor.x+" "+anchor.y+"L"+(x+12)+" "+(y+12)} stroke="var(--muted)" strokeWidth=".7"/><g transform={"translate("+x+" "+y+")"}><rect width={24} height={24} rx={5} fill="var(--paper)" stroke="var(--brand)"/>{photo?.crop?failed[c.id]?<text x={12} y={17} textAnchor="middle" data-course-photo-error>?</text>:<image data-course-photo={photo.featureId} href={photo.crop.path} width={24} height={24} preserveAspectRatio="xMidYMid meet" onError={()=>setFailed(s=>({...s,[c.id]:true}))}/>:<LandmarkIcon symbol={c.symbol} size={22} x={1} y={1}/>}</g></g>})}</g>;
}
