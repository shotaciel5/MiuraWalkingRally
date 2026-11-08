import type {DatabaseSync} from "node:sqlite";
import type {InitialSpot} from "./initial-catalog.ts";
import {getBrowserSpots} from "./browser-catalog.ts";
import {mergeSpotEdits,parseSpotEdit,parseSpotInput,sameSpotFields,SpotError,type SpotEdit} from "./editing.ts";
import {activeSpots,parseSpotDeleteInput,parseSpotDeletion} from "./deletion.ts";

import {openOperatorDatabase,getOperatorDatabasePath} from "../operator/local-database.ts";
export function readSpotState(db:DatabaseSync,loadInitial:()=>InitialSpot[]|null=getBrowserSpots){
    const initial=loadInitial();
    if(!initial)throw new SpotError("unavailable","初期スポットを読み込めませんでした。");
    const edits=db.prepare("SELECT id,value FROM spot_edits ORDER BY id").all().map(row=>{
      let edit:SpotEdit;
      try{edit=parseSpotEdit(JSON.parse(String(row.value)))}catch{throw new SpotError("unavailable","保存されたスポット情報を読み込めませんでした。");}
      if(edit.id!==row.id)throw new SpotError("unavailable","保存されたスポットIDが一致しません。");
      return edit;
    });
    const deletions=db.prepare("SELECT id,value FROM spot_deletions ORDER BY id").all().map(row=>{
      let deletion;try{deletion=parseSpotDeletion(JSON.parse(String(row.value)))}catch{throw new SpotError("unavailable","保存された削除情報を読み込めませんでした。");}
      if(deletion.id!==row.id)throw new SpotError("unavailable","保存された削除IDが一致しません。");
      return deletion;
    });
    const all=mergeSpotEdits(initial,edits);
    return {all,deletions,active:activeSpots(all,deletions)};
  }

// This boundary is local-only. Replace this repository when a cloud persistence service is selected.
export function createSpotRepository(path:string,loadInitial:()=>InitialSpot[]|null=getBrowserSpots,now=()=>new Date().toISOString()){
  const connection=()=>openOperatorDatabase(path);
  const read=(db:DatabaseSync)=>readSpotState(db,loadInitial);
  return {
    list(){
      const db=connection();try{return read(db).active}finally{db.close()}
    },
    save(value:unknown){
      const input=parseSpotInput(value),db=connection();
      try {
        db.exec("BEGIN IMMEDIATE");
        const state=read(db);
        if(state.deletions.some(d=>d.id===input.id))throw new SpotError("conflict","このスポットは削除済みです。最新の台帳を読み込んでください。");
        const current=state.active.find(s=>s.id===input.id);
        if(!current&&!input.id.startsWith("local-"))throw new SpotError("missing","対象のスポットが見つかりません。");
        // A response can be lost after commit. The same ID + values retries without creating another row.
        if(current&&sameSpotFields(current,input)){db.exec("COMMIT");return current}
        if((current?.revision??0)!==input.expectedRevision)throw new SpotError("conflict","別の画面で更新されています。入力を控え、再読込みして最新の情報から編集してください。");
        const moved=!current||current.position.kind==="operator"||current.position.lat!==input.position.lat||current.position.lon!==input.position.lon;
        const {expectedRevision,...fields}=input;
        const edit=parseSpotEdit({...fields,positionOverride:moved,revision:expectedRevision+1,updatedAt:now()});
        db.prepare("INSERT INTO spot_edits(id,value) VALUES (?,?) ON CONFLICT(id) DO UPDATE SET value=excluded.value").run(edit.id,JSON.stringify(edit));
        const saved=read(db).active.find(s=>s.id===input.id)!;
        db.exec("COMMIT");
        return saved;
      }catch(error){try{db.exec("ROLLBACK")}catch{}throw error}finally{db.close()}
    },
    remove(value:unknown){
      const input=parseSpotDeleteInput(value),db=connection();
      try{
        db.exec("BEGIN IMMEDIATE");
        const state=read(db),previous=state.deletions.find(d=>d.id===input.id);
        if(previous){
          if(previous.deletedFromRevision!==input.expectedRevision)throw new SpotError("conflict","削除情報が変わっています。最新の台帳を読み込んでください。");
          db.exec("COMMIT");return previous;
        }
        const current=state.active.find(s=>s.id===input.id);
        if(!current)throw new SpotError("missing","対象のスポットが見つかりません。");
        if(current.revision!==input.expectedRevision)throw new SpotError("conflict","別の画面で更新されています。最新の台帳を読み込み、削除対象を確認し直してください。");
        const deletion=parseSpotDeletion({id:current.id,name:current.name,deletedFromRevision:current.revision,revision:current.revision+1,deletedAt:now()});
        db.prepare("INSERT INTO spot_deletions(id,value) VALUES (?,?)").run(deletion.id,JSON.stringify(deletion));
        read(db); // Validate the complete state before committing; the spot must be absent from active entries.
        db.exec("COMMIT");return deletion;
      }catch(error){try{db.exec("ROLLBACK")}catch{}throw error}finally{db.close()}
    },
  };
}
export function getSpotRepository(){
  return createSpotRepository(getOperatorDatabasePath());
}
