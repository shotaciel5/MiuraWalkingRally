import {CourseError,type SavedCourse} from "./operator/course-format.ts";
import type {CoursePublication} from "./operator/publication.ts";
export function maskCheckpointNames(text:string,names:readonly string[]){return [...new Set(names)].filter(Boolean).sort((a,b)=>b.length-a.length).reduce((result,name)=>result.replaceAll(name,"チェックポイント"),text)}
export function publishedSummary(saved:SavedCourse,publication:CoursePublication){
 if(publication.status!=="published"||publication.courseId!==saved.id||publication.fingerprint!==saved.fingerprint)throw new CourseError("unavailable","公開対象と保存済みコースが一致しません。");
 const p=saved.payload.preview,d=saved.payload.input.draft,areas=new Set([d.start.area,...d.stops.map(s=>s.spot.area),d.finish.area]);
 const hiddenNames=d.stops.filter(s=>s.kind==="checkpoint").map(s=>s.spot.name);
 return {id:saved.id,revision:"published-v1-"+saved.fingerprint,href:"/rallies/"+saved.id,title:maskCheckpointNames(p.title,hiddenNames),publishedAt:publication.publishedAt,
  distanceMeters:p.meters,walkingMinutes:Math.ceil(p.minutes),cardCount:p.cards.length,
  checkpointIds:d.stops.flatMap((s,i)=>s.kind==="checkpoint"?["stop-"+i]:[]),goalStopId:"finish",
  startName:d.stops.some(s=>s.kind==="checkpoint"&&s.spot.name===d.start.name)?"スタート地点":maskCheckpointNames(d.start.name,hiddenNames),finishName:d.stops.some(s=>s.kind==="checkpoint"&&s.spot.name===d.finish.name)?"終了地点":maskCheckpointNames(d.finish.name,hiddenNames),isLoop:d.start.id===d.finish.id,
  area:areas.size>1?"三崎・城ヶ島":areas.has("jogashima-vicinity")?"城ヶ島周辺":"三崎周辺"};
}
export type PublishedRally=ReturnType<typeof publishedSummary>;
export function projectPublishedCourse(saved:SavedCourse,publication:CoursePublication){
 const rally=publishedSummary(saved,publication),d=saved.payload.input.draft,p=saved.payload.preview;
 const stops=[{id:"start",kind:"start" as const,spot:d.start},...d.stops.map((s,i)=>({id:"stop-"+i,kind:s.kind,spot:s.spot})),{id:"finish",kind:"finish" as const,spot:d.finish}].map(s=>{
  const visit=p.visits.find(v=>v.id===s.id);if(!visit)throw new CourseError("unavailable","公開コースの地点対応を確認できません。");
  return {id:s.id,kind:s.kind,name:s.spot.name,description:s.spot.description,role:{"start":"スタート","finish":"終了地点","checkpoint":"チェックポイント","waypoint":"経由地"}[s.kind],komaIndex:visit.komaIndex};
 });
 return {rally,stops,sourceTime:p.source.osmBaseTimestamp,...(saved.payload.formatVersion===2?{landmarks:saved.payload.landmarks,centers:p.cards.map(c=>c.candidate.point)}:{}),cards:p.cards.map(c=>({map:c.map,context:c.context,referenceContext:c.referenceContext,stopIds:c.map.stopIds}))};
}
export type PublishedCourse=ReturnType<typeof projectPublishedCourse>;
