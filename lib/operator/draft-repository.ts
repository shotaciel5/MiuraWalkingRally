import {openOperatorDatabase,getOperatorDatabasePath} from "./local-database.ts";
import {readSpotState} from "../spots/local-repository.ts";
import {getBrowserSpots} from "../spots/browser-catalog.ts";
import type {InitialSpot} from "../spots/initial-catalog.ts";
import {decodeRallyDraft,parseDraftInput,draftSignature,DraftError,draftVisits,draftIssues,type RallyDraft} from "./rally-draft.ts";

import {emptyCorrections,decodeCorrections,parseCorrectionInput,CORRECTION_SOURCE,CorrectionError,type RallyCorrections} from "./rally-corrections.ts";
import {roadConnectionForPoint,roadConnectionForSpot,connectionOnCurrentRoad} from "../miura-road-connections.ts";
import {distanceMeters} from "../route/graph.ts";

export function createDraftRepository(path:string,loadInitial:()=>InitialSpot[]|null=getBrowserSpots,now=()=>new Date().toISOString()){
 function readDraft(db:ReturnType<typeof openOperatorDatabase>){
  const rows=db.prepare("SELECT slot,value FROM rally_draft").all();
  if(!rows.length)return null;
  if(rows.length!==1||rows[0].slot!=="working")throw new DraftError("unavailable","下書きの保存形式を確認してください。");
  let draft:RallyDraft|null=null;try{draft=decodeRallyDraft(JSON.parse(String(rows[0].value)))}catch{}
  if(!draft)throw new DraftError("unavailable","保存された下書きを読み込めませんでした。");
  return draft;
 }
 function readCorrections(db:ReturnType<typeof openOperatorDatabase>):RallyCorrections{
  const rows=db.prepare("SELECT slot,value FROM rally_corrections").all();
  if(!rows.length)return emptyCorrections();
  let value;try{value=rows.length===1&&rows[0].slot==="working"?decodeCorrections(JSON.parse(String(rows[0].value))):null}catch{}
  if(!value||value.revision<1)throw new CorrectionError("unavailable","保存された道路到達点の補正を読み込めませんでした。");
  if(value.items.some(c=>c.snapshotSha256===CORRECTION_SOURCE.snapshotSha256&&c.osmBaseTimestamp===CORRECTION_SOURCE.osmBaseTimestamp&&!connectionOnCurrentRoad(c)))throw new CorrectionError("unavailable","保存された補正と元の道路情報が一致しません。保存ファイルを確認してください。");
  return value;
 }
 function writeCorrections(db:ReturnType<typeof openOperatorDatabase>,before:RallyCorrections,items:RallyCorrections["items"]){
  items=[...items].sort((a,b)=>a.spotId<b.spotId?-1:a.spotId>b.spotId?1:0);
  if(JSON.stringify(before.items)===JSON.stringify(items))return before;
  const saved=decodeCorrections({revision:before.revision+1,updatedAt:now(),items});
  if(!saved)throw new CorrectionError("unavailable","道路到達点の保存結果を確認できません。");
  db.prepare("INSERT INTO rally_corrections(slot,value) VALUES ('working',?) ON CONFLICT(slot) DO UPDATE SET value=excluded.value").run(JSON.stringify(saved));
  return readCorrections(db);
 }
 function prune(db:ReturnType<typeof openOperatorDatabase>,draft:RallyDraft,before:RallyCorrections){
  const ids=new Set(draftVisits(draft).map(v=>v.spot?.id));
  return writeCorrections(db,before,before.items.filter(c=>ids.has(c.spotId)));
 }
 function editCorrection(value:unknown,save:boolean){
  const input=parseCorrectionInput(value),db=openOperatorDatabase(path);
  try{
   db.exec(save?"BEGIN IMMEDIATE":"BEGIN");
   const draft=readDraft(db),spots=readSpotState(db,loadInitial).active,corrections=readCorrections(db);
   if(!draft||draft.revision!==input.expectedDraftRevision)throw new CorrectionError("draft-conflict","下書きが変更されています。最新の保存内容を読み直してください。");
   if(draftIssues(draft,spots).length)throw new CorrectionError("catalog-conflict","台帳の変更・削除を下書きで確認し、再保存してください。");
   const spot=spots.find(s=>s.id===input.spotId);
   if(!spot||spot.revision!==input.spotRevision||!draftVisits(draft).some(v=>v.spot?.id===spot.id))throw new CorrectionError("catalog-conflict","補正対象のスポットと版を確認してください。");
   if(input.sourceHash!==CORRECTION_SOURCE.snapshotSha256)throw new CorrectionError("source-conflict","道路データが更新されています。ページを読み直して確認してください。");
   const connection=input.mode==="manual"?roadConnectionForPoint(spot,input.point!):roadConnectionForSpot(spot);
   if(!connection)throw new CorrectionError("invalid","対象範囲に歩行候補の道路が見つかりません。");
   let saved=corrections;
   if(save){
    const items=corrections.items.filter(c=>c.spotId!==spot.id);if(input.mode==="manual")items.push(connection);
    items.sort((a,b)=>a.spotId<b.spotId?-1:a.spotId>b.spotId?1:0);
    if(JSON.stringify(items)!==JSON.stringify(corrections.items)&&input.expectedCorrectionRevision!==corrections.revision)throw new CorrectionError("correction-conflict","別の画面で到達点の補正が変更されています。入力を控え、最新情報を読み直してください。");
    saved=writeCorrections(db,corrections,items);
   }else if(input.expectedCorrectionRevision!==corrections.revision)throw new CorrectionError("correction-conflict","到達点の補正が変更されています。最新情報を読み直してください。");
   db.exec("COMMIT");
   return {draft,spots,corrections:saved,connection,pickDistanceMeters:distanceMeters(input.point??spot.position,connection.point)};
  }catch(error){try{db.exec("ROLLBACK")}catch{}throw error}finally{db.close()}
 }
 return {
  pickCorrection:(value:unknown)=>editCorrection(value,false),
  saveCorrection:(value:unknown)=>editCorrection(value,true),
  load(){
   const db=openOperatorDatabase(path);
   try{db.exec("BEGIN");const draft=readDraft(db),spots=readSpotState(db,loadInitial).active,corrections=readCorrections(db);db.exec("COMMIT");return {draft,spots,corrections}}
   catch(error){try{db.exec("ROLLBACK")}catch{}throw error}finally{db.close()}
  },
  save(value:unknown){
   const input=parseDraftInput(value),db=openOperatorDatabase(path);
   try{
    db.exec("BEGIN IMMEDIATE");
    const previousCorrections=readCorrections(db),current=readDraft(db),spots=readSpotState(db,loadInitial).active,byId=new Map(spots.map(s=>[s.id,s]));
    const resolve=(reference:{id:string;revision:number})=>{
     const spot=byId.get(reference.id);
     if(!spot)throw new DraftError("catalog-conflict","削除済み・利用できない地点が含まれます。台帳を再確認し、地点を選び直してください。");
     if(spot.revision!==reference.revision)throw new DraftError("catalog-conflict","台帳が更新されています。最新情報を反映し、内容を確認して保存してください。");
     return spot;
    };
    const form={title:input.title,start:resolve(input.start),finish:resolve(input.finish),stops:input.stops.map(s=>({kind:s.kind,spot:resolve(s.spot)}))};
    if(current&&draftSignature(current)===draftSignature(form)){const corrections=prune(db,current,previousCorrections);db.exec("COMMIT");return {draft:current,spots,corrections}}
    if((current?.revision??0)!==input.expectedRevision)throw new DraftError("draft-conflict","別の画面で下書きが更新されています。未保存の内容を控え、保存済みを読み直してください。");
    const draft=decodeRallyDraft({...form,revision:(current?.revision??0)+1,updatedAt:now()});
    if(!draft)throw new DraftError("unavailable","下書きの保存内容を確認できませんでした。");
    db.prepare("INSERT INTO rally_draft(slot,value) VALUES ('working',?) ON CONFLICT(slot) DO UPDATE SET value=excluded.value").run(JSON.stringify(draft));
    const saved=readDraft(db)!,corrections=prune(db,saved,previousCorrections);db.exec("COMMIT");return {draft:saved,spots,corrections};
   }catch(error){try{db.exec("ROLLBACK")}catch{}throw error}finally{db.close()}
  },
 };
}
export function getDraftRepository(){return createDraftRepository(getOperatorDatabasePath())}
