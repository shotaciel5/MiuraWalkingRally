"use client";
import {useEffect,useState} from "react";
import Link from "next/link";
import {useRouter} from "next/navigation";
import {readParticipation,startParticipation,type ParticipationState} from "../lib/participation";
import type {PublishedCourse,PublishedRally} from "../lib/published-course";
import PublishedNavigator from "./published-navigator";
const storage=()=>window.sessionStorage;
export default function PublishedParticipation({rally,course}:{rally:PublishedRally;course?:PublishedCourse}){
 const router=useRouter(),[state,setState]=useState<ParticipationState|{status:"loading"}>({status:"loading"});
 useEffect(()=>{setState(readParticipation(storage,rally))},[rally.id,rally.revision]);
 const incompatible=state.status==="invalid"||state.status==="different-edition";
 function begin(replace=false){
  const next=startParticipation(storage,rally,{uuid:()=>window.crypto.randomUUID(),now:()=>new Date().toISOString()},replace);setState(next);
  if(next.status==="active"&&!course)router.push(rally.href+"/play");
 }
 if(course&&state.status==="active")return <div data-published-participation-state="active" data-published-participation-id={state.participation.participationId} data-published-revision={state.participation.rallyRevision}>
  <section className="participant-session-bar" aria-label="開始記録"><div><span className="participation-status">開始済み</span><span>このタブの開始記録を引き継いでいます。</span><details className="session-details"><summary>開始日時と保持範囲</summary><p><time dateTime={state.participation.startedAt}>{new Date(state.participation.startedAt).toLocaleString("ja-JP",{timeZone:"Asia/Tokyo"})}</time>に開始しました。記録はこのタブ内に保存し、通常はタブを閉じると消えます。再読込みでは最初のコマから表示します。</p></details></div></section>
  <PublishedNavigator key={state.participation.participationId} course={course}/>
 </div>;
 return <section className="participant-panel participation-start" aria-labelledby="published-start-title" data-published-participation-state={state.status}>
  <p className="eyebrow">START THE COURSE</p><h2 id="published-start-title">{state.status==="active"?"開始したコース":"このコースを始める"}</h2>
  <p className="participant-note">ログインや個人情報の入力は不要です。コースの開始を記録し、コマ地図と地点情報を閲覧できます。</p>
  <p className="session-scope">開始記録はこのタブ内に保存します。再読込み後も続けられますが、通常はタブを閉じると消えます。</p>
  {state.status==="loading"&&<><p role="status">開始記録を確認しています…</p><noscript><p>開始にはJavaScriptを有効にしてください。</p></noscript></>}
  {state.status==="active"&&<div data-published-participation-id={state.participation.participationId} data-published-revision={state.participation.rallyRevision}><span className="participation-status">開始済み</span><p><time dateTime={state.participation.startedAt}>{new Date(state.participation.startedAt).toLocaleString("ja-JP",{timeZone:"Asia/Tokyo"})}</time>に開始しました。</p><Link href={rally.href+"/play"} className="rally-primary-link" data-published-resume>開始したコースへ戻る →</Link></div>}
  {incompatible&&<p role="alert" className="participation-error">{state.status==="different-edition"?"保存された記録は、このコースの版と異なります。":"保存された開始記録を読み取れません。"}新しく開始すると、このコースの以前の記録だけを置き換えます。</p>}
  {state.status==="unavailable"&&<div role="alert" className="participation-error"><p>開始記録を保存・確認できませんでした。ブラウザの保存設定を確認してください。</p><button type="button" className="rally-secondary-link" data-published-retry onClick={()=>setState(readParticipation(storage,rally))}>保存状態を再確認</button></div>}
  {(state.status==="empty"||incompatible)&&<button type="button" className="rally-primary-link" data-published-start onClick={()=>begin(incompatible)}>{incompatible?"このコースを新しく開始する":"このコースを始める"} →</button>}
  <details className="session-details"><summary>記録について</summary><p>同じブラウザ・接続先・タブで使う一時記録です。別の端末への引継ぎや長期保存には対応していません。コマを見るだけでは地点の到着や達成を記録しません。</p></details>
 </section>;
}
