"use client";
import {useEffect,useRef,useState,type PointerEvent} from "react";
import type {HomeDemoCard} from "../lib/home-demo";
import {swipeStep} from "../lib/participant-walk";
import OperatorKomaDisplay from "./operator-koma-display";
import {ThemeStamp,WalkSurroundings,TsunaMapPennant,ThemeMapScenery} from "./walk-theme-art";

const hints=["黒い点が、入ってくる道。","青い矢印が、次に進む方向。","まちの目印と、見比べてみよう。"];
const Arrow=({back=false}:{back?:boolean})=><svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true" style={back?{transform:"rotate(180deg)"}:undefined}><path d="M4 12h15m-6-6 6 6-6 6"/></svg>;
export default function HomeDemo({cards}:{cards:HomeDemoCard[]}){
 const count=cards.length;
 const [position,setPosition]=useState(1),[animate,setAnimate]=useState(false),[paused,setPaused]=useState(true),[inView,setInView]=useState(false),[visible,setVisible]=useState(true),[reduced,setReduced]=useState(false),[dragX,setDragX]=useState(0);
 const root=useRef<HTMLDivElement>(null),moving=useRef(false),gesture=useRef<{id:number;x:number;y:number}|null>(null),playIntent=useRef<boolean|null>(null);
 const index=(position-1+count)%count,running=!paused&&inView&&visible&&!gesture.current;
 useEffect(()=>{
  const media=window.matchMedia("(prefers-reduced-motion: reduce)");
  setReduced(media.matches);setPaused(media.matches);
  const change=()=>{setReduced(media.matches);if(media.matches)setPaused(true)};
  const visibility=()=>setVisible(document.visibilityState==="visible");
  visibility();media.addEventListener("change",change);document.addEventListener("visibilitychange",visibility);
  return()=>{media.removeEventListener("change",change);document.removeEventListener("visibilitychange",visibility)};
 },[]);
 useEffect(()=>{
  if(!root.current)return;
  if(!("IntersectionObserver" in window)){setInView(true);return}
  const observer=new IntersectionObserver(([entry])=>setInView(entry.isIntersecting&&entry.intersectionRatio>=.35),{threshold:[0,.35]});
  observer.observe(root.current);return()=>observer.disconnect();
 },[]);
 function finish(){
  moving.current=false;setAnimate(false);
  setPosition(p=>p===0?count:p===count+1?1:p);
 }
 function move(step:number,manual=true){
  if(manual)setPaused(true);
  if(moving.current)return;
  moving.current=true;setAnimate(!reduced);setPosition(p=>p+step);
 }
 useEffect(()=>{
  if(!moving.current)return;
  const timer=window.setTimeout(finish,animate?650:0);
  return()=>window.clearTimeout(timer);
 },[position,animate,count]);
 useEffect(()=>{
  if(!running)return;
  const timer=window.setTimeout(()=>move(1,false),5000);
  return()=>window.clearTimeout(timer);
 },[index,running]);
 function down(event:PointerEvent<HTMLDivElement>){
  if(event.button!==0||moving.current)return;
  setPaused(true);gesture.current={id:event.pointerId,x:event.clientX,y:event.clientY};event.currentTarget.setPointerCapture(event.pointerId);
 }
 function drag(event:PointerEvent<HTMLDivElement>){
  const start=gesture.current;if(!start||start.id!==event.pointerId)return;
  const dx=event.clientX-start.x,dy=event.clientY-start.y;setDragX(Math.abs(dx)>Math.abs(dy)?Math.max(-90,Math.min(90,dx)):0);
 }
 function up(event:PointerEvent<HTMLDivElement>){
  const start=gesture.current;gesture.current=null;setDragX(0);
  if(!start||start.id!==event.pointerId)return;
  const step=swipeStep(event.clientX-start.x,event.clientY-start.y);if(step)move(step);
 }
 function choose(i:number){setPaused(true);if(moving.current||i===index)return;moving.current=true;setAnimate(!reduced);setPosition(i+1)}
 const slides=[cards[count-1],...cards,cards[0]];
 return <div className="home-demo walk-player" data-walk-design="tsunosuke" data-map-design="tsunosuke" ref={root} data-home-demo data-demo-index={index} data-demo-running={running} data-demo-position={position} data-demo-moving={animate} onPointerEnter={e=>{if(e.pointerType==="mouse")setPaused(true)}} onFocusCapture={()=>setPaused(true)}>
  <WalkSurroundings/><div className="home-demo-speaker" aria-hidden="true"/>
  <div className="home-demo-heading walk-toolbar"><span className="home-demo-example"><span aria-hidden="true">☷</span>表示例</span><p className="walk-counter"><strong>{String(index+1).padStart(2,"0")}</strong> / {count}</p><span className="walk-icon-button home-demo-help" aria-hidden="true">?</span></div>
  <ThemeStamp design="tsunosuke"/>
  <TsunaMapPennant/>
  <div className="home-demo-viewport" tabIndex={0} aria-label="3コマの表示例。左右の矢印キー、またはスワイプで切り替え" onPointerDown={down} onPointerMove={drag} onPointerUp={up} onPointerCancel={()=>{gesture.current=null;setDragX(0)}} onKeyDown={e=>{if(e.key==="ArrowLeft"||e.key==="ArrowRight"){e.preventDefault();move(e.key==="ArrowRight"?1:-1)}}}>
   <div className={"home-demo-track"+(animate?" is-animating":"")} style={{transform:"translate3d(calc(-"+position*100+"% + "+dragX+"px),0,0)"}} onTransitionEnd={e=>{if(e.target===e.currentTarget&&e.propertyName==="transform")finish()}}>
    {slides.map((card,i)=><div className="home-demo-slide" key={i} aria-hidden={i!==position} data-demo-slide={i===position?"current":undefined}><OperatorKomaDisplay map={card.map} name="三崎の道路から生成した体験用のコマ" context={card.context} referenceContext={null} layers={{buildings:false,landmarks:true,details:false}} reviewed={{center:card.center,candidates:card.candidates,photos:{}}} decoration={<ThemeMapScenery/>} minimal/></div>)}
   </div>
  </div>
  <div className="home-demo-caption" aria-live={paused?"polite":"off"} aria-atomic="true"><p>{hints[index]}</p><span>黒点から入って、青い矢印へ。</span></div>
  <div className="home-demo-controls walk-navigation"><button type="button" className="walk-previous" aria-label="体験コマを前へ" data-demo-prev onClick={()=>move(-1)}><Arrow back/><span>前のコマ</span></button><button type="button" className="walk-next" aria-label="体験コマを次へ" data-demo-next onClick={()=>move(1)}><span>次のコマ</span><Arrow/></button></div>
  <div className="home-demo-playback"><div className="home-demo-dots" aria-label="体験コマを選ぶ">{cards.map((_,i)=><button type="button" key={i} aria-label={"体験コマ "+(i+1)} aria-current={i===index?"true":undefined} onClick={()=>choose(i)} data-demo-dot={i}><span/></button>)}</div><button type="button" className="home-demo-play" aria-label={paused?"自動切替を再生":"自動切替を停止"} data-demo-play onPointerDown={()=>{playIntent.current=!paused}} onClick={()=>{setPaused(playIntent.current??!paused);playIntent.current=null}}>
    <svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">{paused?<path d="M6 3v14l11-7Z"/>:<path d="M5 3h3v14H5Zm7 0h3v14h-3Z"/>}</svg>
   </button></div>
  <div className="home-demo-progress" aria-hidden="true"><span key={index+":"+running} className={running?"is-running":undefined}/></div>
  <p className="home-demo-source">表示例 · © <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a> · <a href="https://opendatacommons.org/licenses/odbl/1-0/">ODbL</a></p>
 </div>;
}
