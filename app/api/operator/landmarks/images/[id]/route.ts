import {getLandmarkStorage} from "../../../../../../lib/landmarks/storage";
export const runtime="nodejs";export const dynamic="force-dynamic";
export async function GET(request:Request,{params}:{params:Promise<{id:string}>}){
 const {id}=await params;if(!/^\d{1,30}$/.test(id))return new Response(null,{status:404});
 try{const image=getLandmarkStorage().image(id);if(!image)return new Response(null,{status:404,headers:{"Cache-Control":"no-store"}});
 const query=new URL(request.url).searchParams;if(query.has("image")&&query.get("image")!==image.meta.imageId||query.has("policy")&&query.get("policy")!==String(image.meta.policyVersion))return new Response(null,{status:404,headers:{"Cache-Control":"no-store"}});
 return new Response(null,{status:307,headers:{Location:image.path!,"Cache-Control":"private, max-age=60"}});
 }catch{return new Response(null,{status:503,headers:{"Cache-Control":"no-store"}})}
}
