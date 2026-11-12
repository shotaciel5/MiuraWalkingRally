"use client";
import {useRef,useState,type KeyboardEvent,type PointerEvent} from "react";
import type {PublishedCourse} from "../lib/published-course";
import {walkCard,swipeStep} from "../lib/participant-walk";
import CourseLandmarkCredits from "./course-landmark-credits";
import OperatorKomaDisplay from "./operator-koma-display";
function Arrow({back=false}:{back?:boolean}){return <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true" style={back?{transform:"rotate(180deg)"}:undefined}><path d="M4 12h15m-6-6 6 6-6 6"/></svg>}
function Camera(){return <svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><path d="m8 5 1-2h6l1 2h4v15H4V5Z"/><circle cx="12" cy="12" r="4"/></svg>}
export default function PublishedNavigator({course}:{course:PublishedCourse}){
 const [index,setIndex]=useState(0),[layers,setLayers]=useState({buildings:true,landmarks:true,details:true}),frame=useRef<HTMLDivElement>(null),help=useRef<HTMLDialogElement>(null),gesture=useRef<{id:number;x:number;y:number}|null>(null);
 const reviewed=course.landmarks?{center:course.centers![index],candidates:course.landmarks.cards[index].candidates,photos:course.landmarks.photos}:undefined;
 const card=walkCard(course,index),map=card.map,hasNotice=card.checkpoints.length>0||card.isFinish;
 function choose(next:number){const target=Math.max(0,Math.min(course.cards.length-1,next));if(target===index)return;setIndex(target);requestAnimationFrame(()=>frame.current?.focus({preventScroll:true}))}
 function down(event:PointerEvent<HTMLDivElement>){if(event.pointerType==="mouse"||(event.target as Element).closest("button,a,input,select,summary"))return;gesture.current={id:event.pointerId,x:event.clientX,y:event.clientY};event.currentTarget.setPointerCapture(event.pointerId)}
 function up(event:PointerEvent<HTMLDivElement>){const start=gesture.current;gesture.current=null;if(!start||start.id!==event.pointerId)return;const step=swipeStep(event.clientX-start.x,event.clientY-start.y);if(step)choose(index+step)}
 function key(event:KeyboardEvent<HTMLElement>){if((event.target as Element).closest("button,a,input,select,summary,dialog"))return;if(event.key==="ArrowLeft"||event.key==="ArrowRight"){event.preventDefault();choose(index+(event.key==="ArrowRight"?1:-1))}}
 return <section className={"walk-player"+(hasNotice?" has-walk-notice":"")} aria-label="コマ地図" data-published-navigator data-published-count={course.cards.length} onKeyDown={key}>
  <header className="walk-toolbar"><a href="/courses" className="walk-icon-button" aria-label="コース一覧へ戻る"><Arrow back/></a><p className="walk-counter" role="status" aria-live="polite"><span className="walk-sr-only">コマ </span><strong>{String(map.sequence).padStart(2,"0")}</strong><span aria-hidden="true"> / </span><span className="walk-sr-only">全 </span>{course.cards.length}</p><button type="button" className="walk-icon-button" aria-label="地図の見方と設定" data-walk-help onClick={()=>help.current?.showModal()}><span aria-hidden="true">?</span></button></header>
  <div className="walk-stage">
   <div className="walk-canvas" ref={frame} tabIndex={-1} aria-label={"コマ "+map.sequence} data-published-frame={map.sequence} onPointerDown={down} onPointerUp={up} onPointerCancel={()=>{gesture.current=null}}>
    <div className="walk-card-motion" key={map.sequence}><OperatorKomaDisplay map={map} name={card.name} context={card.context} referenceContext={card.referenceContext} layers={layers} reviewed={reviewed} minimal/></div>
   </div>
   {hasNotice&&<section className={"walk-notice"+(card.isFinish?" is-goal":"")} data-walk-goal={card.isFinish?"":undefined} aria-live="polite">
    <div className="walk-notice-icon"><Camera/></div><div>
     {card.checkpoints.map(stop=><div key={stop.id} data-photo-prompt={stop.id}><p className="walk-notice-label">チェックポイント {stop.ordinal} / {course.rally.checkpointIds.length}</p><h2>{stop.name}です。<br/>写真を撮ろう。</h2><p>スマホのカメラで撮影して、ゴールで見せてください。</p></div>)}
     {card.isFinish&&<div><p className="walk-notice-label">GOAL</p><h2>{course.rally.checkpointIds.length?"撮った写真を見せよう。":"ゴール地点です。"}</h2><p>{course.rally.checkpointIds.length?"ゴールに着いたら、スタッフに写真を見せてください。":"おつかれさまでした。"}</p></div>}
    </div>
   </section>}
  </div>
  <nav className="walk-navigation" aria-label="コマを移動"><button type="button" className="walk-previous" aria-label="前のコマ" disabled={index===0} data-published-prev onClick={()=>choose(index-1)}><Arrow back/></button>{index<course.cards.length-1?<button type="button" className="walk-next" data-published-next onClick={()=>choose(index+1)}>次へ<Arrow/></button>:<a href="/courses" className="walk-next" data-walk-exit>コース一覧へ<Arrow/></a>}</nav>
  {reviewed&&<details className="walk-landmark-source"><summary>目印・写真の出典</summary><CourseLandmarkCredits landmarks={reviewed}/></details>}
  <p className="walk-attribution">© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a> · <a href="https://opendatacommons.org/licenses/odbl/1-0/">ODbL</a></p>
  <dialog className="walk-help" ref={help} onClick={event=>{if(event.target===event.currentTarget)help.current?.close()}}><div className="walk-help-heading"><h2>地図の見方</h2><button type="button" className="walk-icon-button" aria-label="見方を閉じる" data-walk-help-close onClick={()=>help.current?.close()}>×</button></div><p>黒点から入り、青い矢印へ進みます。入ってきた道が下です。左右にスワイプしてコマを移動できます。</p><p>{course.rally.checkpointIds.length?<>チェックポイントは{course.rally.checkpointIds.length}か所。該当するコマで写真撮影を案内します。撮影はスマホのカメラを使い、ゴールで写真を見せてください。</>:"このコースに撮影チェックポイントはありません。"}</p><p className="walk-help-safety">安全な場所に立ち止まって操作してください。現地の入口・通行・安全性は確認待ちです。図は道幅や安全な横断位置を表していません。</p>
   <fieldset><legend>地図に表示するもの</legend>{(reviewed?["landmarks"] as const:["buildings","landmarks","details"] as const).map(k=><label key={k}><input type="checkbox" checked={layers[k]} data-published-layer={k} onChange={e=>setLayers(s=>({...s,[k]:e.target.checked}))}/>{{buildings:"建物",landmarks:"目印・標識",details:"道路の階段"}[k]}</label>)}</fieldset>
   <label className="walk-jump">コマを選ぶ<select value={index} data-published-select onChange={e=>{help.current?.close();choose(Number(e.target.value))}}>{course.cards.map((c,i)=><option key={c.map.sequence} value={i}>コマ {c.map.sequence}</option>)}</select></label>
   <p className="walk-help-source">道路・目印：{new Date(course.sourceTime).toLocaleDateString("ja-JP",{timeZone:"Asia/Tokyo"})}時点のOpenStreetMap。茶色の横線は階段、「停」は停止点の記録です。</p>{card.issues.length>0&&<ul>{card.issues.map((issue,i)=><li key={i}>{issue}</li>)}</ul>}
  </dialog>
 </section>;
}
