"use client";
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
import CoursePublishPanel from "./course-publish-panel";
import type {CoursePublication} from "../lib/operator/publication";
import CourseReviewPanel from "./course-review-panel";
import type {SaveReceipt} from "../lib/operator/course-format";
import LandmarkIcon from "./landmark-icon";
import type {RallyPreview} from "../lib/operator/rally-preview";

export default function RallyPreviewView({data:source,saved,saveReceipt=null,saveReceipts,saveUnavailable,landmarkInitial,savedLandmarks,savedOmission}:{data:RallyPreview;saved?:{id:string;createdAt:string;fingerprint:string;publication?:CoursePublication|null};saveReceipt?:SaveReceipt|null;saveUnavailable?:string;landmarkInitial?:WorkbenchState;savedLandmarks?:LandmarkSnapshot;savedOmission?:OmissionSnapshot;saveReceipts?:{hybrid?:SaveReceipt;rule:SaveReceipt;all:SaveReceipt}}){
 const [hydrated,setHydrated]=useState(false);useEffect(()=>setHydrated(true),[]);
 const [selectedPathIndex,setSelectedPathIndex]=useState(source.cards[0].map.pathIndex),[mode,setMode]=useState(savedOmission?.mode??defaultOmissionMode(source.omissionPlan)),[zoom,setZoom]=useState(1),[layers,setLayers]=useState({buildings:true,landmarks:true,details:true});
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
 const card=data.cards[index],map=card.map,next=data.cards[index+1];
 const nearby=card.referenceContext??card.context;
 const issues=saved?[...new Set([...card.candidate.issues,...map.issues])]:map.issues;
 const name=card.stops.map(s=>s.name).join(" / ")||"道路の分岐";
 const extent=[...data.path,...data.visits.map(v=>v.facility)],lat=extent.reduce((sum,p)=>sum+p.lat,0)/extent.length,cos=Math.cos(lat*Math.PI/180);
 const xs=extent.map(p=>p.lon*cos),ys=extent.map(p=>p.lat),minX=Math.min(...xs)-.00035,maxX=Math.max(...xs)+.00035,minY=Math.min(...ys)-.00035,maxY=Math.max(...ys)+.00035;
 const scale=Math.min(760/(maxX-minX),440/(maxY-minY));
 const xy=(p:{lat:number;lon:number})=>[400+(p.lon*cos-(minX+maxX)/2)*scale,240-(p.lat-(minY+maxY)/2)*scale];
 const line=(points:{lat:number;lon:number}[])=>points.map(p=>xy(p).map(n=>n.toFixed(3)).join(",")).join(" ");
 const [cx,cy]=xy(card.candidate.point),vw=800/zoom,vh=480/zoom,vx=Math.max(0,Math.min(800-vw,cx-vw/2)),vy=Math.max(0,Math.min(480-vh,cy-vh/2));
 const pins=[...new Set(data.cards.map(c=>c.map.nodeId))].sort((a,b)=>Number(a===map.nodeId)-Number(b===map.nodeId));
 function choosePin(id:number){const indices=data.cards.flatMap((c,i)=>c.map.nodeId===id?[i]:[]);setIndex(indices.find(i=>i>index)??indices[0])}
 const sourceUrl="https://www.openstreetmap.org/"+card.evidence.kind+"/"+card.evidence.id;
 return <div data-rally-preview data-preview-hydrated={hydrated} data-preview-revision={data.draftRevision} data-preview-count={data.cards.length} data-preview-source-count={source.cards.length}>
  <section className="preview-summary" aria-label="生成結果">
   <div><p className="eyebrow">{saved?"SAVED COURSE / REVIEW":"GENERATED COURSE / REVIEW"}</p><h1>{data.title}</h1><p>{saved?"保存済みの計算結果・読取専用"+(saved.publication?.status==="published"?"（参加者向け公開済み）":saved.publication?.status==="withdrawn"?"（公開停止中）":saved.publication===null?"（参加者へ未掲載）":"（公開状態は確認待ち）"):"未確認の道路上候補を使った開発用プレビュー"}</p></div>
   <dl><div><dt>道路上の距離</dt><dd data-preview-meters>{Math.round(data.meters).toLocaleString("ja-JP")} m</dd></div><div><dt>歩行時間の概算</dt><dd>約{Math.ceil(data.minutes)}分</dd></div><div><dt>コマ数</dt><dd>{data.cards.length}枚</dd></div></dl>
  </section>
  <p className="operator-scope"><span>現地未確認</span>入口・施設までの通路・通行・安全性は確認待ちです。道路上の移動時間は時速{data.speedKmh}kmの概算で、観光・施設への移動や滞在時間を含みません。</p>
  <section className="operator-next-action" aria-label="次の操作" data-operator-preview-guide><div><p className="eyebrow">次のステップ</p><h2>{saved?"保存した内容を確認して、公開へ":"ルートとコマができました"}</h2><p>{saved?"コマと道順を確かめたら、「参加者への公開」で公開の設定を確認できます。":"まずコマと道順を確かめましょう。確認できたら保存して、公開の設定へ進みます。"}</p></div><a className="operator-task-primary" href="#preview-koma-title">コマを確認する ↓</a></section>
  <details className="operator-secondary-details"><summary>{saved?"保存版と編集について":"下書きの編集・道路の調整・再生成"}</summary>
  {saved?<p className="preview-version" data-saved-course-id={saved.id}>保存日時：<time dateTime={saved.createdAt}>{new Date(saved.createdAt).toLocaleString("ja-JP",{timeZone:"Asia/Tokyo"})}</time>。保存時の下書き版{data.draftRevision}・補正版{data.correctionRevision}の計算結果です。台帳や下書きの変更を自動反映しません。</p>:<p className="preview-version">保存済み下書きの版{data.draftRevision}・到達点の補正版{data.correctionRevision}から生成（下書き保存日時：{new Date(data.draftUpdatedAt).toLocaleString("ja-JP",{timeZone:"Asia/Tokyo"})}）。表示後の変更は「最新の保存内容から再生成」で反映します。</p>}
  {saved?<div className="preview-actions" data-saved-course-actions><a href="/operator/courses">保存済み一覧へ</a><a href="/operator/draft">作業中の下書きへ（保存済みは変更しません）</a></div>:<div className="preview-actions"><a href="/operator/connections" data-preview-corrections>道路上の到達点を修正</a><a href="/operator/draft" data-preview-back>下書きを編集</a><a href="/operator/preview" data-preview-regenerate>最新の保存内容から再生成</a></div>}
  </details>
  {plan&&<CourseOmissionSettings mode={mode} onChange={setMode} hybridAvailable={plan.version===2} failureCount={hybridFailureCount(plan)} total={source.cards.length} shown={data.cards.length} disabled={landmarkBusy} saved={!!saved}/>}
  {saved&&<CoursePublishPanel courseId={saved.id} fingerprint={saved.fingerprint} title={data.title} publication={saved.publication}/>}
  <section className="preview-panel" aria-labelledby="preview-koma-title" data-preview-koma={map.sequence}><h2 id="preview-koma-title" tabIndex={-1}>選択中のコマ {index+1} / {data.cards.length}</h2>
   <div className="preview-layer-controls">{(reviewed?["landmarks"] as const:["buildings","landmarks","details"] as const).map(k=><label key={k}><input type="checkbox" checked={layers[k]} data-preview-layer={k} onChange={e=>setLayers(s=>({...s,[k]:e.target.checked}))}/>{{buildings:"建物",landmarks:"目印・標識",details:"道路名・階段"}[k]}</label>)}</div>
   <div className="preview-koma-layout"><div><h3>{name}</h3><OperatorKomaDisplay key={map.sequence} map={map} name={name} context={card.context} referenceContext={card.referenceContext} layers={layers} reviewed={reviewed} editor={landmarks&&!saved?{candidates:items,photos:landmarks.assets,onToggle:toggleLandmark,busy:landmarkBusy}:undefined}/>{reviewed&&<CourseLandmarkCredits landmarks={reviewed}/>}<p className="preview-distance">{map.metersToNext===null?"終了地点":"次のコマまで "+Math.round(map.metersToNext)+" m"}<small>出発から {Math.round(map.metersFromStart)}m</small></p>
    <div className="preview-navigation"><button type="button" disabled={index===0} data-preview-prev onClick={()=>setIndex(i=>i-1)}>← 前のコマ</button><button type="button" disabled={index===data.cards.length-1} data-preview-next onClick={()=>setIndex(i=>i+1)}>次のコマ →</button></div>
   </div><div><label>通過順で選択<select value={index} data-preview-select onChange={e=>setIndex(Number(e.target.value))}>{data.cards.map((c,i)=><option key={i} value={i}>#{i+1} {c.stops.map(s=>s.name).join(" / ")||"分岐"}{c.map.shortGeometry?"（近接分岐・拡大確認）":c.map.state==="held"?"（図は確認待ち）":""}</option>)}</select></label>
    {card.stops.map(s=><p className="preview-stop" key={s.id}><b>{data.visits.find(v=>v.id===s.id)?.label}</b> {s.name}<br/><small>未確認の道路上候補です。実際の入口とは限りません。</small></p>)}
    {!reviewed&&(map.state==="ready"||map.shortGeometry)&&layers.landmarks&&<><h3>{map.shortGeometry?"周辺30mの目印":"周辺の目印"}</h3>{nearby.landmarks.length?<ul className="preview-landmarks">{nearby.landmarks.map(l=><li key={l.id}><LandmarkIcon symbol={l.symbol}/><span><a href={"https://www.openstreetmap.org/"+l.id} target="_blank" rel="noopener noreferrer">{l.name}</a><small>{l.kind} · 約{Math.round(l.meters)}m{l.detail?" · "+l.detail:""}</small></span></li>)}</ul>:<p>この範囲に表示対象の目印はありません。</p>}</>}
    {!reviewed&&layers.details&&(map.state==="ready"||map.shortGeometry)&&<p>道路名：{[...new Set(nearby.roads.map(r=>r.name).filter(Boolean))].join(" / ")||"OSMの記録なし"}</p>}
    {(landmarks||savedLandmarks)&&<CourseLandmarkPanel items={items} photos={landmarks?.assets??savedLandmarks!.photos} review={{revision:reviewRevision,choices}} sequence={fullIndex+1} onToggle={toggleLandmark} onReset={()=>{setChoices(old=>({...old,...Object.fromEntries(items.map(c=>[choiceKey(fullIndex+1,c.id),initialAccepted(c)]))}));setLandmarkDirty(true);setLandmarkNotice("")}} onSave={()=>void saveLandmarks()} dirty={landmarkDirty} busy={landmarkBusy} error={landmarkError} notice={landmarkNotice} readOnly={!!saved}/>}
    <details><summary>形状・出典・確認事項</summary><p><a href={sourceUrl} target="_blank" rel="noopener noreferrer">OSMの元{card.evidence.kind==="way"?"道路":"地点"}を見る</a>{card.evidence.kind==="way"?" · 道路の途中に置いた一時的な候補点です。":""}</p><p>元データに接続する枝は{card.candidate.branches.length}本。元の角度と局所形状を使い、各枝30m以内を描画します。道幅や安全な横断位置は示しません。停止点・標識の対象方向は現地確認が必要です。</p>{issues.length>0&&<ul>{issues.map((s,i)=><li key={i}>{s}</li>)}</ul>}</details>
   </div></div>
  </section>
  {!saved&&<CourseSaveButton key={receipt?.fingerprint??"unavailable"} receipt={landmarkDirty||landmarkBusy?null:receipt} unavailable={landmarkDirty?"選択中のコマで「目印の採用を保存」してからコースを保存してください。":saveUnavailable}/>}
  <section className="preview-panel" aria-labelledby="preview-map-title"><h2 id="preview-map-title">全体地図とコマの位置</h2><p>北が上。青は道路上の生成経路、朱色は選択中のコマ/次の区間です。番号を選ぶとそのコマへ移ります。同じ位置を再訪する場合は、押すたびに通過順を切り替えます。</p>
   <label className="preview-zoom">地図の拡大<select value={zoom} data-preview-zoom onChange={e=>setZoom(Number(e.target.value))}>{[1,2,4,8].map(z=><option key={z} value={z}>{z===1?"全体":z+"倍・選択中のコマ周辺"}</option>)}</select></label>
   <svg className="preview-overview" viewBox={vx+" "+vy+" "+vw+" "+vh} role="group" aria-label="生成経路とコマ位置の全体地図" data-preview-overview>
    <rect width="800" height="480" fill="#f4f5ed"/>
    <g fill="none" stroke="#c7cfd3" strokeWidth="2">{data.roads.map(r=><polyline key={r.id} points={line(r.points)} data-preview-road={r.id}/>)}</g>
    <g fill="none" strokeLinecap="round" strokeLinejoin="round">{data.legs.map((l,i)=><g key={i}><polyline points={line(l.points)} stroke="white" strokeWidth="8"/><polyline points={line(l.points)} stroke="#174b66" strokeWidth="4" data-preview-path={i}/></g>)}
     {next&&<polyline points={line(data.path.slice(map.pathIndex,next.map.pathIndex+1))} stroke="var(--accent)" strokeWidth="6" data-preview-next-segment/>}
    </g>
    {data.visits.map(v=>{const [x,y]=xy(v.facility);return <g key={v.id} pointerEvents="none"><polyline points={line([v.facility,v.point])} fill="none" stroke="#9b642f" strokeWidth="2" strokeDasharray="4 5"/><circle cx={x} cy={y} r={5/zoom} fill="white" stroke="#9b642f" strokeWidth="2"/></g>})}
    {pins.map(id=>{const matches=data.cards.map((c,i)=>({c,i})).filter(x=>x.c.map.nodeId===id),chosen=matches.find(x=>x.i===index)??matches[0],[x,y]=xy(chosen.c.candidate.point),active=id===map.nodeId;return <g key={id} role="button" tabIndex={0} aria-pressed={active} aria-label={"コマ "+matches.map(x=>x.i+1).join("・")+" の位置"} onClick={()=>choosePin(id)} onKeyDown={e=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();choosePin(id)}}} data-preview-pin={id} className="preview-pin"><circle cx={x} cy={y} r={(active?12:8)/zoom} fill={active?"var(--accent)":"white"} stroke={active?"white":"#174b66"} strokeWidth="2"/><text x={x} y={y+.5} textAnchor="middle" dominantBaseline="middle" fill={active?"white":"#174b66"} fontSize={(active?11:8)/zoom} pointerEvents="none">{chosen.i+1}</text></g>})}
   </svg><p className="preview-caption">背景の道路も固定OSMデータです。茶色の白丸は施設の代表位置、点線は道路候補との位置関係を示します。点線は歩ける経路ではありません。</p>
  </section>
  <section className="preview-panel" aria-labelledby="preview-order-title"><h2 id="preview-order-title" tabIndex={-1}>訪問順と道路への候補</h2><p>下書きに並べた順で巡ります。各地点から道路までの直線距離は、道路上の距離に含めていません。</p>
   <ol className="preview-visits">{data.visits.map(v=><li key={v.id} data-preview-visit={v.id}><button type="button" onClick={()=>setIndex(v.komaIndex)}><small>{v.label}</small><strong>{v.name}</strong><span>道路まで直線 {Math.round(v.gap)}m · {v.mode==="manual"?"手動補正・未確認":"自動候補・未確認"}</span></button></li>)}</ol>
   <details><summary>区間別の距離を確認</summary><ol>{data.legs.map((l,i)=><li key={i} data-preview-leg={i+1}>{l.from} → {l.to}：{Math.round(l.meters)}m{l.meters===0?"（道路上の候補が同じ位置）":""}</li>)}</ol></details>
  </section>
  {saved&&<CourseReviewPanel data={data} selected={index} onSelect={i=>{setIndex(i);requestAnimationFrame(()=>{const heading=document.getElementById("preview-koma-title");heading?.focus({preventScroll:true});heading?.scrollIntoView({block:"start"})})}}/>}
  <section className="preview-panel" aria-labelledby="preview-list-title"><h2 id="preview-list-title">コマ一覧</h2><p>{plan&&mode!=="all"?"道なりを省略した順に表示します。設定から全交差点を確認できます。":"全コマを通過順に表示します。"}図が保留のコマは全体地図と根拠を確認してください。</p><div className="preview-card-grid">{data.cards.map((c,i)=><button type="button" key={i} aria-pressed={i===index} data-preview-card={i} onClick={()=>setIndex(i)}><b>#{i+1} {c.stops.map(s=>s.name).join(" / ")||"分岐"}</b><KomaFigure map={c.map} referenceGeometry={c.map.shortGeometry} name={c.stops.map(s=>s.name).join(" / ")||"分岐"} context={c.referenceContext??c.context} layers={{buildings:false,landmarks:false,details:false}} presentation={snapshot?"roads":"source"} mandatorySteps={!!snapshot} compact>{snapshot&&<ReviewedLandmarkLayer map={c.map.shortGeometry?{...c.map,branches:c.map.shortGeometry.branches}:c.map} landmarks={{center:c.candidate.point,candidates:snapshot.cards[selected[i]-1].candidates,photos:snapshot.photos}}/>}</KomaFigure><span>{c.map.shortGeometry?"近接分岐・拡大して確認":c.map.state==="held"?"図は確認待ち":"累積 "+Math.round(c.map.metersFromStart)+"m"}</span></button>)}</div></section>
  <p className="preview-caption">道路・建物・目印 © <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a> · ODbL 1.0。道路は{new Date(data.source.osmBaseTimestamp).toLocaleDateString("ja-JP",{timeZone:"Asia/Tokyo"})}時点の固定データです。{saved?"保存時の計算結果を表示しています。公開状態は「参加者への公開」で確認できます。現地確認は必要です。":"保存は「この内容を保存して、公開設定へ」から行います。保存済みコースは非公開です。"}</p>
 </div>;
}
