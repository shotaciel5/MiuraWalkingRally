"use client";
import {walkingMinutes,WALKING_SPEED_KMH} from "../lib/walking-estimate";
import CourseOmissionSettings from "./course-omission-settings";
import {manualLandmarkSequences,selectOmission,defaultOmissionMode,hybridFailureCount,type OmissionSnapshot} from "../lib/route/omission/selection";
import {projectOmittedPreview} from "../lib/route/omission/projection";
import CourseLandmarkPanel from "./course-landmark-panel";
import CourseLandmarkCredits from "./course-landmark-credits";
import ReviewedLandmarkLayer,{type ReviewedLandmarks} from "./reviewed-landmark-layer";
import {freezeLandmarks,type LandmarkSnapshot} from "../lib/landmarks/course-snapshot";
import {candidatesForCard,choiceKey,initialAccepted,type Candidate} from "../lib/landmarks/model";
import type {WorkbenchState} from "../lib/landmarks/workbench";

import {useEffect,useState} from "react";
import KomaFigure from "./koma-figure";
import OperatorKomaDisplay from "./operator-koma-display";
import CourseSaveButton from "./course-save-button";
import CourseDeletePanel from "./course-delete-panel";
import RouteOverview from "./route-overview";
import CoursePublishPanel from "./course-publish-panel";
import type {CoursePublication} from "../lib/operator/publication";
import CourseReviewPanel from "./course-review-panel";
import type {SaveReceipt} from "../lib/operator/course-format";
import LandmarkIcon from "./landmark-icon";
import type {RallyPreview} from "../lib/operator/rally-preview";

export default function RallyPreviewView({data:source,saved,saveReceipt=null,saveReceipts,saveUnavailable,landmarkInitial,savedLandmarks,savedOmission}:{data:RallyPreview;saved?:{id:string;createdAt:string;fingerprint:string;publication?:CoursePublication|null};saveReceipt?:SaveReceipt|null;saveUnavailable?:string;landmarkInitial?:WorkbenchState;savedLandmarks?:LandmarkSnapshot;savedOmission?:OmissionSnapshot;saveReceipts?:{hybrid?:SaveReceipt;rule:SaveReceipt;all:SaveReceipt}}){
 const [panel,setPanel]=useState<"landmarks"|"list"|"course">(saved?"course":"landmarks");
 const [hydrated,setHydrated]=useState(false);useEffect(()=>setHydrated(true),[]);
 const [selectedPathIndex,setSelectedPathIndex]=useState(source.cards[0].map.pathIndex),[mode,setMode]=useState(savedOmission?.mode??defaultOmissionMode(source.omissionPlan)),[layers,setLayers]=useState({buildings:true,landmarks:true,details:true});
 const [landmarks,setLandmarks]=useState(landmarkInitial??null),[choices,setChoices]=useState(landmarkInitial?.review.choices??{}),[reviewRevision,setReviewRevision]=useState(landmarkInitial?.review.revision??0),[baseReceipt,setReceipt]=useState(saveReceipt),[receipts,setReceipts]=useState(saveReceipts),[landmarkDirty,setLandmarkDirty]=useState(false),[landmarkBusy,setLandmarkBusy]=useState(false),[landmarkError,setLandmarkError]=useState(""),[landmarkNotice,setLandmarkNotice]=useState("");
 useEffect(()=>{if(!landmarkDirty)return;const warn=(e:BeforeUnloadEvent)=>{e.preventDefault();e.returnValue=""};window.addEventListener("beforeunload",warn);return()=>window.removeEventListener("beforeunload",warn)},[landmarkDirty]);
 const plan=source.omissionPlan??savedOmission?.plan,manualSequences=landmarks?manualLandmarkSequences(choices,source.cards.length):savedOmission?.manualSequences??[];
 const selected=plan?selectOmission(plan,mode,manualSequences).selected:source.cards.map(c=>c.map.sequence);
 const data=plan?projectOmittedPreview(source,selected):source;
 const exact=data.cards.findIndex(c=>c.map.pathIndex===selectedPathIndex),index=exact>=0?exact:Math.max(0,data.cards.findLastIndex(c=>c.map.pathIndex<selectedPathIndex));
 function setIndex(value:number|((i:number)=>number)){const i=typeof value==="function"?value(index):value;setSelectedPathIndex(data.cards[Math.max(0,Math.min(data.cards.length-1,i))].map.pathIndex)}
 const fullIndex=selected[index]-1,receipt=plan?receipts?.[mode]??null:baseReceipt;
 const snapshot=savedLandmarks??(landmarks?freezeLandmarks({...landmarks,review:{revision:reviewRevision,choices}}):undefined);
 const target=landmarks?.dataset.targets.find(t=>t.sequences.includes(fullIndex+1)),items=landmarks?candidatesForCard(landmarks.dataset.cards[fullIndex],target?landmarks.targets[target.key]:undefined):savedLandmarks?.cards[fullIndex].candidates??[];
 const reviewed:ReviewedLandmarks|undefined=snapshot?{center:data.cards[index].candidate.point,candidates:snapshot.cards[fullIndex].candidates,photos:snapshot.photos}:undefined;
 function toggleLandmark(c:Candidate,value:boolean){if(landmarkBusy||saved||!landmarks)return;setChoices(old=>({...old,[choiceKey(fullIndex+1,c.id)]:value}));setLandmarkDirty(true);setLandmarkNotice("")}
 async function saveLandmarks(){if(!landmarks||landmarkBusy)return;setLandmarkBusy(true);setLandmarkError("");try{
  const keys=new Set(landmarks.dataset.cards.flatMap(card=>{const t=landmarks.dataset.targets.find(t=>t.sequences.includes(card.map.sequence));return candidatesForCard(card,t?landmarks.targets[t.key]:undefined).map(c=>choiceKey(card.map.sequence,c.id))}));
  const response=await fetch("/api/operator/landmarks",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:"save",source:"draft",datasetId:landmarks.dataset.id,expectedRevision:reviewRevision,choices:Object.fromEntries(Object.entries(choices).filter(([k])=>keys.has(k)))}),signal:AbortSignal.timeout(65000)}),next=await response.json();
  if(!response.ok)throw Error(next.error??"目印を保存できませんでした。");
  if(next.dataset.id!==landmarks.dataset.id||![2,3].includes(next.courseReceipt?.formatVersion)||plan&&["rule","all",...(plan.version===2?["hybrid"]:[])].some(m=>next.courseReceipts?.[m]?.omissionMode!==m))throw Error("保存結果を確認できません。最新の下書きから再生成してください。");
  setLandmarks(next);setChoices(next.review.choices);setReviewRevision(next.review.revision);setReceipt(next.courseReceipt);setReceipts(next.courseReceipts);setLandmarkDirty(false);setLandmarkNotice("目印の採用を保存しました。「この内容を保存して、公開設定へ」でコースを固定できます。");
 }catch(e){setLandmarkError(e instanceof Error?e.message:"目印を保存できませんでした。")}finally{setLandmarkBusy(false)}}
 const card=data.cards[index],map=card.map;
 const nearby=card.referenceContext??card.context;
 const issues=saved?[...new Set([...card.candidate.issues,...map.issues])]:map.issues;
 const name=card.stops.map(s=>s.name).join(" / ")||"道路の分岐";
 const sourceUrl="https://www.openstreetmap.org/"+card.evidence.kind+"/"+card.evidence.id;
 return <div className="preview-dashboard" data-rally-preview data-preview-hydrated={hydrated} data-preview-revision={data.draftRevision} data-preview-count={data.cards.length} data-preview-source-count={source.cards.length}>
  <header className="preview-summary" aria-label="生成結果"><div><p className="eyebrow">{saved?"SAVED COURSE":"COURSE WORKSPACE"}</p><h1>{data.title}</h1><p>{saved?"保存済み・読取専用"+(saved.publication?.status==="published"?" · 公開中":saved.publication?.status==="withdrawn"?" · 公開停止中":saved.publication===null?" · 未公開":" · 公開状態は確認待ち"):"選択した訪問順から生成 · 現地未確認"}</p></div>
   <dl><div><dt>道路上の距離</dt><dd data-preview-meters>{Math.round(data.meters).toLocaleString("ja-JP")} m</dd></div><div><dt>歩行時間の概算</dt><dd>約{Math.ceil(walkingMinutes(data.meters))}分</dd></div><div><dt>コマ数</dt><dd>{data.cards.length}枚</dd></div></dl>
  </header>
  <div className="preview-dashboard-toolbar">
   <div>{plan&&<CourseOmissionSettings mode={mode} onChange={setMode} hybridAvailable={plan.version===2} failureCount={hybridFailureCount(plan)} total={source.cards.length} shown={data.cards.length} disabled={landmarkBusy} saved={!!saved}/>}<p data-operator-preview-guide className="preview-workspace-guidance">コマと全体地図を見比べて確認できます。入口・通行・現地安全性は確認待ちです。</p></div>
   {saved?<button type="button" className="operator-task-primary" data-preview-publication-open onClick={()=>setPanel("course")}>公開・コース設定を開く</button>:<CourseSaveButton compact key={receipt?.fingerprint??"unavailable"} receipt={landmarkDirty||landmarkBusy?null:receipt} unavailable={landmarkDirty?"「目印の採用を保存」を押してからコースを保存してください。":saveUnavailable}/>}
  </div>
  <div className="preview-dashboard-workspace" data-preview-workspace>
   <section className="preview-panel preview-koma-panel" aria-labelledby="preview-koma-title" data-preview-koma={map.sequence}>
    <div className="preview-koma-heading"><h2 id="preview-koma-title" tabIndex={-1}>コマ {index+1} <small>/ {data.cards.length}</small></h2><label><span className="sr-only">通過順で選択</span><select value={index} data-preview-select onChange={e=>setIndex(Number(e.target.value))}>{data.cards.map((c,i)=><option key={i} value={i}>#{i+1} {c.stops.map(s=>s.name).join(" / ")||"分岐"}{c.map.shortGeometry?"（拡大）":c.map.state==="held"?"（確認待ち）":""}</option>)}</select></label></div>
    <div className="preview-layer-controls">{(reviewed?["landmarks"] as const:["buildings","landmarks","details"] as const).map(k=><label key={k}><input type="checkbox" checked={layers[k]} data-preview-layer={k} onChange={e=>setLayers(s=>({...s,[k]:e.target.checked}))}/>{{buildings:"建物",landmarks:"目印・標識",details:"道路名・階段"}[k]}</label>)}</div>
    <div className="preview-koma-viewport"><h3>{name}</h3><OperatorKomaDisplay key={map.sequence} map={map} name={name} context={card.context} referenceContext={card.referenceContext} layers={layers} reviewed={reviewed} editor={landmarks&&!saved?{candidates:items,photos:landmarks.assets,onToggle:toggleLandmark,busy:landmarkBusy}:undefined}/>{reviewed&&<CourseLandmarkCredits landmarks={reviewed}/>}</div>
    <p className="preview-distance">{map.metersToNext===null?"終了地点":"次のコマまで "+Math.round(map.metersToNext)+" m"}<small>出発から {Math.round(map.metersFromStart)}m</small></p>
    <div className="preview-navigation"><button type="button" disabled={index===0} data-preview-prev onClick={()=>setIndex(i=>i-1)}>← 前のコマ</button><button type="button" disabled={index===data.cards.length-1} data-preview-next onClick={()=>setIndex(i=>i+1)}>次のコマ →</button></div>
   </section>
   <RouteOverview data={data} index={index} onSelect={setIndex}/>
   <aside className="preview-inspector" aria-label="コマとコースの編集">
    <div className="preview-inspector-tabs" role="tablist" aria-label="確認・編集する内容">{(["landmarks","list","course"] as const).map(value=><button type="button" key={value} id={"preview-tab-"+value} role="tab" aria-selected={panel===value} aria-controls={"preview-panel-"+value} tabIndex={panel===value?0:-1} data-preview-tab={value} onClick={()=>setPanel(value)} onKeyDown={e=>{const values=["landmarks","list","course"] as const,pos=values.indexOf(value);const next=e.key==="ArrowRight"?values[(pos+1)%3]:e.key==="ArrowLeft"?values[(pos+2)%3]:e.key==="Home"?"landmarks":e.key==="End"?"course":null;if(next){e.preventDefault();setPanel(next);document.getElementById("preview-tab-"+next)?.focus()}}}>{{landmarks:saved?"目印":"目印を編集",list:"コマ一覧",course:saved?"公開・設定":"コース"}[value]}</button>)}</div>
    <section className="preview-inspector-content preview-landmark-tab" role="tabpanel" aria-labelledby="preview-tab-landmarks" id="preview-panel-landmarks" hidden={panel!=="landmarks"}>
     {card.stops.map(s=><p className="preview-stop" key={s.id}><b>{data.visits.find(v=>v.id===s.id)?.label}</b> {s.name}<small>道路上の到達点は入口・安全な待機場所とは限りません。</small></p>)}
     {(landmarks||savedLandmarks)&&<CourseLandmarkPanel items={items} photos={landmarks?.assets??savedLandmarks!.photos} review={{revision:reviewRevision,choices}} sequence={fullIndex+1} onToggle={toggleLandmark} onReset={()=>{setChoices(old=>({...old,...Object.fromEntries(items.map(c=>[choiceKey(fullIndex+1,c.id),initialAccepted(c)]))}));setLandmarkDirty(true);setLandmarkNotice("")}} onSave={()=>void saveLandmarks()} dirty={landmarkDirty} busy={landmarkBusy} error={landmarkError} notice={landmarkNotice} readOnly={!!saved}/>}
     {!reviewed&&(map.state==="ready"||map.shortGeometry)&&layers.landmarks&&<><h3>周辺の目印</h3>{nearby.landmarks.length?<ul className="preview-landmarks">{nearby.landmarks.map(l=><li key={l.id}><LandmarkIcon symbol={l.symbol}/><span><a href={"https://www.openstreetmap.org/"+l.id} target="_blank" rel="noopener noreferrer">{l.name}</a><small>{l.kind} · 約{Math.round(l.meters)}m</small></span></li>)}</ul>:<p>この範囲に表示対象の目印はありません。</p>}</>}
     {!reviewed&&layers.details&&(map.state==="ready"||map.shortGeometry)&&<p>道路名：{[...new Set(nearby.roads.map(r=>r.name).filter(Boolean))].join(" / ")||"OSMの記録なし"}</p>}
     <details className="preview-evidence"><summary>形状・出典・確認事項</summary><p><a href={sourceUrl} target="_blank" rel="noopener noreferrer">OSMの元{card.evidence.kind==="way"?"道路":"地点"}を見る</a>{card.evidence.kind==="way"?" · 道路の途中の候補点です。":""}</p><p>元データに接続する枝は{card.candidate.branches.length}本。元の角度と局所形状を使い、各枝30m以内を描画します。道幅や安全な横断位置は示しません。停止点・標識の対象方向は現地確認が必要です。</p>{issues.length>0&&<ul>{issues.map((s,i)=><li key={i}>{s}</li>)}</ul>}</details>
    </section>
    <section className="preview-inspector-content" role="tabpanel" aria-labelledby="preview-tab-list" id="preview-panel-list" hidden={panel!=="list"}>
     <h2 id="preview-list-title">コマ一覧</h2><p className="preview-caption">{plan&&mode!=="all"?"道なりを省略した順です。省略設定から全交差点へ切り替えられます。":"全コマを通過順に表示しています。"}保留の図は全体地図と根拠を確認してください。</p>
     <div className="preview-card-grid">{data.cards.map((c,i)=><button type="button" key={i} aria-pressed={i===index} data-preview-card={i} onClick={()=>setIndex(i)}><b>#{i+1} {c.stops.map(s=>s.name).join(" / ")||"分岐"}</b><KomaFigure map={c.map} referenceGeometry={c.map.shortGeometry} name={c.stops.map(s=>s.name).join(" / ")||"分岐"} context={c.referenceContext??c.context} layers={{buildings:false,landmarks:false,details:false}} presentation={snapshot?"roads":"source"} mandatorySteps={!!snapshot} compact>{snapshot&&<ReviewedLandmarkLayer map={c.map.shortGeometry?{...c.map,branches:c.map.shortGeometry.branches}:c.map} landmarks={{center:c.candidate.point,candidates:snapshot.cards[selected[i]-1].candidates,photos:snapshot.photos}}/>}</KomaFigure><span>{c.map.shortGeometry?"近接分岐・拡大確認":c.map.state==="held"?"図は確認待ち":"累積 "+Math.round(c.map.metersFromStart)+"m"}</span></button>)}</div>
    </section>
    <section className="preview-inspector-content" role="tabpanel" aria-labelledby="preview-tab-course" id="preview-panel-course" hidden={panel!=="course"}>
     <h2>コースの設定・確認</h2>
     {saved&&<CoursePublishPanel courseId={saved.id} fingerprint={saved.fingerprint} title={data.title} publication={saved.publication}/>}
     <details className="operator-secondary-details"><summary>{saved?"保存版と編集について":"下書きの編集・道路の調整・再生成"}</summary>
      {saved?<p className="preview-version" data-saved-course-id={saved.id}>保存日時：<time dateTime={saved.createdAt}>{new Date(saved.createdAt).toLocaleString("ja-JP",{timeZone:"Asia/Tokyo"})}</time>。保存時の下書き版{data.draftRevision}・補正版{data.correctionRevision}です。台帳や下書きの変更を自動反映しません。</p>:<p className="preview-version">下書き版{data.draftRevision}・補正版{data.correctionRevision}から生成。表示後の変更は再生成で反映します。</p>}
      {saved?<div className="preview-actions" data-saved-course-actions><a href="/operator/courses">保存済み一覧へ</a><a href="/operator/draft">次のコースをつくる</a></div>:<div className="preview-actions"><a href="/operator/connections" data-preview-corrections>道路上の到達点を修正</a><a href="/operator/draft" data-preview-back>下書きを編集</a><a href="/operator/preview" data-preview-regenerate>最新の保存内容から再生成</a></div>}
     </details>
     <section aria-labelledby="preview-order-title"><h3 id="preview-order-title" tabIndex={-1}>訪問順と道路への候補</h3><ol className="preview-visits">{data.visits.map(v=><li key={v.id} data-preview-visit={v.id}><button type="button" onClick={()=>setIndex(v.komaIndex)}><small>{v.label}</small><strong>{v.name}</strong><span>道路まで直線 {Math.round(v.gap)}m · {v.mode==="manual"?"手動補正・未確認":"自動候補・未確認"}</span></button></li>)}</ol><details><summary>区間別の距離</summary><ol>{data.legs.map((l,i)=><li key={i} data-preview-leg={i+1}>{l.from} → {l.to}：{Math.round(l.meters)}m{l.meters===0?"（道路上の候補が同じ位置）":""}</li>)}</ol></details></section>
     {saved&&<CourseReviewPanel data={data} selected={index} onSelect={i=>{setIndex(i);requestAnimationFrame(()=>document.getElementById("preview-koma-title")?.focus({preventScroll:true}))}}/>}
     <p className="preview-caption">時速{WALKING_SPEED_KMH}kmでの概算。観光・施設への移動・滞在は含みません。道路・目印 © <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a> · ODbL。{new Date(data.source.osmBaseTimestamp).toLocaleDateString("ja-JP",{timeZone:"Asia/Tokyo"})}時点の固定データです。入口・通行・安全性は現地確認が必要です。</p>
     {saved&&<CourseDeletePanel courseId={saved.id} fingerprint={saved.fingerprint} title={data.title} publication={saved.publication}/>}
    </section>
   </aside>
  </div>
 </div>;
}
