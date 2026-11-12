import type {KomaContext} from "./context.ts";
export function stairTicks(steps:KomaContext["steps"],mandatory=false){
 return steps.flatMap((step,index)=>{
  const dx=step.to.x-step.from.x,dy=step.to.y-step.from.y,length=Math.hypot(dx,dy);
  if(length<1e-6||length<4&&!mandatory)return [];
  const count=Math.max(mandatory?2:1,Math.floor(length/7));
  return Array.from({length:count},(_,i)=>{const t=(i+.5)/count,x=step.from.x+dx*t,y=step.from.y+dy*t;return {key:index+"-"+i,wayIds:step.wayIds,x1:x-dy/length*5,y1:y+dx/length*5,x2:x+dy/length*5,y2:y-dx/length*5}});
 });
}
