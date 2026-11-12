import {loadLandmarkDataset} from "./dataset.ts";
import {getLandmarkStorage,type LandmarkStorage} from "./storage.ts";
import {bundledRegionInfo} from "./bundled.ts";
import {candidatesForCard,choiceKey,type Dataset,type Review,type TargetCache,type PhotoAsset,type PhotoFailure} from "./model.ts";
export type WorkbenchState={dataset:Dataset;review:Review;targets:Record<string,TargetCache>;assets:Record<string,PhotoAsset>;photoFailures:Record<string,PhotoFailure>;configured:boolean;bundleId:string|null;mode:"bundled-only";region:typeof bundledRegionInfo};
export function workbenchState(dataset:Dataset,storage:LandmarkStorage=getLandmarkStorage()):WorkbenchState{
 const targets:Record<string,TargetCache>={},assets:Record<string,PhotoAsset>={};
 for(const t of dataset.targets){const c=storage.target(t.key,t.point);if(c){targets[t.key]=c;for(const candidate of c.candidates){const asset=storage.asset(candidate.id.slice(10));if(asset)assets[candidate.id.slice(10)]=asset}}}
 return {dataset,review:storage.review(dataset.id),targets,assets,photoFailures:{},configured:false,bundleId:storage.bundleId,mode:"bundled-only",region:bundledRegionInfo};
}
export async function operateWorkbench(input:unknown,storage=getLandmarkStorage()){
 if(!input||typeof input!=="object"||Array.isArray(input))throw Error("invalid-input");
 const value=input as Record<string,unknown>;if(value.action==="prepare"||value.action==="photo")throw Error("external-fetch-disabled");
 if(value.action!=="save"||Object.keys(value).some(k=>!["action","source","datasetId","expectedRevision","choices"].includes(k))||(value.source!=="sample"&&value.source!=="draft"))throw Error("invalid-input");
 const dataset=loadLandmarkDataset(value.source);if(value.datasetId!==dataset.id)throw Error("dataset-conflict");
 if(!Number.isSafeInteger(value.expectedRevision)||Number(value.expectedRevision)<0||!value.choices||typeof value.choices!=="object"||Array.isArray(value.choices))throw Error("invalid-input");
 const state=workbenchState(dataset,storage),keys=new Set(dataset.cards.flatMap(card=>{const target=dataset.targets.find(t=>t.sequences.includes(card.map.sequence));return candidatesForCard(card,target?state.targets[target.key]:undefined).map(c=>choiceKey(card.map.sequence,c.id))}));
 const entries=Object.entries(value.choices);if(entries.length>10000||entries.some(([k,v])=>!keys.has(k)||typeof v!=="boolean"))throw Error("invalid-choices");
 storage.saveReview(dataset.id,Number(value.expectedRevision),Object.fromEntries(entries) as Record<string,boolean>);
 return workbenchState(dataset,storage);
}
