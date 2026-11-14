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
 const select=useCallback((id:string)=>{if(!busy)setSelectedId(id)},[busy]);
 function show(spot:ManagedSpot){if(!spots.some(s=>s.id===spot.id))return;setFilters(DEFAULT_FILTERS);setSelectedId(spot.id)}
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
   const result=decodeCorrectionContext(value);if(!result||mode==="save"&&!result.draft)throw Error("保存結果を確認できません。同じ内容で再試行してください。");
   if(!alive.current)return;
   setSpots(result.spots);setCorrections(result.corrections);
   if(mode==="catalog"){setForm(before=>refreshDraftSpots(before,result.spots));setNotice("台帳の最新情報を反映しました。内容を確認し、削除済みの地点は選び直して保存してください。")}
   else{setSaved(result.draft);setForm(result.draft??blankDraft());setReason("");setNotice(mode==="save"?"地点を保存しました。次は「ルートとコマをつくる」で道順を確認できます。":"保存済みの下書きを読み込みました。")}
  }catch(error){if(alive.current)setError(error instanceof Error&&error.name!=="AbortError"?error.message:"結果を確認できません。同じ内容で再試行できます。")}
  finally{window.clearTimeout(timer);request.current=null;running.current=false;if(alive.current)setBusy(false)}
 }
 const invalid=!form.title.trim()||!form.start||!form.finish||issues.length>0;
 const canGenerate=!!saved&&!dirty&&!invalid&&!busy&&!correctionProblems.length;
 const nextTitle=spots.length===0?"まずはスポットを登録しましょう":!form.start?"まずは、スタート地点を選びましょう":!form.finish?"次に、ゴール地点を選びましょう":!form.title.trim()?"コースに名前をつけましょう":issues.length?"変更された地点を確認しましょう":correctionProblems.length?"道路上の到達点を再確認しましょう":dirty||!saved?"選んだ地点を保存しましょう":"準備できました。ルートとコマをつくりましょう";
 function slot(key:"start"|"finish"){
  const spot=form[key],issue=issues.find(i=>i.key===key);
  return <div className={"draft-slot"+(issue?" has-issue":"")} data-draft-slot={key}><div><b>{key==="start"?"S スタート":"G ゴール"}</b>{spot?<><button type="button" disabled={busy||!spots.some(s=>s.id===spot.id)} onClick={()=>show(spot)}>{spot.name}</button><details className="operator-inline-details"><summary>位置情報</summary><small>{spot.position.lat.toFixed(6)}, {spot.position.lon.toFixed(6)}</small></details></>:<p>地図・一覧から選択してください</p>}{issue&&<p className="draft-issue">{issue.state==="missing"?"削除済み・利用できない地点です。選び直してください。":"台帳で変更されています。現在："+issue.current!.name}</p>}</div>{spot&&<button type="button" className="draft-remove" disabled={busy} aria-label={(key==="start"?"開始":"終了")+"地点を外す"} onClick={()=>setForm(f=>({...f,[key]:null}))}>外す</button>}</div>;
 }
 return <div className="operator-draft-dashboard" data-draft-builder data-draft-revision={saved?.revision??0} data-draft-dirty={dirty}>
  <section className="operator-next-action" data-draft-guidance aria-live="polite"><div><p className="eyebrow">NEXT ACTION</p><h2>{nextTitle}</h2><p>{spots.length===0?"選べるスポットがありません。「スポットを追加・編集」から使いたい場所を登録してください。":!form.start||!form.finish?"地図のピンか一覧を押して、表示される役割ボタンで使い方を決めます。スタートとゴールは同じ場所でも構いません。":!form.title.trim()?"コース名を入力してください。立ち寄り先は、必要に応じてチェックポイントや経由地へ追加できます。":issues.length?"地点の変更・削除を確認し、現在の情報を反映して保存してください。":correctionProblems.length?"下の「道路の調整・保存内容の管理」から、補正した到達点を再確認してください。":dirty||!saved?"下の「地点を保存する」を押すと、ルートとコマをつくる操作へ進めます。":"下の「ルートとコマをつくる」から、道順とコマの表示を確認できます。"}</p></div><ul className="operator-draft-checks">{[[!!form.start,"スタート"],[!!form.finish,"ゴール"],[!!form.title.trim(),"コース名"],[!!saved&&!dirty,"地点の保存"]].map(([done,label])=><li key={String(label)} className={done?"is-done":undefined}><span aria-hidden="true">{done?"✓":"○"}</span>{label}</li>)}</ul></section>
  <div className="draft-workspace">
   <section className="draft-candidates" aria-label="スポット候補"><div className="spot-list-heading"><h2>スポット候補</h2><span data-draft-count>{visible.length}件</span></div>
    <div className="draft-catalog-filters"><label>スポット名<input type="search" value={filters.query} disabled={busy} data-draft-search onChange={e=>setFilters(f=>({...f,query:e.target.value}))}/></label>
   <label>エリア<select value={filters.area} disabled={busy} data-draft-area onChange={e=>setFilters(f=>({...f,area:e.target.value as SpotFilters["area"]}))}><option value="all">すべて</option>{Object.entries(AREA_LABELS).map(([id,label])=><option key={id} value={id}>{label}</option>)}</select></label>
   <div className="draft-group-filters">{(["all",...Object.keys(SPOT_GROUPS)] as ("all"|SpotGroup)[]).map(group=><button type="button" key={group} disabled={busy} aria-pressed={filters.group===group} data-draft-group={group} onClick={()=>setFilters(f=>({...f,group}))}>{group==="all"?"すべて":SPOT_GROUPS[group].label}</button>)}</div>
  </div>
    {visible.length?<ul className="spot-result-list" ref={list}>{visible.map(spot=><li key={spot.id}><button type="button" data-draft-candidate={spot.id} aria-pressed={selected?.id===spot.id} className={selected?.id===spot.id?"is-selected":""} disabled={busy} onClick={()=>select(spot.id)}><span className="spot-list-glyph" style={{color:SPOT_GROUPS[groupFor(spot.category)].color}}><SpotSymbol category={spot.category}/></span><span className="spot-list-copy"><strong>{spot.name}</strong><small>{SPOT_CATEGORIES[spot.category]} · {AREA_LABELS[spot.area]}</small><span className="spot-list-state">初期の確認記録：{ROUTING_LABELS[spot.routing.state]}</span></span></button></li>)}</ul>:<div className="spot-empty" data-draft-empty>{spots.length?<><p>条件に合う候補がありません。検索名・エリア・ジャンルを変えて探してください。</p><button type="button" disabled={busy} onClick={()=>setFilters(DEFAULT_FILTERS)} data-draft-reset>すべてのスポットを表示する</button></>:<><p>まだスポットが登録されていません。使いたい場所を追加して、コースづくりを始めましょう。</p><a className="operator-task-primary" href="/operator/spots">スポットを登録する →</a></>}</div>}
   </section>
   <div className="draft-map" id="draft-map-picker" tabIndex={-1}><SpotMap spots={visible} selectedId={selected?.id??null} onSelect={select} connection={connectionMatchesSpot(connection,selected)?connection:null}/></div>
   <section className="draft-configuration" aria-label="作業中の下書き">
    <section className="draft-choice" ref={choice} data-draft-choice={selected?.id??""}><p className="eyebrow">選択中のスポット</p>{selected?<><h2>{selected.name}</h2><p>{SPOT_CATEGORIES[selected.category]} · {AREA_LABELS[selected.area]}</p><p className="operator-action-hint">この地点を、どこに使いますか？</p><div className="draft-assign-actions">{(["start","finish","checkpoint","waypoint"] as const).map(role=><button type="button" key={role} data-draft-assign={role} className={(!form.start?role==="start":!form.finish?role==="finish":role==="checkpoint")?"is-suggested":undefined} disabled={busy||(role==="checkpoint"||role==="waypoint")&&form.stops.some(s=>s.spot.id===selected.id)} onClick={()=>assign(role)}>{{start:"スタートにする",finish:"ゴールにする",checkpoint:"チェックポイントに追加",waypoint:"経由地に追加"}[role]}</button>)}</div><p className="operator-role-help">チェックポイントは写真を撮る場所。経由地は通るだけの場所です。</p><details className="operator-secondary-details" data-draft-road-details><summary>道路とのつながりを詳しく確認</summary><p className="spot-routing-state">初期の確認記録：{ROUTING_LABELS[selected.routing.state]}</p><SpotConnection spot={selected} override={manual} onConnection={setConnection}/></details></>:<p>まず地図のピンか一覧を押してください。ここに地点名と「スタートにする」などのボタンが表示されます。</p>}</section>
    <form onSubmit={e=>{e.preventDefault();void operate("save")}}><div className="draft-form-body"><fieldset disabled={busy}>
     <div className="draft-form-heading"><h2>選んだ地点と訪問順</h2><span>{dirty?"未保存の変更あり":saved?"保存済み":"未保存"}</span></div>
     <label className="draft-title">コース名<input required maxLength={100} value={form.title} data-draft-title onChange={e=>setForm(f=>({...f,title:e.target.value}))} placeholder="例：三崎のまち歩き"/></label>
     {slot("start")}<div className="draft-stops-heading"><h3>途中の地点</h3><small>この並びで訪問・上下ボタンで変更</small></div>
     {form.stops.length?<ol className="draft-stops">{form.stops.map((stop,index)=>{const issue=issues.find(i=>i.key==="stop-"+index);return <li key={stop.spot.id} data-draft-stop={stop.spot.id} className={issue?"has-issue":""}><div className="draft-stop-top"><span>{index+1}</span><button type="button" disabled={!spots.some(s=>s.id===stop.spot.id)} onClick={()=>show(stop.spot)}>{stop.spot.name}</button><button type="button" className="draft-remove" aria-label={stop.spot.name+"を外す"} data-draft-remove-stop={index} onClick={()=>setForm(f=>({...f,stops:f.stops.filter((_,i)=>i!==index)}))}>外す</button></div><div className="draft-stop-controls"><select aria-label={stop.spot.name+"の役割"} value={stop.kind} data-draft-stop-kind={index} onChange={e=>setForm(f=>({...f,stops:f.stops.map((s,i)=>i===index?{...s,kind:e.target.value as StopKind}:s)}))}><option value="checkpoint">チェックポイント</option><option value="waypoint">経由地</option></select><button type="button" disabled={index===0} aria-label={stop.spot.name+"を上へ"} data-draft-up={index} onClick={()=>move(index,-1)}>↑</button><button type="button" disabled={index===form.stops.length-1} aria-label={stop.spot.name+"を下へ"} data-draft-down={index} onClick={()=>move(index,1)}>↓</button></div>{issue&&<p className="draft-issue">{issue.state==="missing"?"削除済みです。外すか別の地点を選んでください。":"台帳で変更されています。現在："+issue.current!.name}</p>}</li>})}</ol>:<p className="draft-empty-stops">地点を選び、チェックポイントや経由地として追加できます。</p>}
     {slot("finish")}
     <p className="draft-scope-note">開始と終了は同じ地点を使えます。途中地点は任意です。訪問順はこの並びを使い、保存後に地点間の道順を自動生成できます。入口・道路への接続・通行の確認は保存後も必要です。</p>
    </fieldset>
    {issues.length>0&&<div className="draft-review-needed" role="status" data-draft-issues>{issues.length}件の地点情報を確認してください。削除済みの地点は選び直しが必要です。</div>}
    {correctionProblems.length>0&&<p className="draft-review-needed" data-draft-correction-stale>到達点の補正{correctionProblems.length}件に再確認が必要です。地点の変更を保存した後、「道路上の到達点」で確認してください。</p>}
    {saved&&<p className="draft-saved-time">保存日時：<time dateTime={saved.updatedAt}>{new Date(saved.updatedAt).toLocaleString("ja-JP",{timeZone:"Asia/Tokyo"})}</time></p>}
    <details className="operator-secondary-details" data-draft-management open={correctionProblems.length>0||issues.length>0||reason==="draft-conflict"||reason==="catalog-conflict"}>
     <summary>道路の調整・保存内容の管理</summary>
     <p className="operator-action-hint">道路上の到達点が違う場合や、他の画面で編集した内容を読み直したいときに使います。</p>
     {saved&&!dirty&&!busy&&<a className="preview-generate operator-task-secondary" href="/operator/connections" data-draft-corrections>道路上の到達点を確認・修正（保存{corrections.items.length}件）</a>}
     <div className="draft-save-actions"><button type="button" disabled={busy} data-draft-refresh onClick={()=>void operate("catalog")}>スポットの最新情報を反映</button><button type="button" disabled={busy} data-draft-reload onClick={()=>void operate("reload")}>保存内容を読み直す（未保存を破棄）</button></div>
    </details>
    <p className="draft-scope-note">作業中の下書きは1件です。ページを移動する前に保存してください。保存後にルート・コマを生成して確認できます。</p>
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
