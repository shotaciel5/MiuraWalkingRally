import LandmarkIcon from "./landmark-icon";
import {visualLandmarks,type SymbolLimit} from "../lib/route/visual-landmarks";
import type {KomaContext} from "../lib/route/context";
import type {KomaBranch} from "../lib/route/koma";
export default function SymbolLandmarkLayer({context,branches,limit=2}:{context:KomaContext;branches:KomaBranch[];limit?:SymbolLimit}){
 const {placements}=visualLandmarks(context,branches,limit);
 return <g data-symbol-layer data-symbol-count={placements.length}>{placements.map(({feature,x,y,size})=><g key={feature.id} data-symbol-landmark={feature.id} aria-label={feature.kind+"。OSMの記録で、現地の位置と見え方は未確認です。"}>
  <circle cx={feature.x} cy={feature.y} r="1.8" fill="#79551d"/>
  <path d={"M"+feature.x+" "+feature.y+"L"+(x+size/2)+" "+(y+size/2)} stroke="#9a885f" strokeWidth=".8" fill="none"/>
  <g transform={"translate("+x+" "+y+")"} data-symbol-badge={feature.id}><rect width={size} height={size} rx="8" fill="var(--paper)" fillOpacity=".98" stroke="var(--line)" strokeWidth=".9"/><LandmarkIcon symbol={feature.symbol} size={24} x={4} y={4}/></g>
 </g>)}</g>;
}
