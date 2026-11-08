"use client";
import {useCallback,useEffect,useMemo,useRef,useState} from "react";
import SpotMap from "./spot-map";
import SpotConnection from "./spot-connection";
import {connectionMatchesSpot,type RoadConnection} from "../lib/route/road-connection";
import {SPOT_CATEGORIES} from "../lib/spots/initial-catalog";
import {AREA_LABELS,DEFAULT_FILTERS,SPOT_GROUPS,ROUTING_LABELS,filterSpots,groupFor,type SpotFilters,type SpotGroup} from "../lib/spots/browser-view";
import type {ManagedSpot} from "../lib/spots/editing";
import {blankDraft,decodeDraftContext,draftInput,draftIssues,draftSignature,refreshDraftSpots,type DraftForm,type RallyDraft,type StopKind} from "../lib/operator/rally-draft";

export default function RallyDraftBuilder({initial}:{initial:{draft:RallyDraft|null;spots:ManagedSpot[]}}){
 const [connection,setConnection]=useState<RoadConnection|null>(null);
 const [spots,setSpots]=useState(initial.spots),[saved,setSaved]=useState(initial.draft),[form,setForm]=useState<DraftForm>(initial.draft??blankDraft);
 const [filters,setFilters]=useState<SpotFilters>(DEFAULT_FILTERS),[selectedId,setSelectedId]=useState<string|null>(null);
 const [busy,setBusy]=useState(false),[error,setError]=useState(""),[reason,setReason]=useState(""),[notice,setNotice]=useState("");
 const request=useRef<AbortController|null>(null),running=useRef(false),alive=useRef(true),list=useRef<HTMLUListElement>(null),choice=useRef<HTMLElement>(null);
 const visible=useMemo(()=>filterSpots(spots,filters),[spots,filters]),selected=visible.find(s=>s.id===selectedId)??null;
 const issues=draftIssues(form,spots),dirty=draftSignature(form)!==draftSignature(saved??blankDraft());
 useEffect(()=>{alive.current=true;return()=>{alive.current=false;request.current?.abort()}},[]);
 useEffect(()=>{if(!dirty)return;const prevent=(e:BeforeUnloadEvent)=>e.preventDefault();window.addEventListener("beforeunload",prevent);return()=>window.removeEventListener("beforeunload",prevent)},[dirty]);
 useEffect(()=>{if(selectedId&&!visible.some(s=>s.id===selectedId))setSelectedId(null)},[visible,selectedId]);
 useEffect(()=>{
  if(!selected)return;
  const parent=list.current,button=parent?.querySelector<HTMLElement>('[data-draft-candidate="'+selected.id+'"]');
  if(parent&&button){const p=parent.getBoundingClientRect(),b=button.getBoundingClientRect();if(b.top<p.top)parent.scrollTop-=p.top-b.top;else if(b.bottom>p.bottom)parent.scrollTop+=b.bottom-p.bottom}
  if(window.innerWidth<900)choice.current?.scrollIntoView({block:"nearest"});
 },[selected?.id]);
 const select=useCallback((id:string)=>{if(!busy)setSelectedId(id)},[busy]);
 function show(spot:ManagedSpot){if(!spots.some(s=>s.id===spot.id))return;setFilters({...DEFAULT_FILTERS,mode:"all"});setSelectedId(spot.id)}
 function assign(role:"start"|"finish"|StopKind){
  if(!selected||busy)return;
  setError("");setNotice("");
  setForm(before=>role==="start"||role==="finish"?{...before,[role]:selected}:before.stops.some(s=>s.spot.id===selected.id)?before:{...before,stops:[...before.stops,{kind:role,spot:selected}]});
 }
 function move(index:number,direction:number){
  setForm(before=>{const stops=[...before.stops],next=index+direction;if(next<0||next>=stops.length)return before;[stops[index],stops[next]]=[stops[next],stops[index]];return {...before,stops}});
 }
 async function operate(mode:"save"|"catalog"|"reload"){
  if(running.current)return;
  let body:string|undefined;
  if(mode==="save"){try{body=JSON.stringify(draftInput(form,saved?.revision??0))}catch(error){setError(error instanceof Error?error.message:"入力を確認してください。");return}}
  running.current=true;setBusy(true);setError("");setNotice("");
  const controller=new AbortController();request.current=controller;const timer=window.setTimeout(()=>controller.abort(),15000);
  try{
   const response=await fetch("/api/operator/draft",{method:mode==="save"?"PUT":"GET",headers:mode==="save"?{"Content-Type":"application/json"}:undefined,body,cache:"no-store",signal:controller.signal});
   const value:unknown=await response.json();
   if(!response.ok){
    if(alive.current&&value&&typeof value==="object"&&"reason" in value&&typeof value.reason==="string")setReason(value.reason);
    throw Error(value&&typeof value==="object"&&"error" in value&&typeof value.error==="string"?value.error:"保存先を利用できません。");
   }
   const result=decodeDraftContext(value);if(!result||mode==="save"&&!result.draft)throw Error("保存結果を確認できません。同じ内容で再試行してください。");
   if(!alive.current)return;
   setSpots(result.spots);
   if(mode==="catalog"){setForm(before=>refreshDraftSpots(before,result.spots));setNotice("台帳の最新情報を反映しました。内容を確認し、削除済みの地点は選び直して保存してください。")}
   else{setSaved(result.draft);setForm(result.draft??blankDraft());setReason("");setNotice(mode==="save"?"下書きを保存しました。":"保存済みの下書きを読み込みました。")}
  }catch(error){if(alive.current)setError(error instanceof Error&&error.name!=="AbortError"?error.message:"結果を確認できません。同じ内容で再試行できます。")}
  finally{window.clearTimeout(timer);request.current=null;running.current=false;if(alive.current)setBusy(false)}
 }
 const invalid=!form.title.trim()||!form.start||!form.finish||issues.length>0;
 function slot(key:"start"|"finish"){
  const spot=form[key],issue=issues.find(i=>i.key===key);
  return <div className={"draft-slot"+(issue?" has-issue":"")} data-draft-slot={key}><div><b>{key==="start"?"S 開始":"G 終了"}</b>{spot?<><button type="button" disabled={busy||!spots.some(s=>s.id===spot.id)} onClick={()=>show(spot)}>{spot.name}</button><small>{spot.position.lat.toFixed(6)}, {spot.position.lon.toFixed(6)}</small></>:<p>地図・一覧から選択してください</p>}{issue&&<p className="draft-issue">{issue.state==="missing"?"削除済み・利用できない地点です。選び直してください。":"台帳で変更されています。現在："+issue.current!.name}</p>}</div>{spot&&<button type="button" className="draft-remove" disabled={busy} aria-label={(key==="start"?"開始":"終了")+"地点を外す"} onClick={()=>setForm(f=>({...f,[key]:null}))}>外す</button>}</div>;
 }
 return <div data-draft-builder data-draft-revision={saved?.revision??0} data-draft-dirty={dirty}>
  <div className="draft-catalog-filters"><label>スポット名<input type="search" value={filters.query} disabled={busy} data-draft-search onChange={e=>setFilters(f=>({...f,query:e.target.value}))}/></label>
   <label>エリア<select value={filters.area} disabled={busy} data-draft-area onChange={e=>setFilters(f=>({...f,area:e.target.value as SpotFilters["area"]}))}><option value="all">すべて</option>{Object.entries(AREA_LABELS).map(([id,label])=><option key={id} value={id}>{label}</option>)}</select></label>
   <div className="draft-display-modes">{(["demo","all"] as const).map(mode=><button type="button" key={mode} disabled={busy} aria-pressed={filters.mode===mode} data-draft-mode={mode} onClick={()=>setFilters(f=>({...f,mode}))}>{mode==="demo"?"デモ表示":"全候補"} {filterSpots(spots,{...DEFAULT_FILTERS,mode}).length}</button>)}</div>
   <div className="draft-group-filters">{(["all",...Object.keys(SPOT_GROUPS)] as ("all"|SpotGroup)[]).map(group=><button type="button" key={group} disabled={busy} aria-pressed={filters.group===group} data-draft-group={group} onClick={()=>setFilters(f=>({...f,group}))}>{group==="all"?"すべて":SPOT_GROUPS[group].label}</button>)}</div>
  </div>
  <div className="draft-workspace">
   <div className="draft-map"><SpotMap spots={visible} selectedId={selected?.id??null} onSelect={select} connection={connectionMatchesSpot(connection,selected)?connection:null}/></div>
   <section className="draft-configuration" aria-label="作業中の下書き">
    <section className="draft-choice" ref={choice} data-draft-choice={selected?.id??""}><p className="eyebrow">選択中のスポット</p>{selected?<><h2>{selected.name}</h2><p>{SPOT_CATEGORIES[selected.category]} · {AREA_LABELS[selected.area]}</p><p className="spot-routing-state">既存PoC基準：{ROUTING_LABELS[selected.routing.state]}</p><div className="draft-assign-actions">{(["start","finish","checkpoint","waypoint"] as const).map(role=><button type="button" key={role} data-draft-assign={role} disabled={busy||(role==="checkpoint"||role==="waypoint")&&form.stops.some(s=>s.spot.id===selected.id)} onClick={()=>assign(role)}>{{start:"開始にする",finish:"終了にする",checkpoint:"チェックポイントに追加",waypoint:"経由地に追加"}[role]}</button>)}</div><SpotConnection spot={selected} onConnection={setConnection}/></>:<p>地図のピンや一覧から、割り当てる地点を選びます。</p>}</section>
    <form onSubmit={e=>{e.preventDefault();void operate("save")}}><fieldset disabled={busy}>
     <div className="draft-form-heading"><h2>作業中の下書き</h2><span>{dirty?"未保存の変更あり":saved?"保存済み":"未保存"}</span></div>
     <label className="draft-title">下書き名<input required maxLength={100} value={form.title} data-draft-title onChange={e=>setForm(f=>({...f,title:e.target.value}))} placeholder="例：三崎のまち歩き"/></label>
     {slot("start")}<div className="draft-stops-heading"><h3>途中の地点</h3><small>この並びで訪問・上下ボタンで変更</small></div>
     {form.stops.length?<ol className="draft-stops">{form.stops.map((stop,index)=>{const issue=issues.find(i=>i.key==="stop-"+index);return <li key={stop.spot.id} data-draft-stop={stop.spot.id} className={issue?"has-issue":""}><div className="draft-stop-top"><span>{index+1}</span><button type="button" disabled={!spots.some(s=>s.id===stop.spot.id)} onClick={()=>show(stop.spot)}>{stop.spot.name}</button><button type="button" className="draft-remove" aria-label={stop.spot.name+"を外す"} data-draft-remove-stop={index} onClick={()=>setForm(f=>({...f,stops:f.stops.filter((_,i)=>i!==index)}))}>外す</button></div><div className="draft-stop-controls"><select aria-label={stop.spot.name+"の役割"} value={stop.kind} data-draft-stop-kind={index} onChange={e=>setForm(f=>({...f,stops:f.stops.map((s,i)=>i===index?{...s,kind:e.target.value as StopKind}:s)}))}><option value="checkpoint">チェックポイント</option><option value="waypoint">経由地</option></select><button type="button" disabled={index===0} aria-label={stop.spot.name+"を上へ"} data-draft-up={index} onClick={()=>move(index,-1)}>↑</button><button type="button" disabled={index===form.stops.length-1} aria-label={stop.spot.name+"を下へ"} data-draft-down={index} onClick={()=>move(index,1)}>↓</button></div>{issue&&<p className="draft-issue">{issue.state==="missing"?"削除済みです。外すか別の地点を選んでください。":"台帳で変更されています。現在："+issue.current!.name}</p>}</li>})}</ol>:<p className="draft-empty-stops">地点を選び、チェックポイントや経由地として追加できます。</p>}
     {slot("finish")}
     <p className="draft-scope-note">開始と終了は同じ地点を使えます。途中地点は任意です。訪問順はこの並びを使い、地点間の道順を自動生成する予定です。入口・道路への接続・通行の確認は保存後も必要です。</p>
    </fieldset>
    {issues.length>0&&<div className="draft-review-needed" role="status" data-draft-issues>{issues.length}件の地点情報を確認してください。削除済みの地点は選び直しが必要です。</div>}
    {error&&<div className="spot-edit-error" role="alert" data-draft-error>{error}</div>}
    {notice&&<p className="spot-save-notice" role="status" data-draft-notice>{notice}</p>}
    <div className="draft-save-actions"><button type="submit" className="rally-primary-link" disabled={busy||invalid||reason==="draft-conflict"} data-draft-save>{busy?"処理中…":error?"同じ内容で再試行":"下書きを保存"}</button><button type="button" disabled={busy} data-draft-refresh onClick={()=>void operate("catalog")}>台帳の最新情報を反映</button><button type="button" disabled={busy} data-draft-reload onClick={()=>void operate("reload")}>保存済みを読み直す（未保存を破棄）</button></div>
    {saved&&<p className="draft-saved-time">保存日時：<time dateTime={saved.updatedAt}>{new Date(saved.updatedAt).toLocaleString("ja-JP",{timeZone:"Asia/Tokyo"})}</time></p>}
    <p className="draft-scope-note">作業中の下書きは1件です。ページを移動する前に保存してください。ルート・コマ地図の生成は準備中です。</p>
    </form>
   </section>
   <section className="draft-candidates" aria-label="スポット候補"><div className="spot-list-heading"><h2>スポット候補</h2><span data-draft-count>{visible.length}件</span></div>
    {visible.length?<ul className="spot-result-list" ref={list}>{visible.map(spot=><li key={spot.id}><button type="button" data-draft-candidate={spot.id} aria-pressed={selected?.id===spot.id} className={selected?.id===spot.id?"is-selected":""} disabled={busy} onClick={()=>select(spot.id)}><span className="spot-list-glyph" style={{color:SPOT_GROUPS[groupFor(spot.category)].color}}>{SPOT_GROUPS[groupFor(spot.category)].glyph}</span><span className="spot-list-copy"><strong>{spot.name}</strong><small>{SPOT_CATEGORIES[spot.category]} · {AREA_LABELS[spot.area]}</small><span className="spot-list-state">既存PoC：{ROUTING_LABELS[spot.routing.state]}</span></span></button></li>)}</ul>:<p className="spot-empty" data-draft-empty>条件に合う候補がありません。全候補や別の条件で探してください。</p>}
   </section>
  </div>
 </div>;
}
