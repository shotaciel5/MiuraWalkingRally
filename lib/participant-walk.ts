import {maskCheckpointNames,type PublishedCourse} from "./published-course.ts";
import type {KomaContext} from "./route/context.ts";
export function walkCard(course:PublishedCourse,index:number){
 if(!Number.isInteger(index)||index<0||index>=course.cards.length)throw new RangeError("Invalid card index");
 const checkpoints=course.stops.filter(s=>s.kind==="checkpoint"),current=checkpoints.filter(s=>s.komaIndex===index),known=new Set(current.map(s=>s.name));
 const future=[...new Set(checkpoints.filter(s=>s.komaIndex>index&&!known.has(s.name)).map(s=>s.name))].sort((a,b)=>b.length-a.length);
 const text=(value:string)=>maskCheckpointNames(value,future);
 const context=(value:KomaContext):KomaContext=>({...value,landmarks:value.landmarks.map(l=>({...l,name:text(l.name),detail:l.detail?text(l.detail):l.detail})),roads:value.roads.map(r=>({...r,name:text(r.name)}))});
 const card=course.cards[index];
 return {...card,context:context(card.context),referenceContext:card.referenceContext?context(card.referenceContext):null,
  name:current.map(s=>s.name).join(" / ")||"コマ地図",
  checkpoints:current.map(s=>({...s,ordinal:checkpoints.findIndex(c=>c.id===s.id)+1})),
  issues:card.map.issues.map(text),isFinish:card.map.kind==="finish"};
}
export function swipeStep(dx:number,dy:number): -1|0|1{
 if(!Number.isFinite(dx)||!Number.isFinite(dy)||Math.abs(dx)<48||Math.abs(dx)<Math.abs(dy)*1.4)return 0;
 return dx<0?1:-1;
}
