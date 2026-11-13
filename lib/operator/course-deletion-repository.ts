import {openOperatorDatabase,getOperatorDatabasePath} from "./local-database.ts";
import {readCourseById} from "./course-repository.ts";
import {CourseError} from "./course-format.ts";
import {parsePublication} from "./publication.ts";
import {parseCourseDeleteInput,parseCourseDeletion} from "./course-deletion.ts";

export function createCourseDeletionRepository(path:string,now=()=>new Date().toISOString()){
 return {remove(value:unknown){
  const input=parseCourseDeleteInput(value),db=openOperatorDatabase(path);
  try{
   db.exec("BEGIN IMMEDIATE");
   const prior=db.prepare("SELECT value FROM course_deletions WHERE course_id=?").get(input.courseId);
   if(prior){
    let deleted;try{deleted=parseCourseDeletion(JSON.parse(String(prior.value)))}catch{throw new CourseError("unavailable","コースの削除記録を確認できません。")}
    if(deleted.courseId!==input.courseId||deleted.fingerprint!==input.fingerprint||deleted.publicationRevision!==input.expectedPublicationRevision)throw new CourseError("conflict","削除記録と指定内容が一致しません。コース一覧を開き直してください。");
    if(readCourseById(db,input.courseId)||db.prepare("SELECT course_id FROM course_publications WHERE course_id=?").get(input.courseId))throw new CourseError("unavailable","削除記録と保存状態が一致しません。");
    db.exec("COMMIT");return deleted;
   }
   const course=readCourseById(db,input.courseId);
   if(!course)throw new CourseError("missing","保存済みコースが見つかりません。");
   if(course.fingerprint!==input.fingerprint)throw new CourseError("conflict","削除対象が一致しません。コースを開き直してください。");
   const row=db.prepare("SELECT course_id,fingerprint,published_at,status,revision,changed_at FROM course_publications WHERE course_id=?").get(input.courseId);
   const publication=row?parsePublication({courseId:row.course_id,fingerprint:row.fingerprint,publishedAt:row.published_at,status:row.status,revision:row.revision,changedAt:row.changed_at}):null;
   if(publication&&publication.fingerprint!==course.fingerprint)throw new CourseError("unavailable","公開情報とコースが一致しません。");
   if((publication?.revision??0)!==input.expectedPublicationRevision)throw new CourseError("conflict","公開状態が変わりました。開き直してから削除してください。");
   const deleted=parseCourseDeletion({courseId:course.id,fingerprint:course.fingerprint,title:course.payload.preview.title,deletedAt:now(),publicationRevision:publication?.revision??0});
   db.prepare("INSERT INTO course_deletions(course_id,value) VALUES(?,?)").run(course.id,JSON.stringify(deleted));
   db.prepare("DELETE FROM course_publications WHERE course_id=?").run(course.id);
   db.prepare("DELETE FROM saved_courses WHERE id=?").run(course.id);
   db.exec("COMMIT");return deleted;
  }catch(error){try{db.exec("ROLLBACK")}catch{}throw error}finally{db.close()}
 }};
}
export const getCourseDeletionRepository=()=>createCourseDeletionRepository(getOperatorDatabasePath());
