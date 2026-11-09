import type {Metadata} from "next";
import Link from "next/link";
import {notFound} from "next/navigation";
import SiteHeader from "../../site-header";
import PublishedParticipation from "../../published-participation";
import {PublishedBadge,PublishedFacts,PublishedNotice,PublishedUnavailable,PublishedAttribution} from "../../published-ui";
import {RallyFooter,WalkingEstimateNote} from "../../rally-ui";
import {validCourseId} from "../../../lib/operator/course-format";
import {getPublicationRepository} from "../../../lib/operator/publication-repository";
import {projectPublishedCourse} from "../../../lib/published-course";
export const runtime="nodejs";export const dynamic="force-dynamic";
export const metadata:Metadata={title:"公開コース"};
export default async function PublishedDetail({params}:{params:Promise<{id:string}>}){
 const {id}=await params;if(!validCourseId(id))notFound();
 let value;try{value=getPublicationRepository().get(id)}catch{value=undefined}
 if(value===null)notFound();
 if(!value)return <main className="participant-main" data-participant-page="published-detail"><SiteHeader/><div id="page-content" tabIndex={-1}><PublishedUnavailable href={"/rallies/"+id}/></div><PublishedAttribution/><RallyFooter/></main>;
 const course=projectPublishedCourse(value.course,value.publication),rally=course.rally;
 return <main className="participant-main published-detail" data-participant-page="published-detail" data-published-course-id={id}>
  <SiteHeader/><nav className="rally-breadcrumb" aria-label="パンくずリスト"><Link href="/">公開コース</Link><span aria-hidden="true">/</span><span aria-current="page">{rally.title}</span></nav>
  <section className="published-hero" id="page-content" tabIndex={-1}><p className="eyebrow">{rally.area}</p><PublishedBadge/><h1>{rally.title}</h1><p className="participant-lead">{rally.startName}から、{rally.finishName}へ。</p></section>
  <PublishedNotice/><div className="rally-detail-layout"><div>
   <PublishedParticipation key={rally.id+":"+rally.revision} rally={rally}/>
   <section className="participant-panel" aria-labelledby="published-order-title"><h2 id="published-order-title">訪問する地点</h2><ol className="participant-stop-list">{course.stops.map((s,i)=><li key={s.id} data-published-order={s.id}><span className="participant-stop-marker" aria-hidden="true">{s.kind==="start"?"S":s.kind==="finish"?"G":i}</span><div><span className="participant-stop-role">{s.role}</span><h3>{s.name}</h3>{s.description&&<p>{s.description}</p>}<p className="participant-note">写真は未登録です。</p></div></li>)}</ol></section>
  </div><aside className="participant-panel rally-summary"><h2>コースの目安</h2><PublishedFacts rally={rally}/><WalkingEstimateNote/><dl className="rally-summary-list"><div><dt>チェックポイント</dt><dd>{rally.checkpointIds.length}地点</dd></div><div><dt>公開日</dt><dd><time dateTime={rally.publishedAt}>{new Date(rally.publishedAt).toLocaleDateString("ja-JP",{timeZone:"Asia/Tokyo"})}</time></dd></div></dl><p className="participant-note">名称・地点順・道順は公開した保存版の内容です。開始後も同じ版を表示します。</p></aside></div>
  <Link href="/" className="rally-secondary-link">公開コースへ戻る</Link><PublishedAttribution/><RallyFooter/>
 </main>;
}
