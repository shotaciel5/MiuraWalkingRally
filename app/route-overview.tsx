"use client";
import {useEffect,useRef,useState} from "react";
import {overviewStops,nextStopIndex} from "../lib/operator/overview-markers";
import type {RallyPreview} from "../lib/operator/rally-preview";
type Props={data:RallyPreview;index:number;onSelect:(index:number)=>void};
export default function RouteOverview({data,index,onSelect}:Props){
 const host=useRef<HTMLDivElement>(null),[size,setSize]=useState({width:800,height:560}),[zoom,setZoom]=useState(1);
 useEffect(()=>{if(!host.current||typeof ResizeObserver==="undefined")return;const observer=new ResizeObserver(([entry])=>{const {width,height}=entry.contentRect;if(width>0&&height>0)setSize(s=>Math.abs(s.width-width)>1||Math.abs(s.height-height)>1?{width,height}:s)});observer.observe(host.current);return()=>observer.disconnect()},[]);
 const map=data.cards[index].map,next=data.cards[index+1],width=800,height=Math.max(420,Math.min(1100,800*size.height/Math.max(1,size.width)));
 const extent=[...data.path,...data.visits.map(v=>v.facility)],lat=extent.reduce((sum,p)=>sum+p.lat,0)/extent.length,cos=Math.cos(lat*Math.PI/180);
 const xs=extent.map(p=>p.lon*cos),ys=extent.map(p=>p.lat),minX=Math.min(...xs)-.00035,maxX=Math.max(...xs)+.00035,minY=Math.min(...ys)-.00035,maxY=Math.max(...ys)+.00035;
 const scale=Math.min((width-140)/(maxX-minX),(height-120)/(maxY-minY));
 const xy=(p:{lat:number;lon:number})=>[width/2+(p.lon*cos-(minX+maxX)/2)*scale,height/2-(p.lat-(minY+maxY)/2)*scale];
 const points=(p:{lat:number;lon:number}[])=>p.map(p=>xy(p).map(n=>n.toFixed(3)).join(",")).join(" ");
 const [cx,cy]=xy(data.cards[index].candidate.point),vw=width/zoom,vh=height/zoom,vx=Math.max(0,Math.min(width-vw,cx-vw/2)),vy=Math.max(0,Math.min(height-vh,cy-vh/2));
 const unit=width/Math.max(1,size.width)/zoom;
 const pins=[...new Set(data.cards.map(c=>c.map.nodeId))].sort((a,b)=>Number(a===map.nodeId)-Number(b===map.nodeId));
 function choose(id:number){const matches=data.cards.flatMap((c,i)=>c.map.nodeId===id?[i]:[]);onSelect(matches.find(i=>i>index)??matches[0])}
 const placed:{x:number;y:number;w:number;h:number}[]=[];
 const stops=overviewStops(data.visits).map(g=>{
  const [x,y]=xy(g.point),w=Math.min(270,Math.max(140,Math.min(g.name.length,12)*12+Math.max(30,g.badge.length*10+14)+20))*unit,h=46*unit;
  const visible=x>=vx&&x<=vx+vw&&y>=vy&&y<=vy+vh;
  const candidates=[[x+17*unit,y-h/2],[x-w-17*unit,y-h/2],[x-w/2,y-h-24*unit],[x-w/2,y+24*unit],[x+17*unit,y-h-30*unit],[x-w-17*unit,y+30*unit]];
  const rects=candidates.map(([a,b])=>({x:Math.max(vx+6*unit,Math.min(vx+vw-w-6*unit,a)),y:Math.max(vy+6*unit,Math.min(vy+vh-h-6*unit,b)),w,h}));
  const overlap=(r:typeof rects[number])=>placed.reduce((sum,p)=>sum+Math.max(0,Math.min(r.x+r.w,p.x+p.w)-Math.max(r.x,p.x))*Math.max(0,Math.min(r.y+r.h,p.y+p.h)-Math.max(r.y,p.y)),0);
  const label=rects.reduce((best,r)=>overlap(r)<overlap(best)?r:best,rects[0]);if(visible)placed.push(label);
  return {...g,x,y,visible,label};
 });
 return <section className="preview-panel preview-map-panel" aria-labelledby="preview-map-title" data-preview-map-panel>
  <div className="preview-map-heading"><div><h2 id="preview-map-title">全体地図とコマの位置</h2><p>番号・地点名を押すと、そのコマへ移動</p></div><label className="preview-zoom">表示<select value={zoom} data-preview-zoom onChange={e=>setZoom(Number(e.target.value))}>{[1,2,4,8].map(z=><option key={z} value={z}>{z===1?"全体":z+"倍"}</option>)}</select></label></div>
  <div className="preview-route-legend" aria-label="地図の凡例"><span><b className="route-start">S</b>スタート</span><span><b className="route-finish">G</b>ゴール</span><span><b className="route-checkpoint">CP</b>チェックポイント</span><span className="route-current-key">選択中の区間</span></div>
  <div className="preview-map-viewport" ref={host}><svg className="preview-overview" viewBox={[vx,vy,vw,vh].join(" ")} role="group" aria-label="生成経路とコマ位置の全体地図" data-preview-overview>
   <rect width={width} height={height} fill="#f3f6f3"/>
   <g fill="none" stroke="#c7d3d6" strokeWidth="2">{data.roads.map(r=><polyline key={r.id} points={points(r.points)} data-preview-road={r.id}/>)}</g>
   <g fill="none" strokeLinecap="round" strokeLinejoin="round">{data.legs.map((leg,i)=><g key={i}><polyline points={points(leg.points)} stroke="white" strokeWidth="9"/><polyline points={points(leg.points)} stroke="#174b66" strokeWidth="4" data-preview-path={i}/></g>)}{next&&<polyline points={points(data.path.slice(map.pathIndex,next.map.pathIndex+1))} stroke="var(--accent)" strokeWidth="7" data-preview-next-segment/>}</g>
   {data.visits.map(v=>{const [x,y]=xy(v.facility);return <g key={v.id} pointerEvents="none"><polyline points={points([v.facility,v.point])} fill="none" stroke="#9b642f" strokeWidth="1.7" strokeDasharray="4 5"/><circle cx={x} cy={y} r={4*unit} fill="white" stroke="#9b642f" strokeWidth="1.5"/></g>})}
   {pins.map(id=>{const matches=data.cards.map((c,i)=>({c,i})).filter(v=>v.c.map.nodeId===id),chosen=matches.find(v=>v.i===index)??matches[0],[x,y]=xy(chosen.c.candidate.point),active=id===map.nodeId;return <g key={id} role="button" tabIndex={0} aria-pressed={active} aria-label={"コマ "+matches.map(v=>v.i+1).join("・")+" の位置"} onClick={()=>choose(id)} onKeyDown={e=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();choose(id)}}} data-preview-pin={id} className="preview-pin"><circle cx={x} cy={y} r={16*unit} fill="transparent" stroke="none"/><circle cx={x} cy={y} r={(active?13:8)*unit} fill={active?"var(--accent)":"white"} stroke={active?"white":"#174b66"} strokeWidth="2"/><text x={x} y={y+.5*unit} textAnchor="middle" dominantBaseline="middle" fill={active?"white":"#174b66"} fontSize={(active?12:9)*unit} pointerEvents="none">{chosen.i+1}</text></g>})}
   {stops.map(g=>{const checkpoint=g.visits.some(v=>v.kind==="checkpoint"),finish=g.visits.some(v=>v.kind==="finish"),roundTrip=finish&&g.visits.some(v=>v.kind==="start"),color=roundTrip?"#174b66":checkpoint?"#b85b2d":finish?"#b34d3b":"#174b66",label=g.label,active=g.visits.some(v=>v.komaIndex===index),badgeWidth=Math.max(30,g.badge.length*10+14)*unit;return <g key={g.key} className="preview-stop-pin" data-preview-stop={g.visits.map(v=>v.id).join(" ")} role="button" tabIndex={0} aria-pressed={active} aria-label={g.visits.map(v=>v.label+" "+v.name+" コマ"+(v.komaIndex+1)).join("、")} onClick={()=>onSelect(nextStopIndex(g,index))} onKeyDown={e=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();onSelect(nextStopIndex(g,index))}}}><title>{g.visits.map(v=>v.label+"："+v.name).join(" / ")+(g.visits.length>1?"（押すたびに通過順を切替）":"")}</title><circle cx={g.x} cy={g.y} r={(active?13:10)*unit} fill={color} stroke="white" strokeWidth="3"/>{g.visible&&<><path d={"M"+g.x+","+g.y+"L"+(label.x+label.w/2)+","+(label.y+label.h/2)} stroke={color} strokeWidth="1.5" fill="none" pointerEvents="none"/><rect x={label.x} y={label.y} width={label.w} height={label.h} rx={7*unit} fill="white" stroke={color} strokeWidth={active?3:1.8}/><rect x={label.x} y={label.y} width={badgeWidth} height={label.h} rx={6*unit} fill={color}/>{roundTrip&&<rect x={label.x+badgeWidth/2} y={label.y} width={badgeWidth/2} height={label.h} rx={5*unit} fill="#b34d3b"/>}<text x={label.x+badgeWidth/2} y={label.y+label.h/2} dominantBaseline="middle" textAnchor="middle" fill="white" fontSize={13*unit} fontWeight="700">{g.badge}</text><text x={label.x+badgeWidth+7*unit} y={label.y+label.h/2} dominantBaseline="middle" fill="#203744" fontSize={12*unit} fontWeight="700">{g.name.length>12?g.name.slice(0,11)+"…":g.name}</text></>}</g>})}
  </svg><span className="preview-map-north" aria-label="北が上">↑ N</span></div>
  <p className="preview-caption">S・G・CPは道路上の到達点。茶色の点は施設の代表位置、点線は位置関係で、歩行経路ではありません。背景は固定OSM道路です。</p>
 </section>;
}
