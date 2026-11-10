"use client";
import {useEffect,useRef,useState,type MouseEvent} from "react";
import {startParticipation} from "../lib/participation";
import {checkPublishedCourse} from "../lib/published-availability";
import type {PublishedRally} from "../lib/published-course";
export default function CourseStartLink({rally}:{rally:PublishedRally}){
 const [busy,setBusy]=useState(false),[error,setError]=useState(""),running=useRef(false),request=useRef<AbortController|null>(null),alive=useRef(true);
 useEffect(()=>{alive.current=true;return()=>{alive.current=false;request.current?.abort()}},[]);
 async function start(event:MouseEvent<HTMLAnchorElement>){
  if(event.button!==0||event.ctrlKey||event.metaKey||event.shiftKey||event.altKey)return;
  event.preventDefault();if(running.current)return;running.current=true;setBusy(true);setError("");
  const controller=new AbortController();request.current=controller;const timer=window.setTimeout(()=>controller.abort(),20000);
  try{
   const available=await checkPublishedCourse(rally,controller.signal);if(!alive.current)return;if(controller.signal.aborted){setError("公開状態を確認できませんでした。もう一度お試しください。");return;}
   if(available!=="ready"){setError(available==="withdrawn"?"このコースは公開を停止しています。":available==="missing"?"このコースは現在利用できません。":"公開状態を確認できませんでした。もう一度お試しください。");return}
   const state=startParticipation(()=>window.sessionStorage,rally,{uuid:()=>window.crypto.randomUUID(),now:()=>new Date().toISOString()});
   if(state.status==="unavailable"){setError("開始記録を保存・確認できませんでした。もう一度お試しください。");return}
   window.location.assign(rally.href+"/play");
  }catch{if(alive.current)setError("開始できませんでした。もう一度お試しください。")}
  finally{window.clearTimeout(timer);request.current=null;running.current=false;if(alive.current)setBusy(false)}
 }
 return <><a className="rally-primary-link" href={rally.href+"/play"} aria-disabled={busy} data-published-start-link={rally.id} onClick={event=>void start(event)}>{busy?"開いています…":"このコースで歩く →"}</a>{error&&<p className="participation-error" role="alert" data-course-start-error>{error}</p>}</>;
}
