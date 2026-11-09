"use client";
import {useEffect,useState} from "react";
import KomaFigure from "./koma-figure";
import OperatorKomaDisplay from "./operator-koma-display";
import CourseSaveButton from "./course-save-button";
import type {SaveReceipt} from "../lib/operator/course-format";
import LandmarkIcon from "./landmark-icon";
import type {RallyPreview} from "../lib/operator/rally-preview";

export default function RallyPreviewView({data,saved,saveReceipt=null,saveUnavailable}:{data:RallyPreview;saved?:{id:string;createdAt:string};saveReceipt?:SaveReceipt|null;saveUnavailable?:string}){
 const [hydrated,setHydrated]=useState(false);useEffect(()=>setHydrated(true),[]);
 const [index,setIndex]=useState(0),[zoom,setZoom]=useState(1),[layers,setLayers]=useState({buildings:true,landmarks:true,details:true});
 const card=data.cards[index],map=card.map,next=data.cards[index+1];
 const nearby=card.referenceContext??card.context;
 const name=card.stops.map(s=>s.name).join(" / ")||"道路の分岐";
 const extent=[...data.path,...data.visits.map(v=>v.facility)],lat=extent.reduce((sum,p)=>sum+p.lat,0)/extent.length,cos=Math.cos(lat*Math.PI/180);
 const xs=extent.map(p=>p.lon*cos),ys=extent.map(p=>p.lat),minX=Math.min(...xs)-.00035,maxX=Math.max(...xs)+.00035,minY=Math.min(...ys)-.00035,maxY=Math.max(...ys)+.00035;
 const scale=Math.min(760/(maxX-minX),440/(maxY-minY));
 const xy=(p:{lat:number;lon:number})=>[400+(p.lon*cos-(minX+maxX)/2)*scale,240-(p.lat-(minY+maxY)/2)*scale];
 const line=(points:{lat:number;lon:number}[])=>points.map(p=>xy(p).map(n=>n.toFixed(3)).join(",")).join(" ");
 const [cx,cy]=xy(card.candidate.point),vw=800/zoom,vh=480/zoom,vx=Math.max(0,Math.min(800-vw,cx-vw/2)),vy=Math.max(0,Math.min(480-vh,cy-vh/2));
 const pins=[...new Set(data.cards.map(c=>c.map.nodeId))].sort((a,b)=>Number(a===map.nodeId)-Number(b===map.nodeId));
 function choosePin(id:number){const indices=data.cards.flatMap((c,i)=>c.map.nodeId===id?[i]:[]);setIndex(indices.find(i=>i>index)??indices[0])}
 const sourceUrl="https://www.openstreetmap.org/"+card.evidence.kind+"/"+card.evidence.id;
 return <div data-rally-preview data-preview-hydrated={hydrated} data-preview-revision={data.draftRevision} data-preview-count={data.cards.length}>
  <section className="preview-summary" aria-label="生成結果">
   <div><p className="eyebrow">{saved?"SAVED COURSE / REVIEW":"GENERATED COURSE / REVIEW"}</p><h1>{data.title}</h1><p>{saved?"保存済みの計算結果・読取専用（非公開）":"未確認の道路上候補を使った開発用プレビュー"}</p></div>
   <dl><div><dt>道路上の距離</dt><dd data-preview-meters>{Math.round(data.meters).toLocaleString("ja-JP")} m</dd></div><div><dt>歩行時間の概算</dt><dd>約{Math.ceil(data.minutes)}分</dd></div><div><dt>コマ数</dt><dd>{data.cards.length}枚</dd></div></dl>
  </section>
  <p className="operator-scope"><span>現地未確認</span>入口・施設までの通路・通行・安全性は確認待ちです。道路上の移動時間は時速{data.speedKmh}kmの概算で、観光・施設への移動や滞在時間を含みません。</p>
  {saved?<p className="preview-version" data-saved-course-id={saved.id}>保存日時：<time dateTime={saved.createdAt}>{new Date(saved.createdAt).toLocaleString("ja-JP",{timeZone:"Asia/Tokyo"})}</time>。保存時の下書き版{data.draftRevision}・補正版{data.correctionRevision}の計算結果です。台帳や下書きの変更を自動反映しません。</p>:<p className="preview-version">保存済み下書きの版{data.draftRevision}・到達点の補正版{data.correctionRevision}から生成（下書き保存日時：{new Date(data.draftUpdatedAt).toLocaleString("ja-JP",{timeZone:"Asia/Tokyo"})}）。表示後の変更は「最新の保存内容から再生成」で反映します。</p>}
  {saved?<div className="preview-actions" data-saved-course-actions><a href="/operator/courses">保存済み一覧へ</a><a href="/operator/draft">作業中の下書きへ（保存済みは変更しません）</a></div>:<div className="preview-actions"><a href="/operator/connections" data-preview-corrections>道路上の到達点を修正</a><a href="/operator/draft" data-preview-back>下書きを編集</a><a href="/operator/preview" data-preview-regenerate>最新の保存内容から再生成</a></div>}
  {!saved&&<CourseSaveButton receipt={saveReceipt} unavailable={saveUnavailable}/>}
  <section className="preview-panel" aria-labelledby="preview-order-title"><h2 id="preview-order-title">訪問順と道路への候補</h2><p>下書きに並べた順で巡ります。各地点から道路までの直線距離は、道路上の距離に含めていません。</p>
   <ol className="preview-visits">{data.visits.map(v=><li key={v.id} data-preview-visit={v.id}><button type="button" onClick={()=>setIndex(v.komaIndex)}><small>{v.label}</small><strong>{v.name}</strong><span>道路まで直線 {Math.round(v.gap)}m · {v.mode==="manual"?"手動補正・未確認":"自動候補・未確認"}</span></button></li>)}</ol>
   <details><summary>区間別の距離を確認</summary><ol>{data.legs.map((l,i)=><li key={i} data-preview-leg={i+1}>{l.from} → {l.to}：{Math.round(l.meters)}m{l.meters===0?"（道路上の候補が同じ位置）":""}</li>)}</ol></details>
  </section>
  <section className="preview-panel" aria-labelledby="preview-map-title"><h2 id="preview-map-title">全体地図とコマの位置</h2><p>北が上。緑は道路上の生成経路、青は選択中のコマです。番号を選ぶとそのコマへ移ります。同じ位置を再訪する場合は、押すたびに通過順を切り替えます。</p>
   <label className="preview-zoom">地図の拡大<select value={zoom} data-preview-zoom onChange={e=>setZoom(Number(e.target.value))}>{[1,2,4,8].map(z=><option key={z} value={z}>{z===1?"全体":z+"倍・選択中のコマ周辺"}</option>)}</select></label>
   <svg className="preview-overview" viewBox={vx+" "+vy+" "+vw+" "+vh} role="group" aria-label="生成経路とコマ位置の全体地図" data-preview-overview>
    <rect width="800" height="480" fill="#f4f5ed"/>
    <g fill="none" stroke="#ccd3c7" strokeWidth="2">{data.roads.map(r=><polyline key={r.id} points={line(r.points)} data-preview-road={r.id}/>)}</g>
    <g fill="none" strokeLinecap="round" strokeLinejoin="round">{data.legs.map((l,i)=><g key={i}><polyline points={line(l.points)} stroke="white" strokeWidth="8"/><polyline points={line(l.points)} stroke="#17634f" strokeWidth="4" data-preview-path={i}/></g>)}
     {next&&<polyline points={line(data.path.slice(map.pathIndex,next.map.pathIndex+1))} stroke="#246da8" strokeWidth="6" data-preview-next-segment/>}
    </g>
    {data.visits.map(v=>{const [x,y]=xy(v.facility);return <g key={v.id} pointerEvents="none"><polyline points={line([v.facility,v.point])} fill="none" stroke="#9b642f" strokeWidth="2" strokeDasharray="4 5"/><circle cx={x} cy={y} r={5/zoom} fill="white" stroke="#9b642f" strokeWidth="2"/></g>})}
    {pins.map(id=>{const matches=data.cards.map((c,i)=>({c,i})).filter(x=>x.c.map.nodeId===id),chosen=matches.find(x=>x.i===index)??matches[0],[x,y]=xy(chosen.c.candidate.point),active=id===map.nodeId;return <g key={id} role="button" tabIndex={0} aria-pressed={active} aria-label={"コマ "+matches.map(x=>x.i+1).join("・")+" の位置"} onClick={()=>choosePin(id)} onKeyDown={e=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();choosePin(id)}}} data-preview-pin={id} className="preview-pin"><circle cx={x} cy={y} r={(active?12:8)/zoom} fill={active?"#246da8":"white"} stroke={active?"white":"#17634f"} strokeWidth="2"/><text x={x} y={y+.5} textAnchor="middle" dominantBaseline="middle" fill={active?"white":"#17634f"} fontSize={(active?11:8)/zoom} pointerEvents="none">{chosen.i+1}</text></g>})}
   </svg><p className="preview-caption">背景の道路も固定OSMデータです。茶色の白丸は施設の代表位置、点線は道路候補との位置関係を示します。点線は歩ける経路ではありません。</p>
  </section>
  <section className="preview-panel" aria-labelledby="preview-koma-title" data-preview-koma={map.sequence}><h2 id="preview-koma-title">選択中のコマ {index+1} / {data.cards.length}</h2>
   <div className="preview-layer-controls">{(["buildings","landmarks","details"] as const).map(k=><label key={k}><input type="checkbox" checked={layers[k]} data-preview-layer={k} onChange={e=>setLayers(s=>({...s,[k]:e.target.checked}))}/>{{buildings:"建物",landmarks:"目印・標識",details:"道路名・階段"}[k]}</label>)}</div>
   <div className="preview-koma-layout"><div><h3>{name}</h3><OperatorKomaDisplay key={map.sequence} map={map} name={name} context={card.context} referenceContext={card.referenceContext} layers={layers}/><p className="preview-distance">{map.metersToNext===null?"終了地点":"次のコマまで "+Math.round(map.metersToNext)+" m"}<small>出発から {Math.round(map.metersFromStart)}m</small></p>
    <div className="preview-navigation"><button type="button" disabled={index===0} data-preview-prev onClick={()=>setIndex(i=>i-1)}>← 前のコマ</button><button type="button" disabled={index===data.cards.length-1} data-preview-next onClick={()=>setIndex(i=>i+1)}>次のコマ →</button></div>
   </div><div><label>通過順で選択<select value={index} data-preview-select onChange={e=>setIndex(Number(e.target.value))}>{data.cards.map((c,i)=><option key={i} value={i}>#{i+1} {c.stops.map(s=>s.name).join(" / ")||"分岐"}{c.map.shortGeometry?"（近接分岐・拡大確認）":c.map.state==="held"?"（図は確認待ち）":""}</option>)}</select></label>
    {card.stops.map(s=><p className="preview-stop" key={s.id}><b>{data.visits.find(v=>v.id===s.id)?.label}</b> {s.name}<br/><small>未確認の道路上候補です。実際の入口とは限りません。</small></p>)}
    {(map.state==="ready"||map.shortGeometry)&&layers.landmarks&&<><h3>{map.shortGeometry?"周辺30mの目印":"周辺の目印"}</h3>{nearby.landmarks.length?<ul className="preview-landmarks">{nearby.landmarks.map(l=><li key={l.id}><LandmarkIcon symbol={l.symbol}/><span><a href={"https://www.openstreetmap.org/"+l.id} target="_blank" rel="noopener noreferrer">{l.name}</a><small>{l.kind} · 約{Math.round(l.meters)}m{l.detail?" · "+l.detail:""}</small></span></li>)}</ul>:<p>この範囲に表示対象の目印はありません。</p>}</>}
    {layers.details&&(map.state==="ready"||map.shortGeometry)&&<p>道路名：{[...new Set(nearby.roads.map(r=>r.name).filter(Boolean))].join(" / ")||"OSMの記録なし"}</p>}
    <details><summary>形状・出典・確認事項</summary><p><a href={sourceUrl} target="_blank" rel="noopener noreferrer">OSMの元{card.evidence.kind==="way"?"道路":"地点"}を見る</a>{card.evidence.kind==="way"?" · 道路の途中に置いた一時的な候補点です。":""}</p><p>元データに接続する枝は{card.candidate.branches.length}本。元の角度と局所形状を使い、各枝30m以内を描画します。道幅や安全な横断位置は示しません。停止点・標識の対象方向は現地確認が必要です。</p>{map.issues.length>0&&<ul>{map.issues.map((s,i)=><li key={i}>{s}</li>)}</ul>}</details>
   </div></div>
  </section>
  <section className="preview-panel" aria-labelledby="preview-list-title"><h2 id="preview-list-title">コマ一覧</h2><p>省略せず通過順に表示します。図が保留のコマは全体地図と根拠を確認してください。</p><div className="preview-card-grid">{data.cards.map((c,i)=><button type="button" key={i} aria-pressed={i===index} data-preview-card={i} onClick={()=>setIndex(i)}><b>#{i+1} {c.stops.map(s=>s.name).join(" / ")||"分岐"}</b><KomaFigure map={c.map} referenceGeometry={c.map.shortGeometry} name={c.stops.map(s=>s.name).join(" / ")||"分岐"} context={c.referenceContext??c.context} layers={{buildings:false,landmarks:false,details:false}} compact/><span>{c.map.shortGeometry?"近接分岐・拡大して確認":c.map.state==="held"?"図は確認待ち":"累積 "+Math.round(c.map.metersFromStart)+"m"}</span></button>)}</div></section>
  <p className="preview-caption">道路・建物・目印 © <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a> · ODbL 1.0。道路は{new Date(data.source.osmBaseTimestamp).toLocaleDateString("ja-JP",{timeZone:"Asia/Tokyo"})}時点の固定データです。{saved?"保存時の計算結果を表示しています。非公開・現地未確認です。":"保存は「この結果を保存」から行います。保存済みコースは非公開です。"}</p>
 </div>;
}
