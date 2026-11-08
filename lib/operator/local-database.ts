import {mkdirSync} from "node:fs";
import {dirname,resolve} from "node:path";
import {DatabaseSync} from "node:sqlite";
import {SpotError} from "../spots/editing.ts";
export function openOperatorDatabase(path:string){
    if(path!==":memory:")mkdirSync(dirname(resolve(path)),{recursive:true});
    const db=new DatabaseSync(path,{timeout:2000});
    try {
      let version=Number(db.prepare("PRAGMA user_version").get()!.user_version);
      if(version===0||version===1||version===2){
        db.exec("BEGIN IMMEDIATE");
        try{
          // Another request may have initialized or migrated the file before this lock.
          version=Number(db.prepare("PRAGMA user_version").get()!.user_version);
          if(version===0){
            if(db.prepare("SELECT name FROM sqlite_schema WHERE type='table' AND name NOT LIKE 'sqlite_%'").all().length)
              throw new SpotError("unavailable","既存の保存ファイルの形式を確認してください。");
            db.exec("CREATE TABLE spot_edits (id TEXT PRIMARY KEY, value TEXT NOT NULL) STRICT;");
            version=1;
          }
          if(version===1){
            // Missing/foreign tables fail instead of being recreated with empty data.
            db.prepare("SELECT id,value FROM spot_edits LIMIT 0").all();
            db.exec("CREATE TABLE spot_deletions (id TEXT PRIMARY KEY, value TEXT NOT NULL) STRICT; PRAGMA user_version=2;");
            version=2;
          }
          if(version===2){
            db.prepare("SELECT id,value FROM spot_edits LIMIT 0").all();
            db.prepare("SELECT id,value FROM spot_deletions LIMIT 0").all();
            db.exec("CREATE TABLE rally_draft (slot TEXT PRIMARY KEY CHECK(slot='working'), value TEXT NOT NULL) STRICT; PRAGMA user_version=3;");
            version=3;
          }
          db.exec("COMMIT");
        }catch(error){try{db.exec("ROLLBACK")}catch{}throw error}
      }
      if(version!==3)throw new SpotError("unavailable","未対応のスポット保存形式です。保存ファイルを確認してください。");
      db.prepare("SELECT slot,value FROM rally_draft LIMIT 0").all();
      return db;
    }catch(error){db.close();throw error}
  }

export function getOperatorDatabasePath(){return process.env.SPOT_DB_PATH||resolve(process.cwd(),".local-data","operator-spots.sqlite")}
