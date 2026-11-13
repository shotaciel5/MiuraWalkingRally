import {getCourseDeletionRepository} from "../../../../lib/operator/course-deletion-repository";
import {getCourseService} from "../../../../lib/operator/course-save";
import {readOperatorJson,operatorFailure,noStore} from "../../../../lib/operator/http";
export const runtime="nodejs";export const dynamic="force-dynamic";
export async function POST(request:Request){
 try{const saved=getCourseService().save(await readOperatorJson(request));return Response.json({id:saved.id,createdAt:saved.createdAt,fingerprint:saved.fingerprint},{headers:noStore})}catch(error){return operatorFailure(error)}
}

export async function DELETE(request:Request){
 try{return Response.json(getCourseDeletionRepository().remove(await readOperatorJson(request)),{headers:noStore})}catch(error){return operatorFailure(error)}
}
