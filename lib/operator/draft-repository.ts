import {openOperatorDatabase,getOperatorDatabasePath} from "./local-database.ts";
import {readSpotState} from "../spots/local-repository.ts";
import {getBrowserSpots} from "../spots/browser-catalog.ts";
import type {InitialSpot} from "../spots/initial-catalog.ts";
import {decodeRallyDraft,parseDraftInput,draftSignature,DraftError,type RallyDraft} from "./rally-draft.ts";

export function createDraftRepository(path:string,loadInitial:()=>InitialSpot[]|null=getBrowserSpots,now=()=>new Date().toISOString()){
 function readDraft(db:ReturnType<typeof openOperatorDatabase>){
  const rows=db.prepare("SELECT slot,value FROM rally_draft").all();
  if(!rows.length)return null;
  if(rows.length!==1||rows[0].slot!=="working")throw new DraftError("unavailable","下書きの保存形式を確認してください。");
  let draft:RallyDraft|null=null;try{draft=decodeRallyDraft(JSON.parse(String(rows[0].value)))}catch{}
  if(!draft)throw new DraftError("unavailable","保存された下書きを読み込めませんでした。");
  return draft;
 }
 return {
  load(){
   const db=openOperatorDatabase(path);
   try{db.exec("BEGIN");const draft=readDraft(db),spots=readSpotState(db,loadInitial).active;db.exec("COMMIT");return {draft,spots}}
   catch(error){try{db.exec("ROLLBACK")}catch{}throw error}finally{db.close()}
  },
  save(value:unknown){
   const input=parseDraftInput(value),db=openOperatorDatabase(path);
   try{
    db.exec("BEGIN IMMEDIATE");
    const current=readDraft(db),spots=readSpotState(db,loadInitial).active,byId=new Map(spots.map(s=>[s.id,s]));
    const resolve=(reference:{id:string;revision:number})=>{
     const spot=byId.get(reference.id);
     if(!spot)throw new DraftError("catalog-conflict","削除済み・利用できない地点が含まれます。台帳を再確認し、地点を選び直してください。");
     if(spot.revision!==reference.revision)throw new DraftError("catalog-conflict","台帳が更新されています。最新情報を反映し、内容を確認して保存してください。");
     return spot;
    };
    const form={title:input.title,start:resolve(input.start),finish:resolve(input.finish),stops:input.stops.map(s=>({kind:s.kind,spot:resolve(s.spot)}))};
    if(current&&draftSignature(current)===draftSignature(form)){db.exec("COMMIT");return {draft:current,spots}}
    if((current?.revision??0)!==input.expectedRevision)throw new DraftError("draft-conflict","別の画面で下書きが更新されています。未保存の内容を控え、保存済みを読み直してください。");
    const draft=decodeRallyDraft({...form,revision:(current?.revision??0)+1,updatedAt:now()});
    if(!draft)throw new DraftError("unavailable","下書きの保存内容を確認できませんでした。");
    db.prepare("INSERT INTO rally_draft(slot,value) VALUES ('working',?) ON CONFLICT(slot) DO UPDATE SET value=excluded.value").run(JSON.stringify(draft));
    const saved=readDraft(db)!;db.exec("COMMIT");return {draft:saved,spots};
   }catch(error){try{db.exec("ROLLBACK")}catch{}throw error}finally{db.close()}
  },
 };
}
export function getDraftRepository(){return createDraftRepository(getOperatorDatabasePath())}
