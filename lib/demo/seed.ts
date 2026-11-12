import definitions from "../../data/demo/courses.json" with {type:"json"};
import {getBrowserSpots} from "../spots/browser-catalog.ts";
import {mergeSpotEdits} from "../spots/editing.ts";
import {decodeRallyDraft,draftIssues} from "../operator/rally-draft.ts";
import {emptyCorrections} from "../operator/rally-corrections.ts";
import {createRallyPreview} from "../operator/rally-preview.ts";
import {prepareCourseSave} from "../operator/course-save.ts";
import {courseFingerprint,readCourseById} from "../operator/course-repository.ts";
import {parseSavedCourse,canonicalJson,type SavedCourse} from "../operator/course-format.ts";
import {openOperatorDatabase,getOperatorDatabasePath} from "../operator/local-database.ts";
import {readSpotState} from "../spots/local-repository.ts";
export function demoCourses():SavedCourse[]{
 const initial=getBrowserSpots();if(!initial)throw Error("Demo catalog unavailable");
 const spots=mergeSpotEdits(initial,[]),byId=new Map(spots.map(s=>[s.id,s]));
 return definitions.courses.map(input=>{
  const draft=decodeRallyDraft({title:input.title,start:byId.get(input.start),finish:byId.get(input.finish),stops:input.stops.map(s=>({kind:s.kind,spot:byId.get(s.id)})),revision:1,updatedAt:definitions.preparedAt});
  if(!draft)throw Error("Invalid bundled draft");
  const corrections=emptyCorrections(),preview=createRallyPreview(draft,spots,corrections);
  if(preview.state!=="ready")throw Error("Bundled route unavailable");
  const {payload}=prepareCourseSave({draft,spots,corrections},preview);
  return parseSavedCourse({id:input.id,createdAt:definitions.preparedAt,fingerprint:courseFingerprint(payload),payload});
 });
}
// Explicit local import boundary. No import/seed runs at module load, build or request time.
export function seedDemoData(path=getOperatorDatabasePath()){
 const courses=demoCourses(),db=openOperatorDatabase(path),added:string[]=[],existing:string[]=[];
 let draft="preserved";
 try{
  db.exec("BEGIN IMMEDIATE");
  for(const course of courses){
   const current=readCourseById(db,course.id);
   if(current){if(current.fingerprint!==course.fingerprint)throw Error("Bundled course ID conflict");existing.push(current.id);continue}
   const same=db.prepare("SELECT id FROM saved_courses WHERE fingerprint=?").get(course.fingerprint);
   if(same){existing.push(String(same.id));continue}
   db.prepare("INSERT INTO saved_courses(id,fingerprint,value) VALUES(?,?,?)").run(course.id,course.fingerprint,canonicalJson(course));
   db.prepare("INSERT INTO course_publications(course_id,fingerprint,published_at,status,revision,changed_at) VALUES(?,?,?,'published',1,?)").run(course.id,course.fingerprint,course.createdAt,course.createdAt);
   added.push(course.id);
  }
  if(!db.prepare("SELECT slot FROM rally_draft WHERE slot='working'").get()&&!db.prepare("SELECT slot FROM rally_corrections WHERE slot='working'").get()){
   const candidate=courses[0].payload.input.draft,spots=readSpotState(db).active;
   if(!draftIssues(candidate,spots).length){db.prepare("INSERT INTO rally_draft(slot,value) VALUES('working',?)").run(canonicalJson(candidate));draft="added"}
   else draft="catalog-changed";
  }
  db.exec("COMMIT");
  return {bundleId:definitions.id,added,existing,draft};
 }catch(error){try{db.exec("ROLLBACK")}catch{}throw error}finally{db.close()}
}
