import {loadLandmarkDataset} from "./dataset.ts";
import {createLandmarkStorage,type LandmarkStorage} from "./storage.ts";
import {createMapillaryClient} from "./mapillary.ts";
import {candidatesForCard,choiceKey,type Dataset,type Review,type TargetCache,type PhotoAsset} from "./model.ts";
export type WorkbenchState={dataset:Dataset;review:Review;targets:Record<string,TargetCache>;assets:Record<string,PhotoAsset>;configured:boolean};
export function workbenchState(dataset:Dataset,storage:LandmarkStorage=createLandmarkStorage()):WorkbenchState{
 const targets:Record<string,TargetCache>={},assets:Record<string,PhotoAsset>={};
 for(const t of dataset.targets){const c=storage.target(t.key);if(c){targets[t.key]=c;for(const candidate of c.candidates)if(candidate.provider==="mapillary"){const id=candidate.id.slice(10),asset=storage.asset(id);if(asset)assets[id]=asset}}}
 return {dataset,review:storage.review(dataset.id),targets,assets,configured:!!process.env.MAPILLARY_ACCESS_TOKEN?.trim()};
}
const inFlight=new Map<string,Promise<unknown>>();
async function once<T>(key:string,run:()=>Promise<T>):Promise<T>{const pending=inFlight.get(key);if(pending)return pending as Promise<T>;const result=run();inFlight.set(key,result);try{return await result}finally{inFlight.delete(key)}}
export async function operateWorkbench(input:unknown,storage=createLandmarkStorage(),client=createMapillaryClient(process.env.MAPILLARY_ACCESS_TOKEN)){
 if(!input||typeof input!=="object"||Array.isArray(input))throw Error("invalid-input");
 const value=input as Record<string,unknown>,action=value.action;
 const allowed=action==="prepare"?["action","source","datasetId","targetKey"]:action==="photo"?["action","source","datasetId","candidateId"]:action==="save"?["action","source","datasetId","expectedRevision","choices"]:[];
 if(!allowed.length||Object.keys(value).some(k=>!allowed.includes(k))||(value.source!=="sample"&&value.source!=="draft"))throw Error("invalid-input");
 const dataset=loadLandmarkDataset(value.source as "sample"|"draft");if(value.datasetId!==dataset.id)throw Error("dataset-conflict");
 if(action==="prepare"){
  const target=dataset.targets.find(t=>t.key===value.targetKey);if(!target||dataset.targets.indexOf(target)>=20)throw Error("invalid-target");
  if(!storage.target(target.key))await once(storage.root+":target:"+target.key,async()=>storage.saveTarget(await client.target(target)));
 }else if(action==="photo"){
  const state=workbenchState(dataset,storage),candidate=Object.values(state.targets).flatMap(t=>t.candidates).find(c=>c.id===value.candidateId);
  if(!candidate)throw Error("invalid-candidate");
  await once(storage.root+":photo:"+candidate.id,()=>client.photo(candidate,storage));
 }else{
  if(!Number.isSafeInteger(value.expectedRevision)||Number(value.expectedRevision)<0||!value.choices||typeof value.choices!=="object"||Array.isArray(value.choices))throw Error("invalid-input");
  const state=workbenchState(dataset,storage),keys=new Set(dataset.cards.flatMap(card=>{const target=dataset.targets.find(t=>t.sequences.includes(card.map.sequence));return candidatesForCard(card,target?state.targets[target.key]:undefined).map(c=>choiceKey(card.map.sequence,c.id))}));
  const entries=Object.entries(value.choices);if(entries.length>10000||entries.some(([k,v])=>!keys.has(k)||typeof v!=="boolean"))throw Error("invalid-choices");
  storage.saveReview(dataset.id,Number(value.expectedRevision),Object.fromEntries(entries) as Record<string,boolean>);
 }
 return workbenchState(dataset,storage);
}
