import {getCourseService} from "../../../../lib/operator/course-save";
import {readOperatorJson,operatorFailure,noStore} from "../../../../lib/operator/http";
export const runtime="nodejs";export const dynamic="force-dynamic";
export async function POST(request:Request){
 try{const saved=getCourseService().save(await readOperatorJson(request));return Response.json({id:saved.id,createdAt:saved.createdAt,fingerprint:saved.fingerprint},{headers:noStore})}catch(error){return operatorFailure(error)}
}
