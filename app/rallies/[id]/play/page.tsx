import type {Metadata} from "next";
import {notFound} from "next/navigation";
import PublishedParticipation from "../../../published-participation";
import {PublishedStopped,PublishedUnavailable,PublishedAttribution} from "../../../published-ui";
import {validCourseId} from "../../../../lib/operator/course-format";
import {getPublicationRepository} from "../../../../lib/operator/publication-repository";
import {projectPublishedCourse} from "../../../../lib/published-course";
export const runtime="nodejs";export const dynamic="force-dynamic";
export const metadata:Metadata={title:"コマ地図"};
export default async function PublishedPlay({params}:{params:Promise<{id:string}>}){
 const {id}=await params;if(!validCourseId(id))notFound();
 let value;try{value=getPublicationRepository().get(id)}catch{value=undefined}
 if(value===null)notFound();
 if(!value||!value.course)return <main className="walk-main walk-unavailable" data-participant-page="published-play"><div id="page-content" tabIndex={-1}>{value?<PublishedStopped/>:<PublishedUnavailable href={"/rallies/"+id+"/play"}/>}</div><PublishedAttribution/></main>;
 const course=projectPublishedCourse(value.course,value.publication);
 return <main className="walk-main" id="page-content" data-participant-page="published-play" data-published-course-id={id}><h1 className="walk-sr-only">コマ地図</h1><PublishedParticipation key={course.rally.id+":"+course.rally.revision} rally={course.rally} course={course}/></main>;
}
