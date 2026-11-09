"use client";
import {useRef,useState} from "react";
import type {PublishedCourse} from "../lib/published-course";
import OperatorKomaDisplay from "./operator-koma-display";
export default function PublishedNavigator({course}:{course:PublishedCourse}){
 const [index,setIndex]=useState(0),[layers,setLayers]=useState({buildings:true,landmarks:true,details:true}),heading=useRef<HTMLHeadingElement>(null),card=course.cards[index],map=card.map,stops=course.stops.filter(s=>card.stopIds.includes(s.id));
 function choose(next:number){setIndex(next);requestAnimationFrame(()=>{heading.current?.focus({preventScroll:true});heading.current?.scrollIntoView({block:"start"})})}
 const name=stops.map(s=>s.name).join(" / ")||"道路の分岐";
 return <section className="participant-navigation" aria-label="コマ地図と訪問地点" data-published-navigator data-published-count={course.cards.length}>
  <div className="participant-navigation-layout">
   <section className="participant-panel participant-frame" aria-labelledby="published-card-title" data-published-frame={map.sequence}>
    <div className="participant-frame-heading"><p className="eyebrow" role="status" aria-live="polite" aria-atomic="true">コマ {map.sequence} / {course.cards.length}</p><span>{map.kind==="return"?"同じ道を戻る":map.kind==="start"?"出発地点":map.kind==="finish"?"終了地点":"分岐"}</span></div>
    <h2 id="published-card-title" ref={heading} tabIndex={-1}>{name}</h2>
    <p className="participant-figure-guide">{map.kind==="start"?"黒点が出発点です。緑の矢印の枝へ進みます。":map.kind==="finish"?"黒点の道から、図の中央の終了地点へ進みます。":map.kind==="return"?"黒点の道から入り、緑の矢印へ同じ道を戻ります。":"黒点の道から入り、緑の矢印の枝へ進みます。入ってきた道が下です。"}</p>
    <div className="preview-layer-controls">{(["buildings","landmarks","details"] as const).map(k=><label key={k}><input type="checkbox" checked={layers[k]} data-published-layer={k} onChange={e=>setLayers(s=>({...s,[k]:e.target.checked}))}/>{{buildings:"建物",landmarks:"目印・標識",details:"道路名・階段"}[k]}</label>)}</div>
    <div className="participant-figure"><OperatorKomaDisplay key={map.sequence} map={map} name={name} context={card.context} referenceContext={card.referenceContext} layers={layers}/></div>
    <div className="koma-distance" data-published-distance={map.metersToNext??""}><span>{map.metersToNext===null?"最後のコマを表示しています":"次のコマまで"}</span>{map.metersToNext!==null&&<strong>{Math.round(map.metersToNext)}<small> m</small></strong>}<span className="koma-cumulative">出発から {Math.round(map.metersFromStart)}m</span></div>
    <div className="koma-navigation"><button type="button" disabled={index===0} data-published-prev onClick={()=>choose(index-1)}>← 前のコマ</button><button type="button" disabled={index===course.cards.length-1} data-published-next onClick={()=>choose(index+1)}>次のコマ →</button></div>
    <label className="participant-koma-select">閲覧するコマ<select value={index} data-published-select onChange={e=>choose(Number(e.target.value))}>{course.cards.map((c,i)=><option key={c.map.sequence} value={i}>#{c.map.sequence} {course.stops.filter(s=>c.stopIds.includes(s.id)).map(s=>s.name).join(" / ")||"分岐"}{c.map.shortGeometry?"（拡大確認）":c.map.state==="held"?"（図は確認待ち）":""}</option>)}</select></label>
    <div className="participant-spot-details">{stops.map(s=><article className="participant-spot" key={s.id} data-published-stop={s.id}><p className="participant-stop-role">{s.role}</p><h3>{s.name}</h3><p>{s.description||"施設の入口・通路や利用条件を現地で確認してください。"}</p><p className="participant-note">写真は未登録です。</p></article>)}</div>
    {map.kind==="finish"&&<p className="participant-finish-note">コース図の最後です。終了地点の案内を確認してください。</p>}
    <details className="participant-map-notes"><summary>図の見方・出典</summary><p>道路の角度と曲がりを切り出した模式図です。道幅・歩道・安全な横断位置は表しません。近接分岐では拡大図と30m参照図を確認してください。</p><p>茶色の横線は階段、「停」の記号は停止点の記録です。標識の対象方向は現地確認が必要です。</p><p>道路・目印は{new Date(course.sourceTime).toLocaleDateString("ja-JP",{timeZone:"Asia/Tokyo"})}時点の固定データです。</p>{map.issues.length>0&&<ul>{map.issues.map((issue,i)=><li key={i}>{issue}</li>)}</ul>}</details>
    <p className="map-attribution">道路・目印 © <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a> · <a href="https://opendatacommons.org/licenses/odbl/1-0/">ODbL 1.0</a></p>
   </section>
   <aside className="participant-panel participant-checkpoints" aria-labelledby="published-stops-title"><p className="eyebrow">PLACES</p><h2 id="published-stops-title">訪問する地点</h2><p className="participant-note">地点を選ぶと対応するコマを表示します。閲覧は到着や達成の記録にはなりません。</p><ol className="published-stop-nav">{course.stops.map(s=><li key={s.id}><span>{s.role}</span><button type="button" data-published-visit={s.id} aria-pressed={index===s.komaIndex} onClick={()=>choose(s.komaIndex)}>{s.name}<small>コマ #{s.komaIndex+1} を見る →</small></button></li>)}</ol><p className="participant-note">閲覧位置は保存せず、再読込みでは最初のコマを表示します。</p></aside>
  </div>
 </section>;
}
