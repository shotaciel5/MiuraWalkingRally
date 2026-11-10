"use client";
import {useEffect,useRef,useState} from "react";
import {readParticipation,startParticipation,type ParticipationState} from "../lib/participation";
import {checkPublishedCourse,type PublishedAvailability} from "../lib/published-availability";
import type {PublishedCourse,PublishedRally} from "../lib/published-course";
import PublishedNavigator from "./published-navigator";
import {PublishedStopped} from "./published-ui";
const storage=()=>window.sessionStorage;
export default function PublishedParticipation({rally,course}:{rally:PublishedRally;course:PublishedCourse}){
 const [state,setState]=useState<ParticipationState|{status:"loading"}>({status:"loading"}),[availability,setAvailability]=useState<PublishedAvailability|"loading">("loading"),[busy,setBusy]=useState(false),alive=useRef(true),request=useRef<AbortController|null>(null),running=useRef(false);
 async function check(action:"read"|"start"|"replace"="read"){
  if(running.current)return;running.current=true;setBusy(true);setAvailability("loading");
  const controller=new AbortController();request.current=controller;const current=()=>alive.current&&request.current===controller,timer=window.setTimeout(()=>controller.abort(),20000);
  try{
   const available=await checkPublishedCourse(rally,controller.signal);if(!current())return;
   if(available!=="ready"){setAvailability(available);return}
   const next=action==="start"||action==="replace"?startParticipation(storage,rally,{uuid:()=>window.crypto.randomUUID(),now:()=>new Date().toISOString()},action==="replace"):readParticipation(storage,rally);
   setState(next);setAvailability("ready");
  }catch{if(current())setAvailability("unavailable")}
  finally{window.clearTimeout(timer);if(request.current===controller){request.current=null;running.current=false;if(alive.current)setBusy(false)}}
 }
 useEffect(()=>{
  alive.current=true;void check();const show=(event:PageTransitionEvent)=>{if(event.persisted)void check()};window.addEventListener("pageshow",show);
  return()=>{alive.current=false;request.current?.abort();request.current=null;running.current=false;window.removeEventListener("pageshow",show)};
 },[rally.id,rally.revision]);
 if(availability==="ready"&&state.status==="active")return <div data-published-participation-state="active" data-published-participation-id={state.participation.participationId} data-published-revision={state.participation.rallyRevision}><PublishedNavigator key={state.participation.participationId} course={course}/></div>;
 const incompatible=state.status==="invalid"||state.status==="different-edition";
 return <div className="walk-entry"><a href="/courses" className="walk-return">← コース一覧</a>
  {availability==="withdrawn"?<PublishedStopped compact/>:availability==="missing"?<section className="participant-panel" role="alert" data-published-missing><h2>このコースは現在利用できません</h2><a href="/courses">コース一覧へ戻る</a></section>:availability==="unavailable"?<section className="participant-panel" role="alert" data-published-availability="unavailable"><h2>公開状態を確認できませんでした</h2><p>開始記録は変更していません。時間をおいて再確認してください。</p><button type="button" className="rally-primary-link" data-published-availability-retry onClick={()=>void check()}>再確認する</button></section>:availability==="loading"||state.status==="loading"?<section className="walk-start-panel" role="status" data-published-participation-state="loading"><p>コースを開いています…</p><noscript><p>JavaScriptを有効にしてください。</p></noscript></section>:<section className="walk-start-panel" aria-labelledby="walk-start-title" data-published-participation-state={state.status}>
   <span className="walk-start-mark" aria-hidden="true">歩</span><h2 id="walk-start-title">{rally.title}</h2><p className="walk-start-count">チェックポイント {rally.checkpointIds.length}か所</p><p>{rally.checkpointIds.length?"コマ地図をたどり、チェックポイントで写真を撮ろう。撮影した写真は、ゴールで見せてください。":"コマ地図をたどって、まち歩きを楽しもう。"}</p>
   <p className="walk-help-safety">安全な場所に立ち止まって操作してください。現地の入口・通行・安全性は確認待ちです。</p>
   {incompatible&&<p role="alert" className="participation-error">{state.status==="different-edition"?"保存された記録はこのコースの版と異なります。":"保存された開始記録を読み取れません。"}新しく始めると、このコースの以前の記録だけを置き換えます。</p>}
   {state.status==="unavailable"&&<div role="alert" className="participation-error"><p>開始記録を保存・確認できませんでした。</p><button type="button" className="rally-secondary-link" disabled={busy} data-published-retry onClick={()=>void check()}>保存状態を再確認</button></div>}
   {(state.status==="empty"||incompatible)&&<button type="button" disabled={busy} className="rally-primary-link" data-published-start onClick={()=>void check(incompatible?"replace":"start")}>{incompatible?"このコースを新しく始める":"歩きはじめる"} →</button>}
   <p className="walk-start-storage">開始記録はこのタブ内に保存します。通常はタブを閉じると消えます。</p>
  </section>}
 </div>;
}
