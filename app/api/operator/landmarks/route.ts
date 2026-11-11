import {loadLandmarkDataset} from "../../../../lib/landmarks/dataset";
import {workbenchState,operateWorkbench} from "../../../../lib/landmarks/workbench";
import {MapillaryError} from "../../../../lib/landmarks/mapillary";
import {readOperatorJson,operatorFailure,noStore} from "../../../../lib/operator/http";
export const runtime="nodejs";export const dynamic="force-dynamic";
export function GET(request:Request){try{const source=new URL(request.url).searchParams.get("source")==="draft"?"draft":"sample";return Response.json(workbenchState(loadLandmarkDataset(source)),{headers:noStore})}catch{return Response.json({error:"ルートまたはPoC保存先を読み込めません。下書きと保存先を確認してください。",code:"unavailable"},{status:503,headers:noStore})}}
export async function POST(request:Request){
 let input;try{input=await readOperatorJson(request,500000)}catch(error){return operatorFailure(error)}
 try{return Response.json(await operateWorkbench(input),{headers:noStore})}
 catch(error){
  const reason=error instanceof Error?error.message:"unavailable",conflict=["dataset-conflict","review-conflict"].includes(reason),invalid=reason.startsWith("invalid-");
  const code=error instanceof MapillaryError?error.code:conflict?reason:invalid?"invalid":"cache-unavailable";
  const message=conflict?"ルートまたは採用状態が別の画面で変わりました。再読込みして確認してください。":invalid?"操作対象を確認してやり直してください。":error instanceof MapillaryError?"Mapillaryの取得を完了できませんでした。設定・接続・取得制限を確認してください。":"PoC保存先を利用できません。破損・同時操作・保存上限を確認してください。";
  return Response.json({error:message,code},{status:conflict?409:invalid?400:503,headers:noStore});
 }
}
