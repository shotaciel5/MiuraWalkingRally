import LandmarkIcon from "./landmark-icon";
import {layoutLandmarks} from "../lib/route/landmark-layout";
import type {Landmark} from "../lib/route/context";
type DisplayLandmark=Landmark&{x:number;y:number};

export default function LandmarkLayer({features,width,height,roads=[],compact=false,overview=false}:{features:DisplayLandmark[];width:number;height:number;roads?:{x:number;y:number}[][];compact?:boolean;overview?:boolean}){
  const labels=layoutLandmarks(features,width,height,roads,compact);
  return <g className="landmark-layer">{features.map((feature,i)=>{
    const label=labels[i];
    return <g key={feature.id} data-context-landmark={overview?undefined:feature.id} data-overview-landmark={overview?feature.id:undefined} data-landmark-symbol={feature.symbol} aria-label={feature.name+" · "+feature.kind}>
      <title>{feature.name+" · "+feature.kind+(feature.detail?" · "+feature.detail:"")}</title>
      <circle cx={feature.x} cy={feature.y} r={compact?2:2.3} fill="#79551d" stroke="white" strokeWidth=".7"/>
      <path d={`M${feature.x} ${feature.y}L${label.x+label.width/2} ${label.y+label.height/2}`} stroke="#9a885f" strokeWidth=".9" fill="none"/>
      <g data-landmark-label={feature.id} transform={`translate(${label.x} ${label.y})`}>
        <rect width={label.width} height={label.height} rx="5" fill="#fffef8" fillOpacity=".96" stroke="#d3c9af" strokeWidth=".7"/>
        <LandmarkIcon symbol={feature.symbol} size={22} x={2} y={(label.height-22)/2}/>
        {label.lines.map((line,j)=><text key={j} x="28" y={label.height/2+(j-(label.lines.length-1)/2)*13+4} fontSize="11" fontWeight="600" fill="#404c53" data-landmark-name={j===0?feature.id:undefined}>{line}</text>)}
      </g>
    </g>;
  })}</g>;
}
