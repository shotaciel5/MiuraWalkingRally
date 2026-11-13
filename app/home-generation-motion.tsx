"use client";
import {useEffect,useRef,useState,type ReactNode} from "react";

export default function HomeGenerationMotion({children}:{children:ReactNode}){
 const root=useRef<HTMLDivElement>(null);
 const [inView,setInView]=useState(false),[visible,setVisible]=useState(true),[reduced,setReduced]=useState(true),[paused,setPaused]=useState(false);
 useEffect(()=>{
  const media=matchMedia("(prefers-reduced-motion: reduce)"),motion=()=>setReduced(media.matches),visibility=()=>setVisible(document.visibilityState==="visible");
  motion();visibility();media.addEventListener("change",motion);document.addEventListener("visibilitychange",visibility);
  const observer=typeof IntersectionObserver==="undefined"?null:new IntersectionObserver(entries=>setInView(entries[0]?.isIntersecting??false),{threshold:.1});
  if(observer&&root.current)observer.observe(root.current);else setInView(true);
  return()=>{observer?.disconnect();media.removeEventListener("change",motion);document.removeEventListener("visibilitychange",visibility)};
 },[]);
 const running=inView&&visible&&!reduced&&!paused;
 return <div ref={root} className="hp-generation-motion" data-generation-animation data-motion={running?"running":"static"}>
  <div className="hp-generation-controls"><span><i aria-hidden="true"/>スポット選択から、コマの完成まで</span>{reduced?<span className="hp-motion-note">動きを抑えて表示中</span>:<button type="button" onClick={()=>setPaused(!paused)} aria-label={paused?"生成例の演出を再生":"生成例の演出を停止"} data-generation-toggle>{paused?<><span aria-hidden="true">▶</span> 演出を再生</>:<><span aria-hidden="true">Ⅱ</span> 演出を停止</>}</button>}</div>
  {children}
 </div>;
}
