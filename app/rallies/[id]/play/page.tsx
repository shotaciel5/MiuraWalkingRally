import type {Metadata} from "next";
import Link from "next/link";
import {notFound} from "next/navigation";
import SiteHeader from "../../../site-header";
import PublishedParticipation from "../../../published-participation";
import {PublishedStopped,PublishedBadge,PublishedNotice,PublishedUnavailable,PublishedAttribution} from "../../../published-ui";
import {RallyFooter} from "../../../rally-ui";
import {validCourseId} from "../../../../lib/operator/course-format";
import {getPublicationRepository} from "../../../../lib/operator/publication-repository";
import {projectPublishedCourse} from "../../../../lib/published-course";
export const runtime="nodejs";export const dynamic="force-dynamic";
export const metadata:Metadata={title:"コマ地図"};
export default async function PublishedPlay({params}:{params:Promise<{id:string}>}){
 const {id}=await params;if(!validCourseId(id))notFound();
 let value;try{value=getPublicationRepository().get(id)}catch{value=undefined}
 if(value===null)notFound();
 if(!value)return <main className="participant-main" data-participant-page="published-play"><SiteHeader/><div id="page-content" tabIndex={-1}><PublishedUnavailable href={"/rallies/"+id+"/play"}/></div><PublishedAttribution/><RallyFooter/></main>;
 if(!value.course)return <main className="participant-main" data-participant-page="published-play"><SiteHeader/><section id="page-content" tabIndex={-1}><PublishedStopped/></section><PublishedAttribution/><RallyFooter/></main>;
 const course=projectPublishedCourse(value.course,value.publication),rally=course.rally;
 return <main className="participant-main published-play" data-participant-page="published-play" data-published-course-id={id}>
  <SiteHeader/><nav className="rally-breadcrumb" aria-label="パンくずリスト"><Link href="/">公開コース</Link><span aria-hidden="true">/</span><Link href={rally.href}>{rally.title}</Link><span aria-hidden="true">/</span><span aria-current="page">コマ地図</span></nav>
  <section className="participation-heading" id="page-content" tabIndex={-1}><p className="eyebrow">WALK THE COURSE</p><PublishedBadge/><h1>{rally.title}</h1><p className="participant-lead">ひとコマずつ、道と目印を読み解く。</p></section>
  <PublishedNotice/><PublishedParticipation key={rally.id+":"+rally.revision} rally={rally} course={course}/><Link className="rally-secondary-link" href={rally.href}>コース詳細へ戻る</Link><PublishedAttribution/><RallyFooter/>
 </main>;
}
