import {getSpotRepository} from "../../../../lib/spots/local-repository";
import {readOperatorJson,operatorFailure,noStore} from "../../../../lib/operator/http";
export const runtime="nodejs";
export const dynamic="force-dynamic";
export function GET(){try{return Response.json({spots:getSpotRepository().list()},{headers:noStore})}catch(error){return operatorFailure(error)}}
async function write(request:Request,action:(value:unknown)=>unknown,key:"spot"|"deleted"){
 try{return Response.json({[key]:action(await readOperatorJson(request))},{headers:noStore})}catch(error){return operatorFailure(error)}
}
export function PUT(request:Request){return write(request,value=>getSpotRepository().save(value),"spot")}
export function DELETE(request:Request){return write(request,value=>getSpotRepository().remove(value),"deleted")}
