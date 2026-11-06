import type {Landmark} from "./context.ts";
type Point2D={x:number;y:number};
export type LandmarkLabel={id:string;source:Point2D;x:number;y:number;width:number;height:number;lines:string[]};

// Bound the direct name to two lines; the complete source name remains in title/details.
export function landmarkLabelLines(name:string,kind:string){
  const text=Array.from(name===kind?(kind==="一時停止点"?"停止点":kind==="譲れの制御点"?"譲れ地点":kind==="道路標識"?"標識":""):name),limit=8;
  if(!text.length)return [];
  return [text.slice(0,limit).join(""),...(text.length>limit?[text.slice(limit,limit*2-(text.length>limit*2?1:0)).join("")+(text.length>limit*2?"…":"")]:[])];
}
function blockedRoadLength(a:Point2D,b:Point2D,box:{x:number;y:number;width:number;height:number}){
  let low=0,high=1;
  for(const [start,delta,min,max] of [[a.x,b.x-a.x,box.x-4,box.x+box.width+4],[a.y,b.y-a.y,box.y-4,box.y+box.height+4]]){
    if(Math.abs(delta)<1e-12){if(start<min||start>max)return 0;continue}
    const first=(min-start)/delta,last=(max-start)/delta;
    low=Math.max(low,Math.min(first,last));high=Math.min(high,Math.max(first,last));
    if(low>high)return 0;
  }
  return Math.max(0,high-low)*Math.hypot(b.x-a.x,b.y-a.y);
}
export function layoutLandmarks(features:(Pick<Landmark,"id"|"name"|"kind">&Point2D)[],width:number,height:number,roads:Point2D[][]=[],compact=false):LandmarkLabel[]{
  const labels:LandmarkLabel[]=[];
  for(const feature of features){
    const lines=compact?[]:landmarkLabelLines(feature.name,feature.kind);
    const boxWidth=lines.length?Math.min(118,30+Math.max(...lines.map(line=>Array.from(line).length))*11):26;
    const boxHeight=lines.length>1?36:26;
    const positions=[
      [feature.x+12,feature.y-boxHeight-10],[feature.x-boxWidth-12,feature.y-boxHeight-10],
      [feature.x+12,feature.y+10],[feature.x-boxWidth-12,feature.y+10],
      [feature.x-boxWidth/2,feature.y-boxHeight-25],[feature.x-boxWidth/2,feature.y+25],
      [feature.x+27,feature.y-boxHeight/2],[feature.x-boxWidth-27,feature.y-boxHeight/2],
    ].map(([x,y])=>({x:Math.max(8,Math.min(width-boxWidth-8,x)),y:Math.max(8,Math.min(height-boxHeight-22,y))}));
    const cost=(p:Point2D)=>{
      const overlap=labels.reduce((sum,q)=>sum+Math.max(0,Math.min(p.x+boxWidth+4,q.x+q.width)-Math.max(p.x-4,q.x))*Math.max(0,Math.min(p.y+boxHeight+4,q.y+q.height)-Math.max(p.y-4,q.y)),0);
      const roadCost=roads.reduce((sum,line)=>sum+line.slice(1).reduce((s,b,i)=>s+blockedRoadLength(line[i],b,{...p,width:boxWidth,height:boxHeight}),0),0);
      return roadCost*1_000_000+overlap*25+Math.hypot(p.x+boxWidth/2-feature.x,p.y+boxHeight/2-feature.y)*4;
    };
    const best=positions.reduce((best,p)=>cost(p)<cost(best)?p:best);
    labels.push({id:feature.id,source:{x:feature.x,y:feature.y},...best,width:boxWidth,height:boxHeight,lines});
  }
  return labels;
}
