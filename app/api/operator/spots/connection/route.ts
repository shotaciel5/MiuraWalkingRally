import {getSpotRepository} from "../../../../../lib/spots/local-repository";
import {validSpotId,SpotError} from "../../../../../lib/spots/editing";
import {roadConnectionForSpot} from "../../../../../lib/miura-road-connections";
import {operatorFailure,noStore} from "../../../../../lib/operator/http";
export const runtime="nodejs";
export const dynamic="force-dynamic";
export function GET(request:Request){
 try{
  const id=new URL(request.url).searchParams.get("id");if(!id||!validSpotId(id))throw new SpotError("invalid","スポットIDを確認してください。");
  const spot=getSpotRepository().list().find(s=>s.id===id);if(!spot)throw new SpotError("missing","このスポットは削除済み、または利用できません。台帳を読み直してください。");
  return Response.json({connection:roadConnectionForSpot(spot)},{headers:noStore});
 }catch(error){return operatorFailure(error)}
}
