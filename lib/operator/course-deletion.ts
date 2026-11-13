import {CourseError,validCourseId} from "./course-format.ts";
export type CourseDeleteInput={courseId:string;fingerprint:string;expectedPublicationRevision:number};
export type CourseDeletion={courseId:string;fingerprint:string;title:string;deletedAt:string;publicationRevision:number};
const object=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==="object"&&!Array.isArray(v);
const revision=(v:unknown):v is number=>Number.isSafeInteger(v)&&Number(v)>=0&&Number(v)<Number.MAX_SAFE_INTEGER;
const hash=(v:unknown):v is string=>typeof v==="string"&&/^[0-9a-f]{64}$/.test(v);
export function parseCourseDeleteInput(v:unknown):CourseDeleteInput{
 if(!object(v)||Object.keys(v).length!==3||!Object.keys(v).every(k=>["courseId","fingerprint","expectedPublicationRevision"].includes(k))||!validCourseId(v.courseId)||!hash(v.fingerprint)||!revision(v.expectedPublicationRevision))throw new CourseError("invalid","削除するコースと公開状態を確認してください。");
 return {courseId:v.courseId as string,fingerprint:v.fingerprint,expectedPublicationRevision:v.expectedPublicationRevision};
}
export function parseCourseDeletion(v:unknown):CourseDeletion{
 if(!object(v)||Object.keys(v).length!==5||!Object.keys(v).every(k=>["courseId","fingerprint","title","deletedAt","publicationRevision"].includes(k))||!validCourseId(v.courseId)||!hash(v.fingerprint)||typeof v.title!=="string"||!v.title.trim()||v.title.length>100||!revision(v.publicationRevision)||typeof v.deletedAt!=="string"||!Number.isFinite(Date.parse(v.deletedAt))||new Date(v.deletedAt).toISOString()!==v.deletedAt)throw new CourseError("unavailable","コースの削除記録を確認できません。");
 return {courseId:v.courseId as string,fingerprint:v.fingerprint,title:v.title,deletedAt:v.deletedAt,publicationRevision:v.publicationRevision};
}
