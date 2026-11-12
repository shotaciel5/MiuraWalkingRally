// Reproducible local preparation for whichever route is in the saved draft.
// No fixture IDs, image IDs, or token values belong in this workflow.
import {fileURLToPath} from "node:url";
import {resolve} from "node:path";
import {loadLandmarkDataset} from "../lib/landmarks/dataset.ts";
import {workbenchState,operateWorkbench} from "../lib/landmarks/workbench.ts";
import {createLandmarkStorage} from "../lib/landmarks/storage.ts";
import {createMapillaryClient} from "../lib/landmarks/mapillary.ts";
import {runLandmarkPreparation,photoPreparationPlan,photoSuggestions} from "../lib/landmarks/preparation.ts";
try{process.loadEnvFile(".env.local")}catch{}
export async function prepareCommand(argv=process.argv.slice(2)){
 let source="draft",cacheOnly=false,junctionLimit=20;
 for(let i=0;i<argv.length;i++){if(argv[i]==="--source"){source=argv[++i];if(!["draft","sample"].includes(source))throw Error("invalid-source")}else if(argv[i]==="--cache-only")cacheOnly=true;else if(argv[i]==="--max-junctions"){junctionLimit=Number(argv[++i]);if(!Number.isInteger(junctionLimit)||junctionLimit<1||junctionLimit>200)throw Error("invalid-junction-limit")}else throw Error("invalid-option")}
 const dataset=loadLandmarkDataset(source),storage=createLandmarkStorage(),client=createMapillaryClient(process.env.MAPILLARY_ACCESS_TOKEN),initial=workbenchState(dataset,storage),started=performance.now();
 const result=cacheOnly?{state:initial,report:{version:1,datasetId:dataset.id,targets:dataset.targets.length,preparedTargets:Object.keys(initial.targets).length,remainingTargets:dataset.targets.filter(t=>!initial.targets[t.key]).length,photoCandidates:photoPreparationPlan(initial).map(c=>c.id),photoRequests:0,readyPhotos:photoSuggestions(initial).length,qualityMisses:Object.keys(initial.photoFailures).length,stopped:false,errors:[]}}:await runLandmarkPreparation({initial,junctionLimit,target:key=>operateWorkbench({action:"prepare",source,datasetId:dataset.id,targetKey:key},storage,client),photo:id=>operateWorkbench({action:"photo",source,datasetId:dataset.id,candidateId:id},storage,client)});
 const summary={...result.report,source,cards:dataset.cards.length,stairsCards:dataset.cards.filter(c=>(c.referenceContext??c.context).steps.length).length,requestCounts:client.requestCounts,elapsedMs:Math.round(performance.now()-started),cacheOnly,photos:photoSuggestions(result.state).map(p=>({candidateId:p.candidate.id,imageId:p.asset.imageId,policyVersion:p.asset.policyVersion,roi:p.asset.roi,sequences:p.sequences}))};
 console.log(JSON.stringify(summary,null,2));if(summary.errors.length)process.exitCode=1;else if(!cacheOnly&&summary.remainingTargets)process.exitCode=2;return summary;
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))prepareCommand().catch(()=>{console.error(JSON.stringify({error:"ルート・設定・PoC保存先を確認してください。値や外部応答は表示しません。"}));process.exitCode=1});
