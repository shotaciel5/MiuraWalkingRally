import {CourseError,validCourseId} from "./course-format.ts";
export type PublishInput={courseId:string;fingerprint:string;expectedRevision:number};
export type CoursePublication={courseId:string;fingerprint:string;publishedAt:string;status:"published"|"withdrawn";revision:number;changedAt:string};
const record=(value:unknown):value is Record<string,unknown>=>!!value&&typeof value==="object"&&!Array.isArray(value);
const fields=(value:Record<string,unknown>,keys:string[])=>Object.keys(value).length===keys.length&&keys.every(k=>Object.hasOwn(value,k));
const hash=(value:unknown):value is string=>typeof value==="string"&&/^[0-9a-f]{64}$/.test(value);
const natural=(value:unknown):value is number=>typeof value==="number"&&Number.isSafeInteger(value)&&value>=0;
const iso=(value:unknown):value is string=>{try{return typeof value==="string"&&new Date(value).toISOString()===value}catch{return false}};
export function parsePublishInput(value:unknown):PublishInput{
 if(!record(value)||!fields(value,["courseId","fingerprint","expectedRevision"])||!validCourseId(value.courseId)||!hash(value.fingerprint)||!natural(value.expectedRevision))throw new CourseError("invalid","公開状態と対象を開き直して確認してください。");
 return {courseId:value.courseId,fingerprint:value.fingerprint,expectedRevision:value.expectedRevision};
}
export function parsePublication(value:unknown):CoursePublication{
 if(!record(value)||!fields(value,["courseId","fingerprint","publishedAt","status","revision","changedAt"])||!validCourseId(value.courseId)||!hash(value.fingerprint)||!iso(value.publishedAt)||!iso(value.changedAt)||!natural(value.revision)||value.revision<1||(value.status!=="published"&&value.status!=="withdrawn")||value.changedAt<value.publishedAt||(value.status==="published"&&value.changedAt!==value.publishedAt)||(value.status==="withdrawn"&&value.revision<2))throw new CourseError("unavailable","コースの公開情報を確認できません。保存ファイルを確認してください。");
 return {courseId:value.courseId,fingerprint:value.fingerprint,publishedAt:value.publishedAt,status:value.status,revision:value.revision,changedAt:value.changedAt};
}
