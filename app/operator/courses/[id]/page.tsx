import type {Metadata} from "next";
import {notFound} from "next/navigation";
import SiteHeader from "../../../site-header";
import OperatorNav from "../../../operator-nav";
import {RallyFooter} from "../../../rally-ui";
import RallyPreviewView from "../../../rally-preview-view";
import {getCourseRepository} from "../../../../lib/operator/course-repository";
import {getPublicationRepository} from "../../../../lib/operator/publication-repository";
import type {CoursePublication} from "../../../../lib/operator/publication";
import {validCourseId} from "../../../../lib/operator/course-format";
export const runtime="nodejs";export const dynamic="force-dynamic";
export const metadata:Metadata={title:"保存済みコース詳細（運営者向け）"};
export default async function SavedCoursePage({params}:{params:Promise<{id:string}>}){
 const {id}=await params;if(!validCourseId(id))notFound();
 let course;try{course=getCourseRepository().get(id)}catch{course=undefined}
 if(course===null)notFound();
 let publication:CoursePublication|null|undefined;
 if(course){try{publication=getPublicationRepository().get(id)?.publication??null}catch{publication=undefined}}
 return <main className="participant-main operator-main" data-operator-page="saved-course"><SiteHeader view="operator"/><section id="page-content" tabIndex={-1}><OperatorNav view="courses"/>
 {course?<RallyPreviewView data={course.payload.preview} saved={{id:course.id,createdAt:course.createdAt,fingerprint:course.fingerprint,publication}}/>:<section className="preview-panel" role="alert" data-saved-course-error><h1>保存済みコースを読み込めませんでした</h1><p>保存形式・内容を確認してください。最新データで再生成した結果に置き換えていません。</p><div className="preview-actions"><a href={"/operator/courses/"+id}>再試行する</a><a href="/operator/courses">保存済み一覧へ</a></div></section>}
 </section><RallyFooter/></main>;
}
