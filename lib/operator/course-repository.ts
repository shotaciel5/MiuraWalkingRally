import {createHash,randomUUID} from "node:crypto";
import {openOperatorDatabase,getOperatorDatabasePath} from "./local-database.ts";
import {canonicalJson,parseCoursePayload,parseSavedCourse,validCourseId,CourseError,MAX_COURSE_BYTES,type CoursePayload,type SavedCourse} from "./course-format.ts";
export const courseFingerprint=(payload:CoursePayload)=>createHash("sha256").update(canonicalJson(payload)).digest("hex");
export function checkedCoursePayload(value:unknown){
 if(Buffer.byteLength(canonicalJson(value))>MAX_COURSE_BYTES)throw new CourseError("invalid","生成結果が大きすぎて保存できません。地点を減らして再生成してください。");
 try{return parseCoursePayload(value)}catch{throw new CourseError("unavailable","生成結果の保存形式を確認できません。表示を残して再試行してください。")}
}
function readRow(row:Record<string,unknown>):SavedCourse{
 try{
  if(typeof row.value!=="string"||Buffer.byteLength(row.value)>MAX_COURSE_BYTES+4096)throw Error("Stored size");
  const saved=parseSavedCourse(JSON.parse(row.value));
  if(saved.id!==row.id||saved.fingerprint!==row.fingerprint||courseFingerprint(saved.payload)!==saved.fingerprint)throw Error("Stored identity");
  return saved;
 }catch{throw new CourseError("unavailable","保存済みコースの形式・整合性を確認できません。保存ファイルを確認してください。")}
}
export function readCourseById(db:ReturnType<typeof openOperatorDatabase>,id:string){
 const row=db.prepare("SELECT id,fingerprint,value FROM saved_courses WHERE id=?").get(id);return row?readRow(row):null;
}
export function courseSummary(course:SavedCourse){
 const p=course.payload.preview;
 return {id:course.id,createdAt:course.createdAt,title:p.title,meters:p.meters,cards:p.cards.length,nearby:p.cards.filter(c=>c.map.shortGeometry).length,held:p.cards.filter(c=>c.map.state==="held"&&!c.map.shortGeometry).length,sourceTime:p.source.osmBaseTimestamp};
}
export function createCourseRepository(path:string,now=()=>new Date().toISOString(),newId=()=>"course-"+randomUUID()){
 function find(db:ReturnType<typeof openOperatorDatabase>,fingerprint:string){
  const row=db.prepare("SELECT id,fingerprint,value FROM saved_courses WHERE fingerprint=?").get(fingerprint);return row?readRow(row):null;
 }
 return {
  find(fingerprint:string){const db=openOperatorDatabase(path);try{return find(db,fingerprint)}finally{db.close()}},
  get(id:string){
   if(!validCourseId(id))return null;
   const db=openOperatorDatabase(path);try{return readCourseById(db,id)}finally{db.close()}
  },
  list(){
   const db=openOperatorDatabase(path);try{return db.prepare("SELECT id,fingerprint,value FROM saved_courses").all().map(readRow).sort((a,b)=>a.createdAt>b.createdAt?-1:a.createdAt<b.createdAt?1:a.id<b.id?-1:1).map(courseSummary)}finally{db.close()}
  },
  store(value:unknown,verifyCurrent:(db:ReturnType<typeof openOperatorDatabase>)=>void){
   const payload=checkedCoursePayload(value),fingerprint=courseFingerprint(payload),db=openOperatorDatabase(path);
   try{
    db.exec("BEGIN IMMEDIATE");
    const existing=find(db,fingerprint);if(existing){db.exec("COMMIT");return existing}
    verifyCurrent(db);
    const saved=parseSavedCourse({id:newId(),createdAt:now(),fingerprint,payload});
    db.prepare("INSERT INTO saved_courses(id,fingerprint,value) VALUES (?,?,?)").run(saved.id,fingerprint,canonicalJson(saved));
    const read=find(db,fingerprint);if(!read)throw new CourseError("unavailable","コースの保存結果を確認できません。同じ結果で再試行してください。");
    db.exec("COMMIT");return read;
   }catch(error){try{db.exec("ROLLBACK")}catch{}throw error}finally{db.close()}
  }
 };
}
export const getCourseRepository=()=>createCourseRepository(getOperatorDatabasePath());
