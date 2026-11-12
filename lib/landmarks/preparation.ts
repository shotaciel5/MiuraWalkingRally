import {distanceMeters} from "../route/graph.ts";
import {candidatesForCard,type Candidate,type Dataset,type TargetCache,type PhotoAsset,type PhotoFailure} from "./model.ts";
export const PREPARATION_LIMITS={junctions:20,photos:3,photoCandidates:8} as const;
export type PreparationState={dataset:Dataset;targets:Record<string,TargetCache>;assets:Record<string,PhotoAsset>;photoFailures:Record<string,PhotoFailure>};
export function photoSuggestions(state:PreparationState){
 const found=new Map<string,{candidate:Candidate;asset:PhotoAsset;sequences:number[]}>();
 for(const card of state.dataset.cards){const target=state.dataset.targets.find(t=>t.sequences.includes(card.map.sequence));for(const candidate of candidatesForCard(card,target?state.targets[target.key]:undefined)){if(candidate.kind!=="unique"||candidate.provider!=="mapillary")continue;const asset=state.assets[candidate.id.slice(10)];if(!asset)continue;const item=found.get(candidate.id)??{candidate,asset,sequences:[]};item.sequences.push(card.map.sequence);found.set(candidate.id,item)}}
 return [...found.values()].sort((a,b)=>a.sequences[0]-b.sequences[0]||a.candidate.id.localeCompare(b.candidate.id,"en"));
}
export function photoPreparationPlan(state:PreparationState){
 const visible=new Set(state.dataset.cards.flatMap(card=>{const t=state.dataset.targets.find(t=>t.sequences.includes(card.map.sequence));return candidatesForCard(card,t?state.targets[t.key]:undefined).filter(c=>c.kind==="unique"&&c.provider==="mapillary").map(c=>c.id)}));
 const priority=(c:Candidate)=>c.classification==="object--sign--store"?0:c.classification==="object--sign--advertisement"?1:2;
 const groups=state.dataset.targets.map(t=>({target:t,items:(state.targets[t.key]?.candidates??[]).filter(c=>visible.has(c.id)).sort((a,b)=>priority(a)-priority(b)||distanceMeters(t.point,a.point)-distanceMeters(t.point,b.point)||a.id.localeCompare(b.id,"en"))})).filter(g=>g.items.length);
 const ordered:typeof groups=[];while(groups.length){let next=0;if(ordered.length){let best=-1;for(let i=0;i<groups.length;i++){const gap=Math.min(...ordered.map(g=>distanceMeters(g.target.point,groups[i].target.point)));if(gap>best){best=gap;next=i}}}ordered.push(groups.splice(next,1)[0])}
 const seen=new Set<string>(),result:Candidate[]=[];for(let depth=0;depth<200&&result.length<PREPARATION_LIMITS.photoCandidates;depth++)for(const group of ordered){const c=group.items[depth];if(c&&!seen.has(c.id)){seen.add(c.id);result.push(c);if(result.length===PREPARATION_LIMITS.photoCandidates)break}}
 return result;
}
export function needsPreparation(state:PreparationState){return state.dataset.targets.some(t=>!state.targets[t.key])||photoSuggestions(state).length<PREPARATION_LIMITS.photos&&photoPreparationPlan(state).some(c=>!state.assets[c.id.slice(10)]&&!state.photoFailures[c.id.slice(10)])}
export type PreparationReport={version:1;datasetId:string;targets:number;preparedTargets:number;remainingTargets:number;photoCandidates:string[];photoRequests:number;readyPhotos:number;qualityMisses:number;stopped:boolean;errors:{stage:"junction"|"photo";id:string;code:string}[]};
export async function runLandmarkPreparation<S extends PreparationState>(options:{initial:S;target:(key:string)=>Promise<S>;photo:(id:string)=>Promise<S>;onState?:(state:S)=>void;onProgress?:(stage:"junction"|"photo",done:number,total:number)=>void;shouldStop?:()=>boolean;junctionLimit?:number}){
 const limit=options.junctionLimit??PREPARATION_LIMITS.junctions;if(!Number.isInteger(limit)||limit<1||limit>200)throw Error("invalid-junction-limit");
 let state=options.initial,blocked=false,failures=0;
 const report:PreparationReport={version:1,datasetId:state.dataset.id,targets:state.dataset.targets.length,preparedTargets:0,remainingTargets:0,photoCandidates:[],photoRequests:0,readyPhotos:0,qualityMisses:0,stopped:false,errors:[]};
 const fail=(stage:"junction"|"photo",id:string,error:unknown)=>{const raw=error&&typeof error==="object"&&"code" in error?String(error.code):"unavailable",code=/^[a-z0-9-]{1,50}$/.test(raw)?raw:"unavailable";report.errors.push({stage,id,code});if(++failures>=2||["authorization","rate-limit","not-configured","dataset-conflict"].includes(code))blocked=true};
 const missing=state.dataset.targets.filter(t=>!state.targets[t.key]).slice(0,limit);
 for(const [i,t]of missing.entries()){if(options.shouldStop?.()){report.stopped=true;break}options.onProgress?.("junction",i+1,missing.length);try{const next=await options.target(t.key);if(next.dataset.id!==report.datasetId)throw Object.assign(Error("Route changed"),{code:"dataset-conflict"});state=next;options.onState?.(state)}catch(e){fail("junction",t.key,e);if(blocked)break}}
 const plan=photoPreparationPlan(state);report.photoCandidates=plan.map(c=>c.id);
 if(!blocked&&!report.stopped)for(const [i,candidate]of plan.entries()){if(photoSuggestions(state).length>=PREPARATION_LIMITS.photos)break;if(options.shouldStop?.()){report.stopped=true;break}const id=candidate.id.slice(10);if(state.assets[id]||state.photoFailures[id])continue;options.onProgress?.("photo",i+1,plan.length);report.photoRequests++;try{const next=await options.photo(candidate.id);if(next.dataset.id!==report.datasetId)throw Object.assign(Error("Route changed"),{code:"dataset-conflict"});state=next;options.onState?.(state)}catch(e){fail("photo",candidate.id,e);if(blocked)break}}
 report.preparedTargets=state.dataset.targets.filter(t=>state.targets[t.key]).length;report.remainingTargets=report.targets-report.preparedTargets;report.readyPhotos=photoSuggestions(state).length;report.qualityMisses=plan.filter(c=>state.photoFailures[c.id.slice(10)]).length;
 return {state,report};
}
