import {arrowPath,KOMA_VIEW,type KomaMap,type KomaBranch,type DiagramPoint} from "./koma.ts";
import type {KomaContext} from "./context.ts";
export const SHORT_ARM_ISSUE="Selected arms too short to distinguish symbols";
const pathLength=(points:DiagramPoint[])=>points.slice(1).reduce((n,p,i)=>n+Math.hypot(p.x-points[i].x,p.y-points[i].y),0);
const scaled=<T extends {x:number;y:number}>(p:T,factor:number):T=>({...p,x:150+(p.x-150)*factor,y:140+(p.y-140)*factor});
function crop(branch:KomaBranch,factor:number):KomaBranch{
 const points:DiagramPoint[]=[scaled(branch.points[0],factor)],sourceSegments:KomaBranch["sourceSegments"]=[];
 let remaining=KOMA_VIEW.radius,cut=false;
 for(let i=1;i<branch.points.length;i++){
  const a=scaled(branch.points[i-1],factor),b=scaled(branch.points[i],factor),pixels=Math.hypot(b.x-a.x,b.y-a.y);
  if(!(pixels>0))throw Error("Invalid diagram segment");
  const fraction=Math.min(1,remaining/pixels);
  points.push(fraction<1?{x:a.x+(b.x-a.x)*fraction,y:a.y+(b.y-a.y)*fraction,nodeId:null}:b);
  sourceSegments.push({...branch.sourceSegments[i-1],fraction:branch.sourceSegments[i-1].fraction*fraction});
  remaining-=pixels*fraction;
  if(fraction<1||remaining<=1e-9){cut=fraction<1||i<branch.points.length-1;break}
 }
 return {...branch,points,sourceSegments,endReason:cut?"limit":branch.endReason,pathPixels:pathLength(points)};
}
function lineDistance(p:DiagramPoint,a:DiagramPoint,b:DiagramPoint){
 const x=b.x-a.x,y=b.y-a.y,t=Math.max(0,Math.min(1,((p.x-a.x)*x+(p.y-a.y)*y)/(x*x+y*y||1)));
 return Math.hypot(p.x-a.x-x*t,p.y-a.y-y*t);
}
// Only operator displays opt in. Geometry remains source-derived and the original held map is untouched.
export function expandShortKoma(map:KomaMap,context:KomaContext,width:number){
 const geometry=map.shortGeometry;
 if(map.state!=="held"||map.issues.length!==1||map.issues[0]!==SHORT_ARM_ISSUE||!geometry||geometry.headingDegrees!==map.headingDegrees||!Number.isFinite(width)||width<160||width>300)return null;
 try{
  if(!geometry.branches.length||geometry.branches.some(b=>b.points.length<2||b.sourceSegments.length!==b.points.length-1||b.points.some(p=>!Number.isFinite(p.x)||!Number.isFinite(p.y))))return null;
  const selected=geometry.branches.filter(b=>b.arrival||b.departure),min=Math.min(...selected.map(b=>pathLength(b.points)));
  if(!(min>0&&min<30))return null;
  const screenScale=width/300;
  let factor=Math.max(1,36/(min*screenScale));
  const returning=selected.find(b=>b.arrival&&b.departure);
  if(returning){
   const inlet=returning.points.at(-1)!,arrow=arrowPath(returning.points).at(-1)!;
   const gap=Math.hypot(inlet.x-arrow.x,inlet.y-arrow.y);
   if(!(gap>0))return null;
   // A short return shares one arm. Scale its real markers apart as well as lengthening the arm.
   // Aim above the existing 14px guard; cropping and all actual clearances are still checked below.
   factor=Math.max(factor,16/(gap*screenScale));
  }
  const branches=geometry.branches.map(b=>crop(b,factor));
  if(branches.filter(b=>b.arrival||b.departure).some(b=>b.pathPixels*screenScale<30))return null;
  const anchors=branches.flatMap(b=>[...(b.arrival?[{neighbor:b.neighborNodeId,point:b.points.at(-1)!}]:[]),...(b.departure?[{neighbor:b.neighborNodeId,point:arrowPath(b.points).at(-1)!}]:[])]);
  if(anchors.some(a=>branches.filter(b=>b.neighborNodeId!==a.neighbor).some(b=>b.points.slice(1).some((p,i)=>lineDistance(a.point,b.points[i],p)*screenScale<12))))return null;
  if(anchors.length===2&&Math.hypot(anchors[0].point.x-anchors[1].point.x,anchors[0].point.y-anchors[1].point.y)*screenScale<14)return null;
  const landmarks=context.landmarks.map(p=>scaled(p,factor)).filter(p=>p.x>=9&&p.x<=291&&p.y>=9&&p.y<=241);
  const stairs=new Set(context.roads.filter(r=>r.highway==="steps").map(r=>r.id));
  const steps=branches.flatMap(b=>b.sourceSegments.flatMap((s,i)=>{const wayIds=s.wayIds.filter(id=>stairs.has(id));return wayIds.length?[{from:b.points[i],to:b.points[i+1],wayIds}]:[]}));
  return {map:{...map,state:"ready" as const,issues:geometry.issues,branches},context:{...context,landmarks,buildings:context.buildings.map(b=>({...b,points:b.points.map(p=>scaled(p,factor))})),steps},
   zoomFactor:factor,extentMeters:30/factor,hiddenLandmarks:context.landmarks.length-landmarks.length};
 }catch{return null}
}
