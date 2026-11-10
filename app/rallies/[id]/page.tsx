import {notFound,redirect} from "next/navigation";
import {validCourseId} from "../../../lib/operator/course-format";
export const runtime="nodejs";export const dynamic="force-dynamic";
export default async function PublishedDetail({params}:{params:Promise<{id:string}>}){
 const {id}=await params;if(!validCourseId(id))notFound();redirect("/rallies/"+id+"/play");
}
