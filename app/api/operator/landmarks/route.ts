import {getDraftRepository} from "../../../../lib/operator/draft-repository";
import {createRallyPreview} from "../../../../lib/operator/rally-preview";
import {prepareCourseSave} from "../../../../lib/operator/course-save";
import {freezeLandmarks} from "../../../../lib/landmarks/course-snapshot";
import {landmarkDatasetFromPreview} from "../../../../lib/landmarks/dataset";
import {loadLandmarkDataset} from "../../../../lib/landmarks/dataset";
import {workbenchState,operateWorkbench} from "../../../../lib/landmarks/workbench";
import {readOperatorJson,operatorFailure,noStore} from "../../../../lib/operator/http";
export const runtime="nodejs";export const dynamic="force-dynamic";
export function GET(request:Request){try{const source=new URL(request.url).searchParams.get("source")==="draft"?"draft":"sample";return Response.json(workbenchState(loadLandmarkDataset(source)),{headers:noStore})}catch{return Response.json({error:"ルートまたはPoC保存先を読み込めません。下書きと保存先を確認してください。",code:"unavailable"},{status:503,headers:noStore})}}
export async function POST(request:Request){
 let input;try{input=await readOperatorJson(request,500000)}catch(error){return operatorFailure(error)}
 try{const state=await operateWorkbench(input);if(state.dataset.source==="draft"){const current=getDraftRepository().load(),preview=createRallyPreview(current.draft,current.spots,current.corrections);if(preview.state!=="ready"||landmarkDatasetFromPreview(preview).id!==state.dataset.id)throw Error("dataset-conflict");const courseReceipt=prepareCourseSave(current,preview,freezeLandmarks(state)).receipt;return Response.json({...state,courseReceipt},{headers:noStore})}return Response.json(state,{headers:noStore})}
 catch(error){
  const reason=error instanceof Error?error.message:"unavailable",conflict=["dataset-conflict","review-conflict"].includes(reason),invalid=reason.startsWith("invalid-");
  const disabled=reason==="external-fetch-disabled";const code=disabled?reason:conflict?reason:invalid?"invalid":"cache-unavailable";
  const message=conflict?"ルートまたは採用状態が別の画面で変わりました。再読込みして確認してください。":invalid?"操作対象を確認してやり直してください。":disabled?"アプリ上の外部取得は無効です。開発PCの地域事前取得バッチを使用してください。":"PoC保存先を利用できません。破損・同時操作・保存上限を確認してください。";
  return Response.json({error:message,code},{status:disabled?403:conflict?409:invalid?400:503,headers:noStore});
 }
}
