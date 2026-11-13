"use client";
import {useEffect,useRef,useState} from "react";
import {parseCourseDeletion} from "../lib/operator/course-deletion";
import type {CoursePublication} from "../lib/operator/publication";

export default function CourseDeletePanel({courseId,fingerprint,title,publication}:{courseId:string;fingerprint:string;title:string;publication:CoursePublication|null|undefined}){
 const [confirm,setConfirm]=useState(false),[busy,setBusy]=useState(false),[ready,setReady]=useState(false),[error,setError]=useState(""),[conflict,setConflict]=useState(false);
 const alive=useRef(true),running=useRef(false),request=useRef<AbortController|null>(null);
 useEffect(()=>{alive.current=true;setReady(true);return()=>{alive.current=false;request.current?.abort()}},[]);
 async function remove(){
  if(!ready||publication===undefined||running.current||conflict)return;
  running.current=true;setBusy(true);setError("");
  const controller=new AbortController();request.current=controller;const timer=setTimeout(()=>controller.abort(),30000);
  try{
   const response=await fetch("/api/operator/courses",{method:"DELETE",headers:{"Content-Type":"application/json"},body:JSON.stringify({courseId,fingerprint,expectedPublicationRevision:publication?.revision??0}),cache:"no-store",signal:controller.signal});
   const value:unknown=await response.json();
   if(!response.ok){if(alive.current&&response.status===409)setConflict(true);throw Error(value&&typeof value==="object"&&"error" in value&&typeof value.error==="string"?value.error:"削除結果を確認できません。")}
   const deleted=parseCourseDeletion(value);
   if(deleted.courseId!==courseId||deleted.fingerprint!==fingerprint)throw Error("削除結果が一致しません。開き直して確認してください。");
   if(alive.current)window.location.assign("/operator/courses");
  }catch(cause){if(alive.current)setError(cause instanceof Error&&cause.name!=="AbortError"?cause.message:"削除結果を確認できません。同じ操作で再試行できます。")}
  finally{clearTimeout(timer);request.current=null;running.current=false;if(alive.current)setBusy(false)}
 }
 return <section className="preview-panel course-deletion" data-course-deletion aria-labelledby="course-deletion-title">
  <h2 id="course-deletion-title">このコースを削除する</h2><p>保存済み一覧から外し、このコースを開けなくします。共有のスポットや写真、ほかのコースは残ります。</p>
  {publication===undefined?<p role="alert">公開状態を確認できないため削除できません。ページを開き直してください。</p>:!confirm?<button type="button" className="operator-task-secondary" disabled={!ready||conflict} data-course-delete-open onClick={()=>setConfirm(true)}>コースを削除…</button>:<div className="course-delete-confirm" data-course-delete-confirm>
   <h3>「{title}」を削除しますか？</h3>
   <p>{publication?.status==="published"?"公開を停止し、保存済みコースをまとめて削除します。参加中の人も、次に読み込むとこのコースを開けなくなります。":"一覧と詳細から外し、参加者からも開けなくします。"}</p>
   <p>この画面から元には戻せません。必要な場合は、地点を選び直してコースを保存してください。</p>
   <div className="publication-actions"><button type="button" className="operator-delete-confirm-button" disabled={busy||conflict} data-course-delete-submit onClick={()=>void remove()}>{busy?"削除しています…":error?"同じ削除を再試行":publication?.status==="published"?"公開停止して削除する":"このコースを削除する"}</button><button type="button" className="operator-task-secondary" disabled={busy} data-course-delete-cancel onClick={()=>{setConfirm(false);setError("")}}>削除せず戻る</button></div>
  </div>}
  {error&&<p role="alert" data-course-delete-error>{error}</p>}{conflict&&<a href={"/operator/courses/"+courseId}>最新の公開状態を確認する</a>}
 </section>;
}
