import {SpotError} from "../spots/editing.ts";
export const noStore={"Cache-Control":"no-store"};
class RequestError extends Error{status:number;constructor(status:number,message:string){super(message);this.status=status}}
export function operatorFailure(error:unknown){
 const status=error instanceof RequestError?error.status:error instanceof SpotError?{invalid:400,conflict:409,missing:404,unavailable:503}[error.code]:503;
 const reason=error&&typeof error==="object"&&"reason" in error&&typeof error.reason==="string"?error.reason:undefined;
 return Response.json({error:error instanceof RequestError||error instanceof SpotError?error.message:"保存先を利用できません。内容を残して再試行してください。",reason},{status,headers:noStore});
}
export async function readOperatorJson(request:Request,maxBytes=16384){
 let origin:URL;try{origin=new URL(request.headers.get("origin")||"")}catch{throw new RequestError(403,"この画面から操作をやり直してください。")}
 if(!["127.0.0.1","localhost","[::1]"].includes(origin.hostname)||origin.host!==request.headers.get("host")||origin.protocol!==new URL(request.url).protocol)throw new RequestError(403,"この画面から操作をやり直してください。");
 if(request.headers.get("content-type")?.split(";")[0].trim()!=="application/json")throw new RequestError(415,"JSON形式で操作してください。");
 if(Number(request.headers.get("content-length"))>maxBytes)throw new RequestError(400,"入力が長すぎます。");
 const reader=request.body?.getReader();if(!reader)throw new RequestError(400,"保存内容がありません。");
 const chunks:Uint8Array[]=[];let length=0;
 while(true){const {value,done}=await reader.read();if(done)break;length+=value.byteLength;if(length>maxBytes){await reader.cancel();throw new RequestError(400,"入力が長すぎます。")}chunks.push(value)}
 const bytes=new Uint8Array(length);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.byteLength}
 try{return JSON.parse(new TextDecoder("utf-8",{fatal:true}).decode(bytes)) as unknown}catch{throw new RequestError(400,"保存内容の形式を確認してください。")}
}
