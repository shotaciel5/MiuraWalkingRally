import {getPublicationRepository} from "../../../../../lib/operator/publication-repository";
import {noStore} from "../../../../../lib/operator/http";
export const runtime="nodejs";export const dynamic="force-dynamic";
export async function GET(_request:Request,{params}:{params:Promise<{id:string}>}){
 const {id}=await params;
 try{
  const value=getPublicationRepository().get(id);
  if(!value)return Response.json({status:"missing"},{status:404,headers:noStore});
  if(!value.course)return Response.json({status:"withdrawn"},{status:410,headers:noStore});
  return Response.json({status:"published",revision:"published-v1-"+value.publication.fingerprint},{headers:noStore});
 }catch{return Response.json({status:"unavailable"},{status:503,headers:noStore})}
}
