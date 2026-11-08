import {getSpotRepository} from "../../../../lib/spots/local-repository";
import {SpotError} from "../../../../lib/spots/editing";
export const runtime="nodejs";
export const dynamic="force-dynamic";
const headers={"Cache-Control":"no-store"};
function failure(error:unknown){
  const status=error instanceof SpotError?{invalid:400,conflict:409,missing:404,unavailable:503}[error.code]:503;
  return Response.json({error:error instanceof SpotError?error.message:"スポットの保存先を利用できません。入力を残したまま、保存先を確認して再試行してください。"},{status,headers});
}
export function GET(){
  try{return Response.json({spots:getSpotRepository().list()},{headers})}catch(error){return failure(error)}
}
export async function PUT(request:Request){
  let origin:URL;try{origin=new URL(request.headers.get("origin")||"")}catch{return Response.json({error:"この画面から保存をやり直してください。"},{status:403,headers})}
  if(!["127.0.0.1","localhost","[::1]"].includes(origin.hostname)||origin.host!==request.headers.get("host")||origin.protocol!==new URL(request.url).protocol)return Response.json({error:"この画面から保存をやり直してください。"},{status:403,headers});
  if(request.headers.get("content-type")?.split(";")[0].trim()!=="application/json")return Response.json({error:"JSON形式で保存してください。"},{status:415,headers});
  try {
    if(Number(request.headers.get("content-length"))>16384)throw new SpotError("invalid","入力が長すぎます。");
    const reader=request.body?.getReader();if(!reader)throw new SpotError("invalid","保存内容がありません。");
    const chunks:Uint8Array[]=[];let length=0;
    while(true){const {value,done}=await reader.read();if(done)break;length+=value.byteLength;if(length>16384){await reader.cancel();throw new SpotError("invalid","入力が長すぎます。")}chunks.push(value)}
    const bytes=new Uint8Array(length);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.byteLength}
    let value:unknown;try{value=JSON.parse(new TextDecoder("utf-8",{fatal:true}).decode(bytes))}catch{throw new SpotError("invalid","保存内容の形式を確認してください。")}
    return Response.json({spot:getSpotRepository().save(value)},{headers});
  }catch(error){return failure(error)}
}
