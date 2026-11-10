import {openOperatorDatabase,getOperatorDatabasePath} from "./local-database.ts";
import {readCourseById} from "./course-repository.ts";
import {CourseError,validCourseId} from "./course-format.ts";
import {parsePublishInput,parsePublication,type CoursePublication} from "./publication.ts";
import {publishedSummary} from "../published-course.ts";
type Database=ReturnType<typeof openOperatorDatabase>;
function readPublication(db:Database,id:string):CoursePublication|null{
 const row=db.prepare("SELECT course_id,fingerprint,published_at,status,revision,changed_at FROM course_publications WHERE course_id=?").get(id);
 return row?parsePublication({courseId:row.course_id,fingerprint:row.fingerprint,publishedAt:row.published_at,status:row.status,revision:row.revision,changedAt:row.changed_at}):null;
}
function readPublished(db:Database,id:string){
 const publication=readPublication(db,id);if(!publication)return null;
 const course=readCourseById(db,id);
 if(!course||course.fingerprint!==publication.fingerprint)throw new CourseError("unavailable","公開対象の保存済みコースを確認できません。記録を確認してください。");
 return {course:publication.status==="published"?course:null,publication};
}
export function createPublicationRepository(path:string,now=()=>new Date().toISOString()){
 function change(value:unknown,status:CoursePublication["status"]){
  const input=parsePublishInput(value),db=openOperatorDatabase(path);
  try{
   db.exec("BEGIN IMMEDIATE");
   const course=readCourseById(db,input.courseId);if(!course)throw new CourseError("missing","保存済みコースが見つかりません。");
   if(course.fingerprint!==input.fingerprint)throw new CourseError("conflict","保存済みコースと内容が一致しません。開き直して確認してください。");
   const previous=readPublication(db,input.courseId),revision=previous?.revision??0;
   if(previous&&previous.fingerprint!==course.fingerprint)throw new CourseError("unavailable","公開情報と保存済みコースが一致しません。");
   if(previous&&previous.status===status&&(input.expectedRevision===revision||input.expectedRevision===revision-1)){db.exec("COMMIT");return previous}
   if(input.expectedRevision!==revision)throw new CourseError("conflict","公開状態が他の操作で変わりました。開き直して確認してください。");
   if(!previous&&status==="withdrawn")throw new CourseError("conflict","まだ公開されていません。保存済みコースを開き直してください。");
   const changedAt=now();
   const publication=parsePublication({courseId:input.courseId,fingerprint:input.fingerprint,status,revision:revision+1,changedAt,publishedAt:status==="published"?changedAt:previous!.publishedAt});
   if(previous&&publication.changedAt<previous.changedAt)throw new CourseError("unavailable","保存先の日時を確認してください。公開状態は変更していません。");
   if(previous){
    const result=db.prepare("UPDATE course_publications SET published_at=?,status=?,revision=?,changed_at=? WHERE course_id=? AND revision=?").run(publication.publishedAt,status,publication.revision,publication.changedAt,input.courseId,revision);
    if(result.changes!==1)throw new CourseError("conflict","公開状態が変わりました。開き直して確認してください。");
   }else db.prepare("INSERT INTO course_publications(course_id,fingerprint,published_at,status,revision,changed_at) VALUES(?,?,?,?,?,?)").run(publication.courseId,publication.fingerprint,publication.publishedAt,status,publication.revision,publication.changedAt);
   const saved=readPublished(db,input.courseId);if(!saved)throw new CourseError("unavailable","変更結果を確認できません。同じ操作で再試行してください。");
   db.exec("COMMIT");return saved.publication;
  }catch(error){try{db.exec("ROLLBACK")}catch{}throw error}finally{db.close()}
 }
 return {
  get(id:string){
   if(!validCourseId(id))return null;
   const db=openOperatorDatabase(path);try{db.exec("BEGIN");const value=readPublished(db,id);db.exec("COMMIT");return value}finally{db.close()}
  },
  list(){
   const db=openOperatorDatabase(path);try{
    db.exec("BEGIN");const rows=db.prepare("SELECT course_id FROM course_publications ORDER BY published_at DESC,course_id").all();
    const courses=rows.flatMap(row=>{
     if(!validCourseId(row.course_id))throw new CourseError("unavailable","公開コースの識別情報を確認できません。");
     const publication=readPublication(db,row.course_id);if(!publication)throw new CourseError("unavailable","公開情報を確認できません。");
     if(publication.status==="withdrawn")return [];
     const value=readPublished(db,row.course_id);if(!value?.course)throw new CourseError("unavailable","公開対象を確認できません。");
     return [publishedSummary(value.course,publication)];
    });
    db.exec("COMMIT");return courses;
   }finally{db.close()}
  },
  publish:(value:unknown)=>change(value,"published"),
  unpublish:(value:unknown)=>change(value,"withdrawn")
 };
}
export const getPublicationRepository=()=>createPublicationRepository(getOperatorDatabasePath());
