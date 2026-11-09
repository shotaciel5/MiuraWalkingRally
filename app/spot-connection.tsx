"use client";
import {useEffect,useState} from "react";
import type {ManagedSpot} from "../lib/spots/editing";
import {connectionMatchesSpot,decodeRoadConnection,type RoadConnection} from "../lib/route/road-connection";
export default function SpotConnection({spot,onConnection,override}:{spot:ManagedSpot;override?:RoadConnection|null;onConnection:(value:RoadConnection|null)=>void}){
 const [attempt,setAttempt]=useState(0),[result,setResult]=useState<{key:string;state:string;connection:RoadConnection|null}>({key:"",state:"loading",connection:null});
 const key=[spot.id,spot.revision,spot.position.lat,spot.position.lon].join("/")+"/"+JSON.stringify(override??null);
 useEffect(()=>{
  if(override&&connectionMatchesSpot(override,spot)){setResult({key,state:"ready",connection:override});onConnection(override);return}
  let active=true;const controller=new AbortController(),timer=window.setTimeout(()=>controller.abort(),15000);
  setResult({key,state:"loading",connection:null});onConnection(null);
  void (async()=>{
   try{
    const response=await fetch("/api/operator/spots/connection?id="+encodeURIComponent(spot.id),{cache:"no-store",signal:controller.signal});
    const body:unknown=await response.json();
    if(!response.ok||!body||typeof body!=="object"||!("connection" in body))throw Error();
    const value=body.connection===null?null:decodeRoadConnection(body.connection);
    if(body.connection!==null&&(!value||!connectionMatchesSpot(value,spot)))throw Error();
    if(active){setResult({key,state:value?"ready":"empty",connection:value});onConnection(value)}
   }catch{if(active){setResult({key,state:"error",connection:null});onConnection(null)}}
   finally{window.clearTimeout(timer)}
  })();
  return()=>{active=false;window.clearTimeout(timer);controller.abort()};
 },[key,attempt,onConnection,spot.id,spot.revision,spot.position.lat,spot.position.lon]);
 const state=result.key===key?result.state:"loading",value=state==="ready"?result.connection:null;
 return <section className="spot-connection" aria-label="道路への接続候補" data-road-connection={state} data-road-spot={spot.id}>
  <h3>{override?"この下書きの道路上の到達点（手動補正）":"近くの道路を自動で探す"}</h3>
  {state==="loading"&&<p role="status">道路上の候補を計算しています…</p>}
  {state==="error"&&<><p role="status">候補を読み込めませんでした。台帳が変更されている場合は、最新情報を読み込んでください。</p><button type="button" data-road-retry onClick={()=>setAttempt(v=>v+1)}>候補を再試行</button></>}
  {state==="empty"&&<p>対象範囲の道路から候補を見つけられませんでした。</p>}
  {value&&<><p className="spot-connection-name" data-road-name>{value.segment.name||"名称のない道路"} <span>／ 接続候補・未確認</span></p>
   <p>施設位置から直線で <strong data-road-distance>{Math.round(value.distanceMeters)} m</strong></p>
   <p className="spot-detail-note">青い線は道路、丸は道路上の候補点です。点線は位置関係を示し、歩ける経路を表しません。入口・障害物・立入り条件は確認が必要です。</p>
   <details><summary>候補の出典と位置</summary><p>候補点：{value.point.lat.toFixed(6)}, {value.point.lon.toFixed(6)}</p><p>道路データ：{new Date(value.osmBaseTimestamp).toLocaleDateString("ja-JP",{timeZone:"Asia/Tokyo"})}時点</p><a href={"https://www.openstreetmap.org/way/"+value.segment.wayId} target="_blank" rel="noopener noreferrer">OSMの道路を見る</a></details>
  </>}
 </section>;
}
