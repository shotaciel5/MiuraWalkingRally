import {openOperatorDatabase,getOperatorDatabasePath} from "./local-database.ts";
import {readCourseById} from "./course-repository.ts";
import {CourseError,validCourseId} from "./course-format.ts";
import {parsePublishInput,parsePublication,type CoursePublication} from "./publication.ts";
import {publishedSummary} from "../published-course.ts";
type Database=ReturnType<typeof openOperatorDatabase>;
function readPublication(db:Database,id:string):CoursePublication|null{
 const row=db.prepare("SELECT course_id,fingerprint,published_at FROM course_publications WHERE course_id=?").get(id);
 return row?parsePublication({courseId:row.course_id,fingerprint:row.fingerprint,publishedAt:row.published_at}):null;
}
function readPublished(db:Database,id:string){
 const publication=readPublication(db,id);if(!publication)return null;
 const course=readCourseById(db,id);
 if(!course||course.fingerprint!==publication.fingerprint)throw new CourseError("unavailable","公開対象の保存済みコースを確認できません。記録を確認してください。");
 return {course,publication};
}
export function createPublicationRepository(path:string,now=()=>new Date().toISOString()){
 return {
  get(id:string){
   if(!validCourseId(id))return null;
   const db=openOperatorDatabase(path);try{db.exec("BEGIN");const value=readPublished(db,id);db.exec("COMMIT");return value}finally{db.close()}
  },
  list(){
   const db=openOperatorDatabase(path);try{
    db.exec("BEGIN");const rows=db.prepare("SELECT course_id FROM course_publications ORDER BY published_at DESC,course_id").all();
    const courses=rows.map(row=>{if(!validCourseId(row.course_id))throw new CourseError("unavailable","公開コースの識別情報を確認できません。");const value=readPublished(db,row.course_id);if(!value)throw new CourseError("unavailable","公開情報を確認できません。");return publishedSummary(value.course,value.publication)});
    db.exec("COMMIT");return courses;
   }finally{db.close()}
  },
  publish(value:unknown){
   const input=parsePublishInput(value),db=openOperatorDatabase(path);
   try{
    db.exec("BEGIN IMMEDIATE");
    const course=readCourseById(db,input.courseId);if(!course)throw new CourseError("missing","保存済みコースが見つかりません。");
    if(course.fingerprint!==input.fingerprint)throw new CourseError("conflict","表示している保存済みコースと内容が一致しません。開き直して確認してください。");
    const previous=readPublication(db,input.courseId);
    if(previous){
     if(previous.fingerprint!==course.fingerprint)throw new CourseError("unavailable","公開情報と保存済みコースが一致しません。");
     db.exec("COMMIT");return previous;
    }
    const publication=parsePublication({...input,publishedAt:now()});
    db.prepare("INSERT INTO course_publications(course_id,fingerprint,published_at) VALUES(?,?,?)").run(publication.courseId,publication.fingerprint,publication.publishedAt);
    const saved=readPublished(db,input.courseId);if(!saved)throw new CourseError("unavailable","公開結果を確認できません。同じコースで再試行してください。");
    db.exec("COMMIT");return saved.publication;
   }catch(error){try{db.exec("ROLLBACK")}catch{}throw error}finally{db.close()}
  }
 };
}
export const getPublicationRepository=()=>createPublicationRepository(getOperatorDatabasePath());
