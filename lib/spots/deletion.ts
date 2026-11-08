import {validSpotId,SpotError,type ManagedSpot} from "./editing.ts";
export type SpotDeleteInput={id:string;expectedRevision:number};
export type SpotDeletion={id:string;name:string;deletedFromRevision:number;revision:number;deletedAt:string};
const object=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==="object"&&!Array.isArray(v);
const revision=(v:unknown):v is number=>Number.isSafeInteger(v)&&Number(v)>=0&&Number(v)<Number.MAX_SAFE_INTEGER;
export function parseSpotDeleteInput(value:unknown):SpotDeleteInput{
  if(!object(value)||Object.keys(value).some(k=>!["id","expectedRevision"].includes(k))
    ||typeof value.id!=="string"||!validSpotId(value.id)||!revision(value.expectedRevision))
    throw new SpotError("invalid","削除するスポットIDと編集の版を確認してください。");
  return {id:value.id,expectedRevision:value.expectedRevision};
}
export function parseSpotDeletion(value:unknown):SpotDeletion{
  if(!object(value)||Object.keys(value).some(k=>!["id","name","deletedFromRevision","revision","deletedAt"].includes(k))
    ||typeof value.id!=="string"||!validSpotId(value.id)||typeof value.name!=="string"||!value.name.trim()||value.name.length>300
    ||!revision(value.deletedFromRevision)||value.revision!==value.deletedFromRevision+1
    ||typeof value.deletedAt!=="string"||!Number.isFinite(Date.parse(value.deletedAt))||new Date(value.deletedAt).toISOString()!==value.deletedAt)
    throw new SpotError("unavailable","保存された削除情報の形式を確認してください。");
  return {id:value.id,name:value.name,deletedFromRevision:value.deletedFromRevision,revision:Number(value.revision),deletedAt:value.deletedAt};
}
export function activeSpots(spots:readonly ManagedSpot[],deletions:readonly SpotDeletion[]){
  const seen=new Set<string>();
  for(const raw of deletions){
    const deletion=parseSpotDeletion(raw),spot=spots.find(s=>s.id===deletion.id);
    if(seen.has(deletion.id)||!spot||spot.revision!==deletion.deletedFromRevision)
      throw new SpotError("unavailable","削除情報とスポットの対応を確認してください。");
    seen.add(deletion.id);
  }
  return spots.filter(s=>!seen.has(s.id));
}
