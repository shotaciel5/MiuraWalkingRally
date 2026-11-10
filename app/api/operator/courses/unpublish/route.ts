import {getPublicationRepository} from "../../../../../lib/operator/publication-repository";
import {readOperatorJson,operatorFailure,noStore} from "../../../../../lib/operator/http";
export const runtime="nodejs";export const dynamic="force-dynamic";
export async function POST(request:Request){
 try{return Response.json(getPublicationRepository().unpublish(await readOperatorJson(request)),{headers:noStore})}catch(error){return operatorFailure(error)}
}
