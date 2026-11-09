import {getDraftRepository} from "../../../../lib/operator/draft-repository";
import {readOperatorJson,operatorFailure,noStore} from "../../../../lib/operator/http";
export const runtime="nodejs";
export const dynamic="force-dynamic";
export function GET(){try{return Response.json(getDraftRepository().load(),{headers:noStore})}catch(error){return operatorFailure(error)}}
export async function POST(request:Request){try{return Response.json(getDraftRepository().pickCorrection(await readOperatorJson(request)),{headers:noStore})}catch(error){return operatorFailure(error)}}
export async function PUT(request:Request){try{return Response.json(getDraftRepository().saveCorrection(await readOperatorJson(request)),{headers:noStore})}catch(error){return operatorFailure(error)}}
