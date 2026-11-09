"use client";
import {useEffect,useRef,useState} from "react";
import {parsePublication,type CoursePublication} from "../lib/operator/publication";
export default function CoursePublishPanel({courseId,fingerprint,title,publication}:{courseId:string;fingerprint:string;title:string;publication:CoursePublication|null|undefined}){
 const [ready,setReady]=useState(false),[confirm,setConfirm]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState(""),[conflict,setConflict]=useState(false),alive=useRef(true),request=useRef<AbortController|null>(null),running=useRef(false);
 useEffect(()=>{alive.current=true;setReady(true);return()=>{alive.current=false;request.current?.abort()}},[]);
 async function publish(){
  if(!ready||busy||running.current||conflict||publication!==null)return;
  running.current=true;setBusy(true);setError("");const controller=new AbortController();request.current=controller;const timer=window.setTimeout(()=>controller.abort(),30000);
  try{
   const response=await fetch("/api/operator/courses/publish",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({courseId,fingerprint}),cache:"no-store",signal:controller.signal});
   const value:unknown=await response.json();if(!response.ok){if(response.status===409&&alive.current)setConflict(true);throw Error(value&&typeof value==="object"&&"error" in value&&typeof value.error==="string"?value.error:"公開結果を確認できません。")}
   const saved=parsePublication(value);if(saved.courseId!==courseId||saved.fingerprint!==fingerprint)throw Error("公開結果の識別情報が一致しません。同じコースで再試行してください。");
   if(alive.current)window.location.assign("/operator/courses/"+encodeURIComponent(courseId));
  }catch(cause){if(alive.current)setError(cause instanceof Error&&cause.name!=="AbortError"?cause.message:"公開結果を確認できません。同じコースで再試行できます。")}
  finally{window.clearTimeout(timer);request.current=null;running.current=false;if(alive.current)setBusy(false)}
 }
 return <section className="preview-panel course-publication" aria-labelledby="course-publication-title" data-course-publication={publication===undefined?"unavailable":publication?"published":"unpublished"}>
  <h2 id="course-publication-title">参加者への公開</h2>
  {publication===undefined?<><p role="alert">公開状態を確認できませんでした。開き直して再試行してください。</p><a href={"/operator/courses/"+courseId}>公開状態を確認する</a></>:publication?<><p>この保存版を参加者向けに公開しています。</p><p className="preview-caption">公開日時：<time dateTime={publication.publishedAt}>{new Date(publication.publishedAt).toLocaleString("ja-JP",{timeZone:"Asia/Tokyo"})}</time></p><a className="rally-primary-link" data-publication-participant-link href={"/rallies/"+courseId}>参加者のコース詳細を開く →</a></>:<>
   <p>参加者には未掲載です。この保存版を公開すると、参加者のコース一覧から選べるようになります。</p>
   {!confirm?<button type="button" disabled={!ready} data-publication-open onClick={()=>setConfirm(true)}>{ready?"参加者向けに公開":"公開操作を準備しています…"}</button>:<div className="publication-confirm" data-publication-confirm>
    <h3>「{title}」を公開します</h3><p>このアプリの参加者一覧へ掲載します。内容はこの保存版に固定され、下書きの編集を自動反映しません。</p><p className="preview-caption">現地の入口・通行・安全性は確認待ちです。公開後の掲載解除・内容差替は現在できません。</p>
    <div className="publication-actions"><button type="button" disabled={busy||conflict} data-publication-submit onClick={()=>void publish()}>{busy?"公開しています…":error?"同じコースの公開を再試行":"この内容を参加者側に公開"}</button><button type="button" disabled={busy} data-publication-cancel onClick={()=>{setConfirm(false);setError("")}}>戻る</button></div>
   </div>}
   {error&&<p role="alert" data-publication-error>{error}</p>}{conflict&&<a href={"/operator/courses/"+courseId}>保存済みコースを開き直す</a>}
  </>}
 </section>;
}
