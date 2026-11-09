"use client";
import {useState,useEffect,useMemo,useRef,useCallback} from "react";
import SpotMap from "./spot-map";
import SpotConnection from "./spot-connection";
import {draftVisits,draftIssues} from "../lib/operator/rally-draft";
import {CORRECTION_SOURCE,decodeCorrectionContext,staleCorrections,type CorrectionInput} from "../lib/operator/rally-corrections";
import {decodeRoadConnection,connectionMatchesSpot,type RoadConnection} from "../lib/route/road-connection";
import type {getDraftRepository} from "../lib/operator/draft-repository";
type Context=NonNullable<ReturnType<typeof decodeCorrectionContext>>;
type Point={lat:number;lon:number};
export default function CorrectionEditor({initial}:{initial:ReturnType<ReturnType<typeof getDraftRepository>["load"]>}){
 const [context,setContext]=useState<Context>(initial),[selectedId,setSelectedId]=useState(initial.draft!.start.id);
 const [proposal,setProposal]=useState<{connection:RoadConnection;point:Point;pickDistanceMeters:number}|null>(null),[baseline,setBaseline]=useState<RoadConnection|null>(null);
 const [lat,setLat]=useState(""),[lon,setLon]=useState(""),[dirty,setDirty]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState(""),[notice,setNotice]=useState("");
 const running=useRef(false),alive=useRef(true),request=useRef<AbortController|null>(null);
 const visits=context.draft?draftVisits(context.draft):[],ids=new Set(visits.map(v=>v.spot?.id));
 const spots=useMemo(()=>context.spots.filter(s=>context.draft&&draftVisits(context.draft).some(v=>v.spot?.id===s.id)),[context]);
 const selected=spots.find(s=>s.id===selectedId)??null,issues=context.draft?draftIssues(context.draft,context.spots):[];
 const stale=context.draft?staleCorrections(context.draft,context.spots,context.corrections):context.corrections.items;
 const saved=context.corrections.items.find(c=>c.spotId===selected?.id),validSaved=saved&&!stale.includes(saved)?saved:null;
 const visibleProposal=proposal&&connectionMatchesSpot(proposal.connection,selected)?proposal:null;
 const shown=visibleProposal?.connection??validSaved??(connectionMatchesSpot(baseline,selected)?baseline:null);
 useEffect(()=>{alive.current=true;return()=>{alive.current=false;request.current?.abort()}},[]);
 useEffect(()=>{if(!dirty)return;const protect=(e:BeforeUnloadEvent)=>e.preventDefault();window.addEventListener("beforeunload",protect);return()=>window.removeEventListener("beforeunload",protect)},[dirty]);
 useEffect(()=>{setProposal(null);setBaseline(null);setDirty(false);setError("");const s=context.spots.find(s=>s.id===selectedId),c=context.corrections.items.find(c=>c.spotId===selectedId);setLat(String(c?.point.lat??s?.position.lat??""));setLon(String(c?.point.lon??s?.position.lon??""))},[selectedId,context.draft?.revision,context.corrections.revision,context.spots]);
 const choose=useCallback((id:string)=>{if(!running.current){setSelectedId(id);setNotice("")}},[]);
 function input(value:Point){setLat(String(value.lat));setLon(String(value.lon));setProposal(null);setDirty(true);setNotice("")}
 async function operate(mode:"pick"|"save"|"auto"|"reload",point?:Point){
  if(running.current)return;
  const spot=selected,draft=context.draft;if(mode!=="reload"&&(!spot||!draft||issues.length))return;
  if(mode==="save"&&!visibleProposal)return;
  const actual=mode==="save"?visibleProposal!.point:point;
  const body:CorrectionInput|undefined=mode==="reload"?undefined:{expectedDraftRevision:draft!.revision,expectedCorrectionRevision:context.corrections.revision,spotId:spot!.id,spotRevision:spot!.revision,sourceHash:CORRECTION_SOURCE.snapshotSha256,mode:mode==="auto"?"auto":"manual",...(actual?{point:actual}:{})};
  const controller=new AbortController();request.current=controller;running.current=true;setBusy(true);setError("");setNotice("");
  const timer=window.setTimeout(()=>controller.abort(),15000);
  try{
   const response=await fetch("/api/operator/connections",{method:mode==="reload"?"GET":mode==="pick"?"POST":"PUT",headers:body?{"Content-Type":"application/json"}:undefined,body:body?JSON.stringify(body):undefined,cache:"no-store",signal:controller.signal});
   const value:unknown=await response.json();
   if(!response.ok)throw Error(value&&typeof value==="object"&&"error" in value&&typeof value.error==="string"?value.error:"処理結果を確認できません。");
   const next=decodeCorrectionContext(value);if(!next)throw Error("保存結果を確認できません。同じ内容で再試行してください。");
   if(!alive.current)return;
   if(mode==="pick"){
    const connection=value&&typeof value==="object"&&"connection" in value?decodeRoadConnection(value.connection):null;
    if(!connection||!connectionMatchesSpot(connection,spot)||next.draft?.revision!==draft!.revision||next.corrections.revision!==context.corrections.revision)throw Error("候補の版を確認できません。最新情報を読み直してください。");
    const gap=value&&typeof value==="object"&&"pickDistanceMeters" in value?value.pickDistanceMeters:null;if(typeof gap!=="number"||!Number.isFinite(gap)||gap<0)throw Error("候補との距離を確認できません。");setProposal({connection,point:actual!,pickDistanceMeters:gap});setDirty(true);setNotice("未保存の道路候補です。地図と距離を確認して保存してください。");
   }else{
    setContext(next);if(!next.draft||!draftVisits(next.draft).some(v=>v.spot?.id===selectedId))setSelectedId(next.draft?.start.id??"");setProposal(null);setDirty(false);setNotice(mode==="auto"?"自動候補に戻しました。":mode==="reload"?"最新の保存内容を読み込みました。":"到達点の補正を保存しました。");
   }
  }catch(cause){if(alive.current)setError(cause instanceof Error&&cause.name!=="AbortError"?cause.message:"結果を確認できません。入力は残っています。同じ内容で再試行できます。")}
  finally{window.clearTimeout(timer);running.current=false;request.current=null;if(alive.current)setBusy(false)}
 }
 const pick=(point:Point)=>{if(running.current||issues.length)return;input(point);void operate("pick",point)};
 return <div data-correction-editor data-correction-revision={context.corrections.revision} data-correction-dirty={dirty}>
  <p className="operator-scope"><span>現地未確認</span>地図で指定した位置の近くから歩行候補の道路を探します。施設から道路への点線は歩行経路ではありません。入口・障害物・通行/安全性を確認してください。</p>
  <p className="preview-version">下書きの版{context.draft?.revision??"なし"}・補正版{context.corrections.revision}。同じスポットを開始・終了に使う場合は共通の補正を使います。</p>
  {!context.draft&&<p role="alert">保存済みの下書きがありません。下書きへ戻って確認してください。</p>}
  {issues.length>0&&<div className="draft-review-needed" role="alert" data-correction-catalog-issue>台帳の変更・削除を下書きで確認し、再保存してください。</div>}
  <div className="correction-layout"><section className="preview-panel">
   <label className="correction-select">修正するスポット<select value={selectedId} disabled={busy} data-correction-spot onChange={e=>choose(e.target.value)}>{spots.map(s=><option key={s.id} value={s.id}>{visits.filter(v=>v.spot?.id===s.id).map(v=>v.label).join(" / ")}：{s.name}</option>)}</select></label>
   {selected&&<><p>施設の代表位置：{selected.position.lat.toFixed(6)}, {selected.position.lon.toFixed(6)}</p>
    {saved&&stale.includes(saved)&&<p role="alert" className="draft-review-needed" data-correction-stale>保存済みの補正は台帳・道路データの変更により再確認が必要です。新しい候補を保存するか、自動候補に戻してください。</p>}
    <p data-correction-mode>{visibleProposal?"手動補正の候補・未保存":validSaved?"手動補正・保存済み":"自動候補（未確認）"}</p>
    <form onSubmit={e=>{e.preventDefault();pick({lat:lat.trim()?Number(lat):NaN,lon:lon.trim()?Number(lon):NaN})}}><fieldset disabled={busy||issues.length>0}><div className="correction-coordinates">
     <label>候補位置の緯度<input required type="number" step="any" min="35.122" max="35.160" value={lat} data-correction-lat onChange={e=>{setLat(e.target.value);setProposal(null);setDirty(true)}}/></label>
     <label>候補位置の経度<input required type="number" step="any" min="139.604" max="139.642" value={lon} data-correction-lon onChange={e=>{setLon(e.target.value);setProposal(null);setDirty(true)}}/></label>
    </div><button type="submit" data-correction-find>この位置の道路候補を探す</button></fieldset></form>
    {visibleProposal&&<p data-correction-pick-gap>指定した位置から道路候補まで直線 {Math.round(visibleProposal.pickDistanceMeters)}m</p>}
    <SpotConnection spot={selected} override={visibleProposal?.connection??validSaved??undefined} onConnection={setBaseline}/>
    <div className="correction-actions"><button type="button" disabled={busy||!visibleProposal||issues.length>0} data-correction-save onClick={()=>void operate("save")}>{busy?"処理中…":error?"同じ補正を再試行":"この補正を保存"}</button><button type="button" disabled={busy||issues.length>0} data-correction-auto onClick={()=>void operate("auto")}>自動候補に戻す</button></div>
   </>}
   {error&&<p role="alert" className="spot-edit-error" data-correction-error>{error}</p>}
   {notice&&<p role="status" className="spot-save-notice" data-correction-notice>{notice}</p>}
   <button type="button" disabled={busy} data-correction-reload onClick={()=>void operate("reload")}>最新情報を読み直す（未保存を破棄）</button>
   <div className="preview-actions"><a href="/operator/draft">下書きへ戻る</a>{!dirty&&!busy?<a href="/operator/preview" data-correction-preview>保存した到達点で再生成</a>:<button type="button" disabled>保存してから再生成</button>}</div>
  </section><div className="correction-map"><SpotMap spots={spots} selectedId={selected?.id??null} onSelect={choose} onPosition={selected&&!busy&&!issues.length?pick:null} positionLabel="地図をクリックして道路の候補位置を指定" connection={shown}/><p className="preview-caption">スポットは選択欄で切り替えます。青い線と丸は表示中の道路候補です。地図クリックだけでは保存しません。</p></div></div>
 </div>;
}
