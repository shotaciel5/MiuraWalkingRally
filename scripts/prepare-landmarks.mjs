// Route-specific inspection is now offline. All token-based acquisition lives in landmarks:region.
import {resolve} from "node:path";import {fileURLToPath} from "node:url";
import {loadLandmarkDataset} from "../lib/landmarks/dataset.ts";
import {workbenchState} from "../lib/landmarks/workbench.ts";
import {photoSuggestions} from "../lib/landmarks/preparation.ts";
try{process.loadEnvFile(".env.local")}catch{}
export async function prepareCommand(argv=process.argv.slice(2)){
 let source="draft";for(let i=0;i<argv.length;i++){if(argv[i]==="--source"){source=argv[++i];if(!["sample","draft"].includes(source))throw Error("invalid-source")}else if(argv[i]==="--cache-only"){}else if(argv[i]==="--max-junctions"){const n=Number(argv[++i]);if(!Number.isInteger(n)||n<1||n>200)throw Error("invalid-limit")}else throw Error("invalid-option")}
 const dataset=loadLandmarkDataset(source),state=workbenchState(dataset),summary={version:2,mode:"bundled-only",source,datasetId:dataset.id,cards:dataset.cards.length,targets:dataset.targets.length,preparedTargets:Object.keys(state.targets).length,remainingTargets:dataset.targets.length-Object.keys(state.targets).length,stairsCards:dataset.cards.filter(c=>(c.referenceContext??c.context).steps.length).length,readyPhotos:photoSuggestions(state).length,requestCounts:{graph:0,images:0},photos:photoSuggestions(state).map(p=>({candidateId:p.candidate.id,imageId:p.asset.imageId,policyVersion:p.asset.policyVersion,roi:p.asset.roi,sequences:p.sequences,crop:p.asset.crop}))};
 console.log(JSON.stringify(summary,null,2));return summary;
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))prepareCommand().catch(()=>{console.error("下書き・静的索引・引数を確認してください。外部取得は行いません。");process.exitCode=1});
