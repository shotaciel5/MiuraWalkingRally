import {createLandmarkStorage} from "../../../../../../lib/landmarks/storage";
export const runtime="nodejs";export const dynamic="force-dynamic";
export async function GET(_request:Request,{params}:{params:Promise<{id:string}>}){
 const {id}=await params;if(!/^\d{1,30}$/.test(id))return new Response(null,{status:404});
 try{const image=createLandmarkStorage().image(id);if(!image)return new Response(null,{status:404,headers:{"Cache-Control":"no-store"}});
 return new Response(new Uint8Array(image.bytes),{headers:{"Content-Type":image.meta.contentType,"Cache-Control":"private, max-age=60","X-Content-Type-Options":"nosniff","Cross-Origin-Resource-Policy":"same-origin"}});
 }catch{return new Response(null,{status:503,headers:{"Cache-Control":"no-store"}})}
}
