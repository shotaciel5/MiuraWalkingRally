import type {RallyPreview} from "../../operator/rally-preview.ts";
import type {LandmarkSnapshot} from "../../landmarks/course-snapshot.ts";
export function projectOmittedPreview<T extends RallyPreview>(source:T,selected:number[]):T{
 const cards=selected.map((sequence,i)=>{
  const c=source.cards[sequence-1],next=source.cards[(selected[i+1]??0)-1];
  const metersToNext=next?next.map.metersFromStart-c.map.metersFromStart:null;
  return {...c,map:{...c.map,sequence:i+1,metersToNext},candidate:{...c.candidate,sequence:i+1,metersToNext}};
 });
 const visits=source.visits.map(v=>{const komaIndex=cards.findIndex(c=>c.map.stopIds.includes(v.id));if(komaIndex<0)throw Error("Required stop omitted");return {...v,komaIndex}});
 return {...source,cards,visits};
}
export function projectOmittedLandmarks(source:LandmarkSnapshot,selected:number[]):LandmarkSnapshot{
 const cards=selected.map((s,i)=>({...source.cards[s-1],sequence:i+1})),ids=new Set(cards.flatMap(c=>c.candidates.filter(p=>p.kind==="unique").map(p=>p.id.slice(10))));
 return {...source,cards,photos:Object.fromEntries(Object.entries(source.photos).filter(([id])=>ids.has(id)))};
}
