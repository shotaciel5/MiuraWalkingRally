import {CourseError,validCourseId} from "./course-format.ts";
export type PublishInput={courseId:string;fingerprint:string};
export type CoursePublication=PublishInput&{publishedAt:string};
const record=(value:unknown):value is Record<string,unknown>=>!!value&&typeof value==="object"&&!Array.isArray(value);
const fields=(value:Record<string,unknown>,keys:string[])=>Object.keys(value).length===keys.length&&keys.every(k=>Object.hasOwn(value,k));
const hash=(value:unknown):value is string=>typeof value==="string"&&/^[0-9a-f]{64}$/.test(value);
const iso=(value:unknown):value is string=>{try{return typeof value==="string"&&new Date(value).toISOString()===value}catch{return false}};
export function parsePublishInput(value:unknown):PublishInput{
 if(!record(value)||!fields(value,["courseId","fingerprint"])||!validCourseId(value.courseId)||!hash(value.fingerprint))throw new CourseError("invalid","公開する保存済みコースの識別情報を確認してください。");
 return {courseId:value.courseId,fingerprint:value.fingerprint};
}
export function parsePublication(value:unknown):CoursePublication{
 if(!record(value)||!fields(value,["courseId","fingerprint","publishedAt"])||!validCourseId(value.courseId)||!hash(value.fingerprint)||!iso(value.publishedAt))throw new CourseError("unavailable","コースの公開情報を確認できません。保存ファイルを確認してください。");
 return {courseId:value.courseId,fingerprint:value.fingerprint,publishedAt:value.publishedAt};
}
