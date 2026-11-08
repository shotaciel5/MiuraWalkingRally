import {mkdirSync} from "node:fs";
import {dirname,resolve} from "node:path";
import {DatabaseSync} from "node:sqlite";
import type {InitialSpot} from "./initial-catalog.ts";
import {getBrowserSpots} from "./browser-catalog.ts";
import {mergeSpotEdits,parseSpotEdit,parseSpotInput,sameSpotFields,SpotError,type SpotEdit} from "./editing.ts";

// This boundary is local-only. Replace this repository when a cloud persistence service is selected.
export function createSpotRepository(path:string,loadInitial:()=>InitialSpot[]|null=getBrowserSpots,now=()=>new Date().toISOString()){
  function connection(){
    if(path!==":memory:")mkdirSync(dirname(resolve(path)),{recursive:true});
    const db=new DatabaseSync(path,{timeout:2000});
    try {
      let version=Number(db.prepare("PRAGMA user_version").get()!.user_version);
      if(version===0){
        db.exec("BEGIN IMMEDIATE");
        try{
          // Recheck after acquiring the lock: another request may have initialized this file.
          version=Number(db.prepare("PRAGMA user_version").get()!.user_version);
          if(version===0){
            if(db.prepare("SELECT name FROM sqlite_schema WHERE type='table' AND name NOT LIKE 'sqlite_%'").all().length)
              throw new SpotError("unavailable","既存の保存ファイルの形式を確認してください。");
            db.exec("CREATE TABLE spot_edits (id TEXT PRIMARY KEY, value TEXT NOT NULL) STRICT; PRAGMA user_version=1;");
            version=1;
          }
          db.exec("COMMIT");
        }catch(error){try{db.exec("ROLLBACK")}catch{}throw error}
      }
      if(version!==1)throw new SpotError("unavailable","未対応のスポット保存形式です。保存ファイルを確認してください。");
      return db;
    }catch(error){db.close();throw error}
  }
  function read(db:DatabaseSync){
    const initial=loadInitial();
    if(!initial)throw new SpotError("unavailable","初期スポットを読み込めませんでした。");
    const edits=db.prepare("SELECT id,value FROM spot_edits ORDER BY id").all().map(row=>{
      let edit:SpotEdit;
      try{edit=parseSpotEdit(JSON.parse(String(row.value)))}catch{throw new SpotError("unavailable","保存されたスポット情報を読み込めませんでした。");}
      if(edit.id!==row.id)throw new SpotError("unavailable","保存されたスポットIDが一致しません。");
      return edit;
    });
    return mergeSpotEdits(initial,edits);
  }
  return {
    list(){
      const db=connection();try{return read(db)}finally{db.close()}
    },
    save(value:unknown){
      const input=parseSpotInput(value),db=connection();
      try {
        db.exec("BEGIN IMMEDIATE");
        const current=read(db).find(s=>s.id===input.id);
        if(!current&&!input.id.startsWith("local-"))throw new SpotError("missing","対象のスポットが見つかりません。");
        // A response can be lost after commit. The same ID + values retries without creating another row.
        if(current&&sameSpotFields(current,input)){db.exec("COMMIT");return current}
        if((current?.revision??0)!==input.expectedRevision)throw new SpotError("conflict","別の画面で更新されています。入力を控え、再読込みして最新の情報から編集してください。");
        const moved=!current||current.position.kind==="operator"||current.position.lat!==input.position.lat||current.position.lon!==input.position.lon;
        const {expectedRevision,...fields}=input;
        const edit=parseSpotEdit({...fields,positionOverride:moved,revision:expectedRevision+1,updatedAt:now()});
        db.prepare("INSERT INTO spot_edits(id,value) VALUES (?,?) ON CONFLICT(id) DO UPDATE SET value=excluded.value").run(edit.id,JSON.stringify(edit));
        const saved=read(db).find(s=>s.id===input.id)!;
        db.exec("COMMIT");
        return saved;
      }catch(error){try{db.exec("ROLLBACK")}catch{}throw error}finally{db.close()}
    },
  };
}
export function getSpotRepository(){
  return createSpotRepository(process.env.SPOT_DB_PATH||resolve(process.cwd(),".local-data","operator-spots.sqlite"));
}
