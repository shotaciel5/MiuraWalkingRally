import {INITIAL_SPOT_BOUNDS,SPOT_CATEGORIES,within,type InitialSpot,type SpotCategory} from "./initial-catalog.ts";

export type ManagedSpot=Omit<InitialSpot,"position"|"source">&{
  position:{lat:number;lon:number;kind:InitialSpot["position"]["kind"]|"operator"};
  source:InitialSpot["source"]|null;description:string;revision:number;updatedAt:string|null;
};
export type SpotInput={id:string;expectedRevision:number;name:string;category:SpotCategory;position:{lat:number;lon:number};description:string};
export type SpotEdit={id:string;name:string;category:SpotCategory;position:{lat:number;lon:number};description:string;positionOverride:boolean;revision:number;updatedAt:string};
export class SpotError extends Error {
  code:"invalid"|"conflict"|"missing"|"unavailable";
  constructor(code:SpotError["code"],message:string){super(message);this.name="SpotError";this.code=code}
}
const object=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==="object"&&!Array.isArray(v);
const keys=(v:Record<string,unknown>,allowed:string[])=>Object.keys(v).every(k=>allowed.includes(k));
export const validSpotId=(id:string)=>/^osm-(node|way|relation)-[1-9]\d*$/.test(id)||/^local-[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(id);
export function parseSpotInput(v:unknown):SpotInput {
  if(!object(v)||!keys(v,["id","expectedRevision","name","category","position","description"])
    ||typeof v.id!=="string"||!validSpotId(v.id)||!Number.isSafeInteger(v.expectedRevision)||Number(v.expectedRevision)<0)
    throw new SpotError("invalid","スポットIDと編集の版を確認してください。");
  if(typeof v.name!=="string"||!v.name.trim()||v.name.trim().length>300)
    throw new SpotError("invalid","名称は1〜300文字で入力してください。");
  if(typeof v.category!=="string"||!Object.hasOwn(SPOT_CATEGORIES,v.category))
    throw new SpotError("invalid","カテゴリを選択してください。");
  if(!object(v.position)||!keys(v.position,["lat","lon"])||typeof v.position.lat!=="number"||typeof v.position.lon!=="number"
    ||!Number.isFinite(v.position.lat)||!Number.isFinite(v.position.lon)||!within({lat:v.position.lat,lon:v.position.lon},INITIAL_SPOT_BOUNDS))
    throw new SpotError("invalid","施設位置は三崎・城ヶ島の対象範囲内で指定してください（緯度35.125〜35.157、経度139.608〜139.638）。");
  if(typeof v.description!=="string"||v.description.length>2000)
    throw new SpotError("invalid","説明は2000文字以内で入力してください。");
  return {id:v.id,expectedRevision:Number(v.expectedRevision),name:v.name.trim(),category:v.category as SpotCategory,
    position:{lat:v.position.lat,lon:v.position.lon},description:v.description.trim()};
}
export function parseSpotEdit(v:unknown):SpotEdit {
  if(!object(v)||!keys(v,["id","name","category","position","description","positionOverride","revision","updatedAt"])
    ||typeof v.positionOverride!=="boolean"||!Number.isSafeInteger(v.revision)||Number(v.revision)<1
    ||typeof v.updatedAt!=="string"||!Number.isFinite(Date.parse(v.updatedAt))||new Date(v.updatedAt).toISOString()!==v.updatedAt)
    throw new SpotError("unavailable","保存されたスポット情報の形式を確認してください。");
  try {
    const parsed=parseSpotInput({id:v.id,expectedRevision:v.revision,name:v.name,category:v.category,position:v.position,description:v.description});
    const {expectedRevision,...fields}=parsed;
    return {...fields,positionOverride:v.positionOverride,revision:expectedRevision,updatedAt:v.updatedAt};
  }catch{throw new SpotError("unavailable","保存されたスポット情報が不正です。")}
}
export function mergeSpotEdits(initial:readonly InitialSpot[],edits:readonly SpotEdit[]):ManagedSpot[] {
  const byId=new Map<string,ManagedSpot>(initial.map(s=>[s.id,{...s,description:"",revision:0,updatedAt:null}]));
  const seen=new Set<string>();
  for(const raw of edits){
    const edit=parseSpotEdit(raw),base=byId.get(edit.id);
    if(seen.has(edit.id)||(!base&&!edit.id.startsWith("local-"))||(!base&&!edit.positionOverride))
      throw new SpotError("unavailable","保存データと初期スポットの対応を確認してください。");
    if(base&&!edit.positionOverride&&(edit.position.lat!==base.position.lat||edit.position.lon!==base.position.lon))
      throw new SpotError("unavailable","保存された位置情報の対応を確認してください。");
    seen.add(edit.id);
    byId.set(edit.id,{id:edit.id,name:edit.name,category:edit.category,description:edit.description,revision:edit.revision,updatedAt:edit.updatedAt,
      area:edit.position.lat<35.1376?"jogashima-vicinity":"misaki-vicinity",
      position:{...edit.position,kind:edit.positionOverride?"operator":base!.position.kind},source:base?.source??null,reviewStatus:"unverified",
      routing:edit.positionOverride?{state:within(edit.position,{south:35.137,west:139.614,north:35.147,east:139.627})?"entrance-unverified":"outside-road-snapshot"}:base!.routing});
  }
  return [...byId.values()];
}
export function sameSpotFields(a:Pick<ManagedSpot,"name"|"category"|"position"|"description">,b:SpotInput) {
  return a.name===b.name&&a.category===b.category&&a.position.lat===b.position.lat&&a.position.lon===b.position.lon&&a.description===b.description;
}

export function decodeManagedSpot(v:unknown):ManagedSpot|null {
  try {
    if(!object(v))return null;
    parseSpotInput({id:v.id,expectedRevision:v.revision,name:v.name,category:v.category,position:object(v.position)?{lat:v.position.lat,lon:v.position.lon}:null,description:v.description});
    if(!object(v.position)||!["node","bounding-box-center","operator"].includes(String(v.position.kind))||v.reviewStatus!=="unverified"
      ||!["misaki-vicinity","jogashima-vicinity"].includes(String(v.area))||!object(v.routing))return null;
    if(v.source===null){if(!String(v.id).startsWith("local-")||v.position.kind!=="operator")return null}
    else if(!object(v.source)||!["node","way","relation"].includes(String(v.source.type))||!Number.isSafeInteger(v.source.id)||Number(v.source.id)<=0
      ||v.id!=="osm-"+v.source.type+"-"+v.source.id||v.source.url!=="https://www.openstreetmap.org/"+v.source.type+"/"+v.source.id)return null;
    if(v.routing.state==="poc-reference"){if(v.position.kind==="operator"||!Number.isSafeInteger(v.routing.nodeId)||Number(v.routing.nodeId)<=0)return null}
    else if(!["entrance-unverified","outside-road-snapshot"].includes(String(v.routing.state)))return null;
    if(v.revision===0){if(v.updatedAt!==null||!v.source||v.position.kind==="operator")return null}
    else if(typeof v.updatedAt!=="string"||!Number.isFinite(Date.parse(v.updatedAt))||new Date(v.updatedAt).toISOString()!==v.updatedAt)return null;
    return v as ManagedSpot;
  }catch{return null}
}
