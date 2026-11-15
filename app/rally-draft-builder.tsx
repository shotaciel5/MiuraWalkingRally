"use client";
import {useCallback,useEffect,useMemo,useRef,useState} from "react";
import {decodeCorrectionContext,emptyCorrections,staleCorrections,type RallyCorrections} from "../lib/operator/rally-corrections";
import SpotMap from "./spot-map";
import SpotSymbol from "./spot-symbol";
import SpotConnection from "./spot-connection";
import {connectionMatchesSpot,type RoadConnection} from "../lib/route/road-connection";
import {SPOT_CATEGORIES} from "../lib/spots/initial-catalog";
import {AREA_LABELS,DEFAULT_FILTERS,SPOT_GROUPS,ROUTING_LABELS,filterSpots,groupFor,type SpotFilters,type SpotGroup} from "../lib/spots/browser-view";
import type {ManagedSpot} from "../lib/spots/editing";
import {blankDraft,draftInput,draftIssues,draftSignature,refreshDraftSpots,type DraftForm,type RallyDraft,type StopKind} from "../lib/operator/rally-draft";

export default function RallyDraftBuilder({initial}:{initial:{draft:RallyDraft|null;spots:ManagedSpot[];corrections?:RallyCorrections}}){
 const [corrections,setCorrections]=useState(initial.corrections??emptyCorrections());
 const [connection,setConnection]=useState<RoadConnection|null>(null);
 const [spots,setSpots]=useState(initial.spots),[saved,setSaved]=useState(initial.draft),[form,setForm]=useState<DraftForm>(initial.draft??blankDraft);
 const [filters,setFilters]=useState<SpotFilters>(DEFAULT_FILTERS),[selectedId,setSelectedId]=useState<string|null>(null);
 const [feedback,setFeedback]=useState<{target:string|null;message:string}|null>(null),itinerary=useRef<HTMLDivElement>(null);
 const [busy,setBusy]=useState(false),[error,setError]=useState(""),[reason,setReason]=useState(""),[notice,setNotice]=useState("");
 const request=useRef<AbortController|null>(null),running=useRef(false),alive=useRef(true),list=useRef<HTMLUListElement>(null),choice=useRef<HTMLElement>(null);
 const visible=useMemo(()=>filterSpots(spots,filters),[spots,filters]),selected=visible.find(s=>s.id===selectedId)??null;
 const correctionProblems=staleCorrections(form,spots,corrections);
 const manual=corrections.items.find(c=>c.spotId===selected?.id&&!correctionProblems.includes(c));
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
 useEffect(()=>{
  if(!feedback?.target||!itinerary.current)return;
  const parent=itinerary.current,target=Array.from(parent.querySelectorAll<HTMLElement>("[data-draft-target]")).find(e=>e.dataset.draftTarget===feedback.target);
  if(!target)return;
  const p=parent.getBoundingClientRect(),t=target.getBoundingClientRect();
  if(parent.scrollHeight>parent.clientHeight+1){if(t.top<p.top+8)parent.scrollTop-=p.top+8-t.top;else if(t.bottom>p.bottom-8)parent.scrollTop+=t.bottom-p.bottom+8}
  else if(window.innerWidth<1100||window.innerHeight<650)target.scrollIntoView({block:"nearest",behavior:"instant"});
 },[feedback]);
 function announce(target:string|null,message:string){setFeedback({target,message})}
 const select=useCallback((id:string)=>{if(!busy)setSelectedId(id)},[busy]);
 function show(spot:ManagedSpot){if(!spots.some(s=>s.id===spot.id))return;setFilters(DEFAULT_FILTERS);setSelectedId(spot.id)}
 function assign(role:"start"|"finish"|StopKind){
  if(!selected||busy||(role==="checkpoint"||role==="waypoint")&&form.stops.some(s=>s.spot.id===selected.id))return;
  setError("");setNotice("");
  setForm(before=>role==="start"||role==="finish"?{...before,[role]:selected}:{...before,stops:[...before.stops,{kind:role,spot:selected}]});
  const label={start:"スタート",finish:"ゴール",checkpoint:"チェックポイント",waypoint:"経由地"}[role];
  announce(role==="start"||role==="finish"?role:"stop:"+selected.id,selected.name+"を"+label+"に"+(role==="start"||role==="finish"?"設定しました":"追加しました"));
 }
 function move(index:number,direction:number){
  const next=index+direction;if(next<0||next>=form.stops.length||busy)return;
  const stop=form.stops[index];
  setForm(before=>{const stops=[...before.stops];[stops[index],stops[next]]=[stops[next],stops[index]];return {...before,stops}});
  announce("stop:"+stop.spot.id,stop.spot.name+"を途中地点の"+(next+1)+"番目に移動しました");
 }
 function removeStop(index:number){
  const stop=form.stops[index];setForm(f=>({...f,stops:f.stops.filter((_,i)=>i!==index)}));
  announce(null,stop.spot.name+"を訪問順から外しました");
 }
 function changeKind(index:number,kind:StopKind){
  const stop=form.stops[index];setForm(f=>({...f,stops:f.stops.map((s,i)=>i===index?{...s,kind}:s)}));
  announce("stop:"+stop.spot.id,stop.spot.name+"を"+(kind==="checkpoint"?"チェックポイント":"経由地")+"に変更しました");
 }
 function assignments(id:string){
  return [...(form.start?.id===id?["スタート"]:[]),...form.stops.flatMap((s,i)=>s.spot.id===id?[(s.kind==="checkpoint"?"チェックポイント":"経由地")+" "+(i+1)]:[]),...(form.finish?.id===id?["ゴール"]:[])];
 }
 function place(spot:ManagedSpot){
  return <button type="button" className="draft-place-name" disabled={busy||!spots.some(s=>s.id===spot.id)} onClick={()=>show(spot)}><SpotSymbol category={spot.category}/><span>{spot.name}</span></button>;
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
   const result=decodeCorrectionContext(value);if(!result||mode==="save"&&!result.draft)throw Error("保存結果を確認できません。同じ内容で再試行してください。");
   if(!alive.current)return;
   setSpots(result.spots);setCorrections(result.corrections);
   if(mode==="catalog"){setForm(before=>refreshDraftSpots(before,result.spots));setNotice("台帳の最新情報を反映しました。内容を確認し、削除済みの地点は選び直して保存してください。")}
   else{setFeedback(null);setSaved(result.draft);setForm(result.draft??blankDraft());setReason("");setNotice(mode==="save"?"地点を保存しました。次は「ルートとコマをつくる」で道順を確認できます。":"保存済みの下書きを読み込みました。")}
  }catch(error){if(alive.current)setError(error instanceof Error&&error.name!=="AbortError"?error.message:"結果を確認できません。同じ内容で再試行できます。")}
  finally{window.clearTimeout(timer);request.current=null;running.current=false;if(alive.current)setBusy(false)}
 }
 const invalid=!form.title.trim()||!form.start||!form.finish||issues.length>0;
 const canGenerate=!!saved&&!dirty&&!invalid&&!busy&&!correctionProblems.length;
 const nextTitle=spots.length===0?"まずはスポットを登録しましょう":!form.start?"まずは、スタート地点を選びましょう":!form.finish?"次に、ゴール地点を選びましょう":!form.title.trim()?"コースに名前をつけましょう":issues.length?"変更された地点を確認しましょう":correctionProblems.length?"道路上の到達点を再確認しましょう":dirty||!saved?"選んだ地点を保存しましょう":"準備できました。ルートとコマをつくりましょう";
 function slot(key:"start"|"finish"){
  const spot=form[key],issue=issues.find(i=>i.key===key);
  return <div className={"draft-slot draft-visit"+(issue?" has-issue":"")} data-draft-slot={key} data-draft-target={key} data-draft-updated={feedback?.target===key}>
   <span className={"draft-visit-badge is-"+key} aria-hidden="true">{key==="start"?"S":"G"}</span>
   <div className="draft-visit-copy"><b>{key==="start"?"スタート":"ゴール"}</b>{spot?place(spot):<p>地図・一覧から設定</p>}{issue&&<p className="draft-issue">{issue.state==="missing"?"削除済みです。選び直してください。":"台帳で変更されています。現在："+issue.current!.name}</p>}</div>
   {spot&&<button type="button" className="draft-remove" disabled={busy} aria-label={(key==="start"?"開始":"終了")+"地点を外す"} onClick={()=>{setForm(f=>({...f,[key]:null}));announce(null,spot.name+"を"+(key==="start"?"スタート":"ゴール")+"から外しました")}}>×</button>}
  </div>;
 }
 const choicePanel=<section className="draft-choice" ref={choice} data-draft-choice={selected?.id??""}>
  {selected?<><div className="draft-picked-heading"><span className="draft-picked-icon"><SpotSymbol category={selected.category}/></span><div><small>地図・一覧で選択中</small><h2>{selected.name}</h2></div></div>
   <div className="draft-assign-actions">{(["start","finish","checkpoint","waypoint"] as const).map(role=>{
    const used=role==="start"||role==="finish"?form[role]?.id===selected.id:form.stops.some(s=>s.spot.id===selected.id&&s.kind===role);
    const middle=role==="checkpoint"||role==="waypoint",duplicate=middle&&form.stops.some(s=>s.spot.id===selected.id);
    return <button type="button" key={role} data-draft-assign={role} aria-pressed={used} className={used?"is-assigned":(!form.start?role==="start":!form.finish?role==="finish":role==="checkpoint")?"is-suggested":undefined} disabled={busy||duplicate} title={duplicate&&!used?"役割は右の訪問順で変更できます":undefined} onClick={()=>assign(role)}><span aria-hidden="true">{used?"✓":role==="start"?"S":role==="finish"?"G":"＋"}</span>{{start:"スタート",finish:"ゴール",checkpoint:"チェックポイント",waypoint:"経由地"}[role]}{used?<small>設定済み</small>:<small>{middle?"追加":"に設定"}</small>}</button>;
   })}</div>
   <details className="operator-secondary-details draft-spot-details" data-draft-road-details><summary>地点の情報・道路とのつながり</summary><p>{SPOT_CATEGORIES[selected.category]} · {AREA_LABELS[selected.area]}</p><p className="spot-routing-state">初期の確認記録：{ROUTING_LABELS[selected.routing.state]}</p><SpotConnection spot={selected} override={manual} onConnection={setConnection}/></details>
  </>:<p className="draft-choice-empty"><b>地図・一覧から場所を選択</b><span>ここでスタートやチェックポイントに指定できます。</span></p>}
 </section>;
 return <div className="operator-draft-dashboard draft-itinerary-dashboard" data-draft-builder data-draft-revision={saved?.revision??0} data-draft-dirty={dirty}>
  <section className="operator-next-action draft-next-step" data-draft-guidance aria-live="polite"><span>次の操作</span><h2>{nextTitle}</h2></section>
  <div className="draft-workspace">
   <section className="draft-candidates" aria-label="スポット候補"><div className="spot-list-heading"><h2>スポット候補</h2><span data-draft-count>{visible.length}件</span></div>
    <div className="draft-catalog-filters"><label>スポット名<input type="search" value={filters.query} disabled={busy} data-draft-search onChange={e=>setFilters(f=>({...f,query:e.target.value}))}/></label>
   <label>エリア<select value={filters.area} disabled={busy} data-draft-area onChange={e=>setFilters(f=>({...f,area:e.target.value as SpotFilters["area"]}))}><option value="all">すべて</option>{Object.entries(AREA_LABELS).map(([id,label])=><option key={id} value={id}>{label}</option>)}</select></label>
   <div className="draft-group-filters">{(["all",...Object.keys(SPOT_GROUPS)] as ("all"|SpotGroup)[]).map(group=><button type="button" key={group} disabled={busy} aria-pressed={filters.group===group} data-draft-group={group} onClick={()=>setFilters(f=>({...f,group}))}>{group==="all"?"すべて":SPOT_GROUPS[group].label}</button>)}</div>
  </div>
    {visible.length?<ul className="spot-result-list" ref={list}>{visible.map(spot=><li key={spot.id}><button type="button" data-draft-candidate={spot.id} aria-pressed={selected?.id===spot.id} className={selected?.id===spot.id?"is-selected":""} disabled={busy} onClick={()=>select(spot.id)}><span className="spot-list-glyph" style={{color:SPOT_GROUPS[groupFor(spot.category)].color}}><SpotSymbol category={spot.category}/></span><span className="spot-list-copy"><strong>{spot.name}</strong><small>{SPOT_CATEGORIES[spot.category]} · {AREA_LABELS[spot.area]}</small>{assignments(spot.id).length>0&&<span className="draft-candidate-assigned">✓ {assignments(spot.id).join(" / ")}</span>}</span></button></li>)}</ul>:<div className="spot-empty" data-draft-empty>{spots.length?<><p>条件に合う候補がありません。検索名・エリア・ジャンルを変えて探してください。</p><button type="button" disabled={busy} onClick={()=>setFilters(DEFAULT_FILTERS)} data-draft-reset>すべてのスポットを表示する</button></>:<><p>まだスポットが登録されていません。使いたい場所を追加して、コースづくりを始めましょう。</p><a className="operator-task-primary" href="/operator/spots">スポットを登録する →</a></>}</div>}
   </section>
   <div className="draft-map" id="draft-map-picker" tabIndex={-1}><SpotMap spots={visible} selectedId={selected?.id??null} onSelect={select} connection={connectionMatchesSpot(connection,selected)?connection:null}/>{choicePanel}</div>
   <section className="draft-configuration" aria-label="作業中の下書き">
    <form onSubmit={e=>{e.preventDefault();void operate("save")}}>
     <header className="draft-itinerary-header"><div className="draft-form-heading"><h2>コースの訪問順</h2><span className={dirty?"is-unsaved":""} data-draft-save-state>{dirty?"未保存":saved?"保存済み":"未保存"}</span></div><p>上から順に訪問 · ↑↓で並べ替え</p>
      <label className="draft-title">コース名<input required disabled={busy} maxLength={100} value={form.title} data-draft-title onChange={e=>setForm(f=>({...f,title:e.target.value}))} placeholder="例：三崎のまち歩き"/></label>
      <div className="draft-change-feedback" role="status" aria-live="polite" aria-atomic="true" data-draft-feedback data-feedback-target={feedback?.target??""}>{feedback?<><span aria-hidden="true">✓</span> {feedback.message}</>:<span className="draft-count-summary">チェックポイント {form.stops.filter(s=>s.kind==="checkpoint").length}件 · 経由地 {form.stops.filter(s=>s.kind==="waypoint").length}件</span>}</div>
     </header>
     <div className="draft-form-body" ref={itinerary}><fieldset disabled={busy}>
     {slot("start")}
     {form.stops.length?<ol className="draft-stops" aria-label="途中の訪問順">{form.stops.map((stop,index)=>{const issue=issues.find(i=>i.key==="stop-"+index);return <li key={stop.spot.id} data-draft-stop={stop.spot.id} data-draft-target={"stop:"+stop.spot.id} data-draft-updated={feedback?.target==="stop:"+stop.spot.id} className={"draft-visit"+(issue?" has-issue":"")}>
      <span className={"draft-visit-badge is-"+stop.kind} aria-hidden="true">{index+1}</span><div className="draft-visit-copy">{place(stop.spot)}
       <div className="draft-stop-controls"><select aria-label={stop.spot.name+"の役割"} value={stop.kind} data-draft-stop-kind={index} onChange={e=>changeKind(index,e.target.value as StopKind)}><option value="checkpoint">チェックポイント</option><option value="waypoint">経由地</option></select><div className="draft-move-actions"><button type="button" disabled={index===0} aria-label={stop.spot.name+"を上へ"} data-draft-up={index} onClick={()=>move(index,-1)}>↑ <span>前へ</span></button><button type="button" disabled={index===form.stops.length-1} aria-label={stop.spot.name+"を下へ"} data-draft-down={index} onClick={()=>move(index,1)}>↓ <span>次へ</span></button></div></div>
       {issue&&<p className="draft-issue">{issue.state==="missing"?"削除済みです。外すか選び直してください。":"台帳で変更されています。現在："+issue.current!.name}</p>}
      </div><button type="button" className="draft-remove" aria-label={stop.spot.name+"を外す"} data-draft-remove-stop={index} onClick={()=>removeStop(index)}>×</button>
     </li>})}</ol>:<div className="draft-empty-stops"><span aria-hidden="true">＋</span><p>立ち寄りたい場所を追加</p><small>チェックポイント：写真を撮る場所<br/>経由地：通る場所</small></div>}
     {slot("finish")}
    </fieldset>
    {issues.length>0&&<div className="draft-review-needed" role="status" data-draft-issues>{issues.length}件の地点情報を確認してください。削除済みの地点は選び直しが必要です。</div>}
    {correctionProblems.length>0&&<p className="draft-review-needed" data-draft-correction-stale>到達点の補正{correctionProblems.length}件に再確認が必要です。地点の変更を保存した後、「道路上の到達点」で確認してください。</p>}
    <details className="operator-secondary-details" data-draft-management open={correctionProblems.length>0||issues.length>0||reason==="draft-conflict"||reason==="catalog-conflict"}>
     <summary>使い方・道路の調整</summary>
     <p>スタートとゴールは同じ場所にできます。地点名を押すと、設定用のボタンを地図の下に表示します。チェックポイントは写真を撮る場所、経由地は通る場所です。訪問順はこの並びを使います。入口・通行・現地安全性は確認待ちです。</p>
     <p className="operator-action-hint">道路上の到達点が違う場合や、他の画面で編集した内容を読み直したいときに使います。</p>
     {saved&&!dirty&&!busy&&<a className="preview-generate operator-task-secondary" href="/operator/connections" data-draft-corrections>道路上の到達点を確認・修正（保存{corrections.items.length}件）</a>}
     <div className="draft-save-actions"><button type="button" disabled={busy} data-draft-refresh onClick={()=>void operate("catalog")}>スポットの最新情報を反映</button><button type="button" disabled={busy} data-draft-reload onClick={()=>void operate("reload")}>保存内容を読み直す（未保存を破棄）</button></div>
    </details>

    </div>
    {error&&<div className="spot-edit-error" role="alert" data-draft-error>{error}</div>}
    {notice&&<p className="spot-save-notice" role="status" data-draft-notice>{notice}</p>}
    <div className="draft-save-actions operator-draft-primary-actions" id="draft-next-action">
     <button type="submit" className={canGenerate?"operator-task-secondary":"rally-primary-link"} disabled={busy||invalid||reason==="draft-conflict"} data-draft-save>{busy?"保存しています…":error?"同じ内容で再試行":"地点を保存する"}</button>
     {canGenerate?<a className="preview-generate operator-task-primary" href="/operator/preview" data-preview-generate>ルートとコマをつくる →</a>:<button type="button" className="preview-generate operator-task-secondary" disabled data-preview-generate>{correctionProblems.length?"到達点を再確認すると生成できます":"地点を保存すると生成できます"}</button>}
    </div>
    </form>
   </section>

  </div>
 </div>;
}
