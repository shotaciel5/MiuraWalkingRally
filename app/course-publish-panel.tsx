"use client";
import {useEffect,useRef,useState} from "react";
import {parsePublication,type CoursePublication} from "../lib/operator/publication";
export default function CoursePublishPanel({courseId,fingerprint,title,publication}:{courseId:string;fingerprint:string;title:string;publication:CoursePublication|null|undefined}){
 const [ready,setReady]=useState(false),[confirm,setConfirm]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState(""),[conflict,setConflict]=useState(false),alive=useRef(true),request=useRef<AbortController|null>(null),running=useRef(false);
 useEffect(()=>{alive.current=true;setReady(true);return()=>{alive.current=false;request.current?.abort()}},[]);
 const target=publication?.status==="published"?"withdrawn":"published",revision=publication?.revision??0,stopping=target==="withdrawn",reopening=publication?.status==="withdrawn";
 async function change(){
  if(!ready||busy||running.current||conflict||publication===undefined)return;
  running.current=true;setBusy(true);setError("");const controller=new AbortController();request.current=controller;const timer=window.setTimeout(()=>controller.abort(),30000);
  try{
   const response=await fetch("/api/operator/courses/"+(stopping?"unpublish":"publish"),{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({courseId,fingerprint,expectedRevision:revision}),cache:"no-store",signal:controller.signal});
   const value:unknown=await response.json();if(!response.ok){if(response.status===409&&alive.current)setConflict(true);throw Error(value&&typeof value==="object"&&"error" in value&&typeof value.error==="string"?value.error:"変更結果を確認できません。")}
   const saved=parsePublication(value);if(saved.courseId!==courseId||saved.fingerprint!==fingerprint||saved.status!==target||saved.revision!==revision+1)throw Error("変更結果が一致しません。同じ操作で再試行してください。");
   if(alive.current)window.location.assign("/operator/courses/"+encodeURIComponent(courseId));
  }catch(cause){if(alive.current)setError(cause instanceof Error&&cause.name!=="AbortError"?cause.message:"変更結果を確認できません。同じ操作で再試行できます。")}
  finally{window.clearTimeout(timer);request.current=null;running.current=false;if(alive.current)setBusy(false)}
 }
 const operation=stopping?"公開を停止":reopening?"同じ内容を再公開":"参加者向けに公開";
 return <section className="preview-panel course-publication operator-task-panel" aria-labelledby="course-publication-title" data-course-publication={publication===undefined?"unavailable":publication?.status??"unpublished"} data-publication-revision={revision}>
  <div className="operator-publication-heading"><div><p className="eyebrow">PUBLISH YOUR COURSE</p><h2 id="course-publication-title">参加者への公開</h2></div><span className="operator-publication-state">{publication===undefined?"公開状態を確認":publication?.status==="published"?"公開中":reopening?"公開停止中":"未公開"}</span></div>
  {publication===undefined?<><p role="alert">公開状態を確認できませんでした。開き直して再試行してください。</p><a className="operator-task-secondary" href={"/operator/courses/"+courseId}>公開状態を確認する</a></>:<>
   <p>{publication?.status==="published"?"このコースは公開中です。参加者の画面を開いて、表示を確認できます。":reopening?"このコースの公開を停止しています。保存済みの内容を確認して、同じ内容を再公開できます。":"このコースは保存済み・未公開です。コマ地図と現地の状況を確認したら、参加者向けに公開できます。"}</p>
   {publication&&<p className="preview-caption">{reopening?"公開停止日時":"公開日時"}：<time dateTime={publication.changedAt}>{new Date(publication.changedAt).toLocaleString("ja-JP",{timeZone:"Asia/Tokyo"})}</time></p>}
   {publication?.status==="published"&&<p><a className="rally-primary-link operator-task-primary" data-publication-participant-link href={"/rallies/"+courseId}>参加者の画面で確認する →</a></p>}
   {!confirm&&<p className="operator-action-hint">{stopping?"公開を止める場合は、次の確認画面で停止の範囲を確かめてください。":"次に公開内容の確認画面を開きます。そこで確定するまで公開されません。"}</p>}
   {!confirm?<button type="button" className={stopping?"operator-task-secondary":"operator-task-primary"} disabled={!ready||conflict} data-publication-open={publication===null?"":undefined} data-publication-stop-open={stopping?"":undefined} data-publication-reopen-open={reopening?"":undefined} onClick={()=>setConfirm(true)}>{ready?operation:"操作を準備しています…"}</button>:<div className="publication-confirm" data-publication-confirm data-publication-target={target}>
    <h3>「{title}」の{stopping?"公開を停止します":reopening?"同じ内容を再公開します":"保存版を公開します"}</h3>
    {stopping?<><p>参加者一覧から外し、開始済みの人も次回の読み込みからコマを開けなくします。すでに開いている画面は再読込みまで残り得ます。</p><p>保存済みコースと開始記録は残します。同じ内容を再公開すれば、同じタブに残る開始記録を引き継げます。</p></>:<><p>このアプリの参加者一覧へ掲載します。内容はこの保存版に固定され、下書きの編集を自動反映しません。</p>{reopening&&<p>同じタブに残る、このコースの開始記録を引き継げます。</p>}<p className="preview-caption">現地の入口・通行・安全性は確認待ちです。内容の変更は、下書きから再生成して別の結果として保存してください。</p></>}
    <div className="publication-actions"><button type="button" className="operator-task-primary" disabled={busy||conflict} data-publication-submit data-publication-action={target} onClick={()=>void change()}>{busy?"変更しています…":error?"同じ操作を再試行":stopping?"このコースの公開を停止":reopening?"同じ内容で再公開":"この内容を参加者側に公開"}</button><button type="button" className="operator-task-secondary" disabled={busy} data-publication-cancel onClick={()=>{setConfirm(false);setError("")}}>戻る</button></div>
   </div>}
   {error&&<p role="alert" data-publication-error>{error}</p>}{conflict&&<a className="operator-task-secondary" href={"/operator/courses/"+courseId}>公開状態を開き直して確認する</a>}
  </>}
 </section>;
}
