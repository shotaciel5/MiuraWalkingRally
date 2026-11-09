import source from "../../data/miura-expanded/source.json" with {type:"json"};
import {decodeRoadConnection,connectionMatchesSpot,type RoadConnection} from "../route/road-connection.ts";
import {decodeDraftContext,draftVisits,type DraftForm} from "./rally-draft.ts";
import {validSpotId,SpotError,type ManagedSpot} from "../spots/editing.ts";
import {EXPANDED_BOUNDS} from "../expanded-osm.ts";
import {within} from "../spots/initial-catalog.ts";
export const CORRECTION_SOURCE={snapshotSha256:source.roadSnapshotSha256,osmBaseTimestamp:source.osmBaseTimestamp};
export type RallyCorrections={revision:number;updatedAt:string|null;items:RoadConnection[]};
export const emptyCorrections=():RallyCorrections=>({revision:0,updatedAt:null,items:[]});
export class CorrectionError extends SpotError{
 reason:string;
 constructor(reason:string,message:string){super(reason==="invalid"?"invalid":reason==="unavailable"?"unavailable":"conflict",message);this.reason=reason}
}
const object=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==="object"&&!Array.isArray(v);
const revision=(v:unknown):v is number=>Number.isSafeInteger(v)&&Number(v)>=0&&Number(v)<Number.MAX_SAFE_INTEGER;
export function decodeCorrections(value:unknown):RallyCorrections|null{
 if(!object(value)||!Object.keys(value).every(k=>["revision","updatedAt","items"].includes(k))||!revision(value.revision)||!Array.isArray(value.items))return null;
 const items=value.items.map(decodeRoadConnection);
 if(items.some(x=>!x)||new Set(items.map(c=>c!.spotId)).size!==items.length)return null;
 if(value.revision===0){if(value.updatedAt!==null||items.length)return null}
 else if(typeof value.updatedAt!=="string"||!Number.isFinite(Date.parse(value.updatedAt))||new Date(value.updatedAt).toISOString()!==value.updatedAt)return null;
 return {revision:value.revision,updatedAt:value.updatedAt as string|null,items:(items as RoadConnection[]).sort((a,b)=>a.spotId<b.spotId?-1:a.spotId>b.spotId?1:0)};
}
export function decodeCorrectionContext(value:unknown){
 const context=decodeDraftContext(value),corrections=object(value)?decodeCorrections(value.corrections):null;
 return context&&corrections?{...context,corrections}:null;
}
export function staleCorrections(form:DraftForm,spots:readonly ManagedSpot[],saved:RallyCorrections){
 const ids=new Set(draftVisits(form).map(v=>v.spot?.id)),byId=new Map(spots.map(s=>[s.id,s]));
 return saved.items.filter(c=>!ids.has(c.spotId)||!connectionMatchesSpot(c,byId.get(c.spotId)??null)||c.snapshotSha256!==CORRECTION_SOURCE.snapshotSha256||c.osmBaseTimestamp!==CORRECTION_SOURCE.osmBaseTimestamp);
}
export type CorrectionInput={expectedDraftRevision:number;expectedCorrectionRevision:number;spotId:string;spotRevision:number;sourceHash:string;mode:"manual"|"auto";point?:{lat:number;lon:number}};
export function parseCorrectionInput(value:unknown):CorrectionInput{
 if(!object(value)||!Object.keys(value).every(k=>["expectedDraftRevision","expectedCorrectionRevision","spotId","spotRevision","sourceHash","mode","point"].includes(k))
  ||!revision(value.expectedDraftRevision)||Number(value.expectedDraftRevision)<1||!revision(value.expectedCorrectionRevision)||!revision(value.spotRevision)
  ||typeof value.spotId!=="string"||!validSpotId(value.spotId)||typeof value.sourceHash!=="string"||!/^[0-9a-f]{64}$/.test(value.sourceHash)||!["manual","auto"].includes(String(value.mode)))
  throw new CorrectionError("invalid","下書き・スポット・補正の版を確認してください。");
 if(value.mode==="manual"){
  const p=value.point;
  if(!object(p)||Object.keys(p).some(k=>!["lat","lon"].includes(k))||typeof p.lat!=="number"||typeof p.lon!=="number"||!Number.isFinite(p.lat)||!Number.isFinite(p.lon)||!within({lat:p.lat,lon:p.lon},EXPANDED_BOUNDS))
   throw new CorrectionError("invalid","候補位置は道路データの範囲内で指定してください（緯度35.122〜35.160、経度139.604〜139.642）。");
 }else if(value.point!==undefined)throw new CorrectionError("invalid","自動候補に戻す場合は位置を指定しません。");
 return value as CorrectionInput;
}
