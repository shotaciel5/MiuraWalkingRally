"use client";
import {useEffect,useRef,useState} from "react";
import {readParticipation,startParticipation,type ParticipationState} from "../lib/participation";
import type {PublishedCourse,PublishedRally} from "../lib/published-course";
import PublishedNavigator from "./published-navigator";
import {PublishedStopped} from "./published-ui";
const storage=()=>window.sessionStorage;
type Availability="loading"|"ready"|"withdrawn"|"missing"|"unavailable";
export default function PublishedParticipation({rally,course}:{rally:PublishedRally;course?:PublishedCourse}){
 const [state,setState]=useState<ParticipationState|{status:"loading"}>({status:"loading"}),[availability,setAvailability]=useState<Availability>("loading"),[busy,setBusy]=useState(false),alive=useRef(true),request=useRef<AbortController|null>(null),running=useRef(false);
 async function check(action:"read"|"start"|"replace"|"resume"="read"){
  if(running.current)return;running.current=true;setBusy(true);setAvailability("loading");
  const controller=new AbortController();request.current=controller;const current=()=>alive.current&&request.current===controller,timer=window.setTimeout(()=>controller.abort(),20000);
  try{
   const response=await fetch("/api/rallies/"+encodeURIComponent(rally.id)+"/availability",{cache:"no-store",signal:controller.signal}),value:unknown=await response.json();
   if(!current())return;
   const data=value&&typeof value==="object"&&!Array.isArray(value)?value as Record<string,unknown>:null;
   if(response.status===410&&data?.status==="withdrawn"){setAvailability("withdrawn");return}
   if(response.status===404&&data?.status==="missing"){setAvailability("missing");return}
   if(!response.ok||data?.status!=="published"||data.revision!==rally.revision)throw Error("Public course unavailable");
   const next=action==="start"||action==="replace"?startParticipation(storage,rally,{uuid:()=>window.crypto.randomUUID(),now:()=>new Date().toISOString()},action==="replace"):readParticipation(storage,rally);
   setState(next);setAvailability("ready");
   if(next.status==="active"&&(action==="start"||action==="replace"||action==="resume")&&!course)window.location.assign(rally.href+"/play");
  }catch{if(current())setAvailability("unavailable")}
  finally{window.clearTimeout(timer);if(request.current===controller){request.current=null;running.current=false;if(alive.current)setBusy(false)}}
 }
 useEffect(()=>{
  alive.current=true;void check();
  const show=(event:PageTransitionEvent)=>{if(event.persisted)void check()};
  window.addEventListener("pageshow",show);
  return()=>{alive.current=false;request.current?.abort();request.current=null;running.current=false;window.removeEventListener("pageshow",show)};
 },[rally.id,rally.revision]);
 const incompatible=state.status==="invalid"||state.status==="different-edition";
 if(availability==="withdrawn")return <PublishedStopped compact/>;
 if(availability==="missing")return <section className="participant-panel" role="alert" data-published-missing><h2>このコースは現在利用できません</h2><a href="/" className="rally-secondary-link">公開コースへ戻る</a></section>;
 if(availability==="unavailable")return <section className="participant-panel" role="alert" data-published-availability="unavailable"><h2>コースの公開状態を確認できませんでした</h2><p>開始記録は変更していません。時間をおいて再確認してください。</p><button type="button" className="rally-secondary-link" data-published-availability-retry onClick={()=>void check()}>公開状態を再確認</button></section>;
 if(availability==="loading"||state.status==="loading")return <section className="participant-panel" role="status" data-published-participation-state="loading"><p>コースの公開状態と開始記録を確認しています…</p><noscript><p>開始にはJavaScriptを有効にしてください。</p></noscript></section>;
 if(course&&state.status==="active")return <div data-published-participation-state="active" data-published-participation-id={state.participation.participationId} data-published-revision={state.participation.rallyRevision}>
  <section className="participant-session-bar" aria-label="開始記録"><div><span className="participation-status">開始済み</span><span>このタブの開始記録を引き継いでいます。</span><details className="session-details"><summary>開始日時と保持範囲</summary><p><time dateTime={state.participation.startedAt}>{new Date(state.participation.startedAt).toLocaleString("ja-JP",{timeZone:"Asia/Tokyo"})}</time>に開始しました。記録はこのタブ内に保存し、通常はタブを閉じると消えます。再読込みでは最初のコマから表示します。</p></details></div></section>
  <PublishedNavigator key={state.participation.participationId} course={course}/>
 </div>;
 return <section className="participant-panel participation-start" aria-labelledby="published-start-title" data-published-participation-state={state.status}>
  <p className="eyebrow">START THE COURSE</p><h2 id="published-start-title">{state.status==="active"?"開始したコース":"このコースを始める"}</h2>
  <p className="participant-note">ログインや個人情報の入力は不要です。コースの開始を記録し、コマ地図と地点情報を閲覧できます。</p>
  <p className="session-scope">開始記録はこのタブ内に保存します。再読込み後も続けられますが、通常はタブを閉じると消えます。</p>
  {state.status==="active"&&<div data-published-participation-id={state.participation.participationId} data-published-revision={state.participation.rallyRevision}><span className="participation-status">開始済み</span><p><time dateTime={state.participation.startedAt}>{new Date(state.participation.startedAt).toLocaleString("ja-JP",{timeZone:"Asia/Tokyo"})}</time>に開始しました。</p><button type="button" disabled={busy} className="rally-primary-link" data-published-resume onClick={()=>void check("resume")}>開始したコースへ戻る →</button></div>}
  {incompatible&&<p role="alert" className="participation-error">{state.status==="different-edition"?"保存された記録は、このコースの版と異なります。":"保存された開始記録を読み取れません。"}新しく開始すると、このコースの以前の記録だけを置き換えます。</p>}
  {state.status==="unavailable"&&<div role="alert" className="participation-error"><p>開始記録を保存・確認できませんでした。ブラウザの保存設定を確認してください。</p><button type="button" disabled={busy} className="rally-secondary-link" data-published-retry onClick={()=>void check()}>保存状態を再確認</button></div>}
  {(state.status==="empty"||incompatible)&&<button type="button" disabled={busy} className="rally-primary-link" data-published-start onClick={()=>void check(incompatible?"replace":"start")}>{incompatible?"このコースを新しく開始する":"このコースを始める"} →</button>}
  <details className="session-details"><summary>記録について</summary><p>同じブラウザ・接続先・タブで使う一時記録です。別の端末への引継ぎや長期保存には対応していません。コマを見るだけでは地点の到着や達成を記録しません。</p></details>
 </section>;
}
