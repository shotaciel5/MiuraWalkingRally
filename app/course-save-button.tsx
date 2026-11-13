"use client";
import {useEffect,useRef,useState} from "react";
import type {SaveReceipt} from "../lib/operator/course-format";
export default function CourseSaveButton({receipt,unavailable}:{receipt:SaveReceipt|null;unavailable?:string}){
 const [busy,setBusy]=useState(false),[error,setError]=useState(""),[conflict,setConflict]=useState(false),alive=useRef(true),running=useRef(false),request=useRef<AbortController|null>(null);
 useEffect(()=>{alive.current=true;return()=>{alive.current=false;request.current?.abort()}},[]);
 async function save(){
  if(!receipt||running.current||conflict)return;
  running.current=true;setBusy(true);setError("");const controller=new AbortController();request.current=controller;
  const timer=window.setTimeout(()=>controller.abort(),30000);
  try{
   const response=await fetch("/api/operator/courses",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(receipt),cache:"no-store",signal:controller.signal});
   const value:unknown=await response.json();
   if(!response.ok){if(response.status===409&&alive.current)setConflict(true);throw Error(value&&typeof value==="object"&&"error" in value&&typeof value.error==="string"?value.error:"保存結果を確認できません。")}
   if(!value||typeof value!=="object"||!("id" in value)||typeof value.id!=="string"||!/^course-[0-9a-f-]{36}$/.test(value.id)||!("fingerprint" in value)||value.fingerprint!==receipt.fingerprint)throw Error("保存結果を確認できません。同じ結果で再試行してください。");
   if(alive.current)window.location.assign("/operator/courses/"+encodeURIComponent(value.id));
  }catch(cause){if(alive.current)setError(cause instanceof Error&&cause.name!=="AbortError"?cause.message:"保存結果を確認できません。表示を残しています。同じ結果で再試行できます。")}
  finally{window.clearTimeout(timer);request.current=null;running.current=false;if(alive.current)setBusy(false)}
 }
 return <div className="course-save-panel operator-task-panel" data-course-save-panel>
  <h2>確認できたら、保存して次へ</h2><p>この内容を保存すると、公開の設定画面へ進みます。保存だけでは参加者に公開されません。下書きは引き続き編集できます。</p>
  <button type="button" className="operator-task-primary" disabled={busy||!receipt||conflict} data-course-save onClick={()=>void save()}>{busy?"保存しています…":conflict?"再生成してから保存":error?"同じ結果の保存を再試行":"この内容を保存して、公開設定へ"}</button>
  {!receipt&&<p role="alert">{unavailable??"保存の準備ができません。内容を確認して再生成してください。"}</p>}
  {error&&<p role="alert" data-course-save-error>{error}</p>}
  {conflict&&<a className="operator-task-secondary" href="/operator/preview">最新の保存内容から再生成する</a>}
 </div>;
}
