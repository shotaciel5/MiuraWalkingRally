import {freezeOmission,manualLandmarkSequences,type OmissionMode} from "../route/omission/selection.ts";
import {freezeLandmarks,type LandmarkSnapshot} from "../landmarks/course-snapshot.ts";
import {landmarkDatasetFromPreview} from "../landmarks/dataset.ts";
import {workbenchState} from "../landmarks/workbench.ts";
import {getLandmarkStorage,type LandmarkStorage} from "../landmarks/storage.ts";
import {getBrowserSpots} from "../spots/browser-catalog.ts";
import type {InitialSpot} from "../spots/initial-catalog.ts";
import {createDraftRepository,readDraftContext} from "./draft-repository.ts";
import {createRallyPreview} from "./rally-preview.ts";
import {createCourseRepository,checkedCoursePayload,courseFingerprint} from "./course-repository.ts";
import {canonicalJson,courseReceipt,parseSaveReceipt,CourseError,COURSE_GENERATOR_VERSION,type CoursePayload} from "./course-format.ts";
import {getOperatorDatabasePath} from "./local-database.ts";
type Context=ReturnType<ReturnType<typeof createDraftRepository>["load"]>;
export function prepareCourseSave(context:Context,result:ReturnType<typeof createRallyPreview>,landmarks?:LandmarkSnapshot,selection:{mode:OmissionMode;manualSequences:number[]}={mode:"rule",manualSequences:[]}){
 if(!context.draft||result.state!=="ready")throw new CourseError("conflict",result.state==="blocked"?result.message:"保存済みの下書きを確認してください。");
 const {omissionPlan,...preview}=result;
 const omission=omissionPlan?freezeOmission(omissionPlan,selection.mode,selection.manualSequences):undefined;
 if(omission&&!landmarks)throw new CourseError("unavailable","目印と省略条件の保存準備を確認してください。");
 const payload=checkedCoursePayload({formatVersion:omission?3:landmarks?2:1,generatorVersion:COURSE_GENERATOR_VERSION,input:{draft:context.draft,corrections:context.corrections},preview,...(landmarks?{landmarks}:{}),...(omission?{omission}:{})});
 return {payload,receipt:courseReceipt(payload,courseFingerprint(payload))};
}
function basis(context:Context){
 const ids=new Set(context.draft?[context.draft.start.id,context.draft.finish.id,...context.draft.stops.map(s=>s.spot.id)]:[]);
 return canonicalJson({draft:context.draft,corrections:context.corrections,selected:context.spots.filter(s=>ids.has(s.id)).sort((a,b)=>a.id<b.id?-1:1)});
}
export function createCourseService(path:string,options:{loadInitial?:()=>InitialSpot[]|null;generate?:typeof createRallyPreview;now?:()=>string;newId?:()=>string;landmarks?:boolean;omission?:boolean;landmarkStorage?:LandmarkStorage}={}){
 const loadInitial=options.loadInitial??getBrowserSpots,generate=options.generate??createRallyPreview,drafts=createDraftRepository(path,loadInitial),courses=createCourseRepository(path,options.now,options.newId);
 return {save(value:unknown){
  const requested=parseSaveReceipt(value),existing=courses.find(requested.fingerprint);
  const matches=(payload:CoursePayload,fingerprint:string)=>canonicalJson(courseReceipt(payload,fingerprint))===canonicalJson(requested);
  if(existing){if(!matches(existing.payload,existing.fingerprint))throw new CourseError("invalid","保存済みコースと要求の識別情報が一致しません。");return existing}
  const current=drafts.load(),result=generate(current.draft,current.spots,current.corrections,{omission:options.omission});
  const snapshot=()=>{if(!options.landmarks||result.state!=="ready")return {landmarks:undefined,manualSequences:[]};const state=workbenchState(landmarkDatasetFromPreview(result),options.landmarkStorage??getLandmarkStorage());return {landmarks:freezeLandmarks(state),manualSequences:options.omission?manualLandmarkSequences(state.review.choices,result.cards.length):[]}};
  const capture=snapshot(),candidate=prepareCourseSave(current,result,capture.landmarks,{mode:requested.formatVersion===3?requested.omissionMode:"rule",manualSequences:capture.manualSequences});
  if(!matches(candidate.payload,candidate.receipt.fingerprint))throw new CourseError("conflict","表示した生成結果の条件が変わっています。最新の保存内容から再生成し、確認してください。");
  const before=basis(current);
  return courses.store(candidate.payload,db=>{
   if(canonicalJson(snapshot())!==canonicalJson(capture))throw new CourseError("conflict","目印の採用状態が変わりました。最新の内容を読み直してください。");
   if(basis(readDraftContext(db,loadInitial))!==before)throw new CourseError("conflict","保存前に下書き・台帳・補正が変わりました。最新内容から再生成してください。");
  });
 }};
}
export const getCourseService=()=>createCourseService(getOperatorDatabasePath(),{landmarks:true,omission:true});
