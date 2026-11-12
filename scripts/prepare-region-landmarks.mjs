import fs from "node:fs";import {join,resolve} from "node:path";import {fileURLToPath} from "node:url";import {createHash,randomUUID} from "node:crypto";
import {regionTargets,regionBounds,regionSourceHash} from "../lib/landmarks/region-source.ts";
import {createLandmarkStorage} from "../lib/landmarks/local-storage.ts";
import {createMapillaryClient} from "../lib/landmarks/mapillary.ts";
import {distanceMeters} from "../lib/route/graph.ts";
import {prepareCrop} from "./lib/landmark-crop.mjs";
try{process.loadEnvFile(".env.local")}catch{}
const hash=b=>createHash("sha256").update(b).digest("hex"),sort=(a,b)=>a.id.localeCompare(b.id,"en");
export async function parallelJobs(items,concurrency,run,stop=()=>false){let next=0;await Promise.all(Array.from({length:Math.min(concurrency,items.length)},async()=>{while(!stop()){const i=next++;if(i>=items.length)break;await run(items[i],i)}}))}
export function regionalPhotoPlan(targets,caches){
 const chosen=new Map();for(const target of targets){const cache=caches.get(target.key);if(!cache)continue;const list=cache.candidates.filter(c=>c.kind==="unique"&&distanceMeters(c.point,target.point)<=30).sort((a,b)=>Number(b.classification==="object--sign--store")-Number(a.classification==="object--sign--store")||distanceMeters(target.point,a.point)-distanceMeters(target.point,b.point)||sort(a,b));for(const c of list.slice(0,3))chosen.set(c.id,c)}
 return [...chosen.values()].sort(sort);
}
export async function prepareRegion(options={}){
 const root=resolve(options.directory??process.env.LANDMARK_REGION_DIR??".local-data/landmark-region"),raw=join(root,"raw"),out=resolve(options.output??"public/landmarks/miura-v1");
 const targets=regionTargets(),storage=createLandmarkStorage(raw,undefined,{targets:2500,assets:5000,misses:5000}),client=options.client??createMapillaryClient(process.env.MAPILLARY_ACCESS_TOKEN),fetching=options.fetch===true,offline=options.offline===true,errors=[],caches=new Map();
 if(fetching&&!client.configured)throw Error("not-configured");
 let aborted=false,completed=0;
 const record=(stage,id,e)=>{const code=e&&typeof e.code==="string"&&/^[a-z0-9-]+$/.test(e.code)?e.code:"unavailable";errors.push({stage,id,code});if(["authorization","rate-limit","not-configured"].includes(code)||errors.filter(e=>e.stage===stage).length>=3)aborted=true};
 for(const target of targets){const value=storage.target(target.key);if(value)caches.set(target.key,value)}
 if(fetching)await parallelJobs(targets.filter(t=>!caches.has(t.key)).slice(0,options.maxJunctions??targets.length),3,async target=>{try{const value=await client.target(target);storage.saveTarget(value);caches.set(target.key,value)}catch(e){record("junction",target.key,e)}if(++completed%100===0)options.progress?.({stage:"junction",completed,ready:caches.size,total:targets.length})},()=>aborted);
 const plan=regionalPhotoPlan(targets,caches);let photoDone=0;
 if(fetching&&!aborted)await parallelJobs(plan.filter(c=>!storage.asset(c.id.slice(10))&&!storage.photoFailure(c.id.slice(10))).slice(0,options.maxPhotos??5000),3,async c=>{try{await client.photo(c,storage)}catch(e){if(e?.code!=="no-usable-photo")record("photo",c.id,e)}if(++photoDone%50===0)options.progress?.({stage:"photo",completed:photoDone,total:plan.length})},()=>aborted);
 // Also preserve already prepared demonstration objects from earlier bounded batches.
 const features=new Map();for(const target of targets)for(const c of caches.get(target.key)?.candidates??[])features.set(c.id,c);
 if(fs.existsSync(raw))for(const name of fs.readdirSync(raw).filter(n=>/^target-[a-f0-9]{64}\.json$/.test(n)).sort()){const value=storage.target(name.slice(7,-5));for(const c of value?.candidates??[])if(c.point.lat>=regionBounds.south&&c.point.lat<=regionBounds.north&&c.point.lon>=regionBounds.west&&c.point.lon<=regionBounds.east)features.set(c.id,c)}
 const selected=[...features.values()].sort(sort),photos=[],cropErrors=[];
 if(options.export!==false){fs.mkdirSync(out,{recursive:true});for(const c of selected){if(c.kind!=="unique")continue;const id=c.id.slice(10),meta=storage.asset(id);if(!meta)continue;try{
  const source=storage.image(id);if(!source||!("bytes" in source))continue;const bytes=await prepareCrop(source.bytes,meta.roi),sha256=hash(bytes),filename=sha256+".png",path="/landmarks/miura-v1/"+filename;
  if(!fs.existsSync(join(out,filename)))fs.writeFileSync(join(out,filename),bytes,{flag:"wx"});
  photos.push({asset:{...meta,crop:{size:128,version:1,path,sha256,contentType:"image/png"}},path,sha256,bytes:bytes.length});
 }catch{cropErrors.push(id)}}}
 const junctions=targets.map(t=>{const cache=caches.get(t.key);return {key:t.key,point:t.point,status:!cache?"missing":cache.partial?"partial":"ready",candidateIds:(cache?.candidates??[]).map(c=>c.id),fetchedAt:cache?.fetchedAt??null}});
 const stats={junctions:targets.length,ready:junctions.filter(t=>t.status==="ready").length,partial:junctions.filter(t=>t.status==="partial").length,missing:junctions.filter(t=>t.status==="missing").length,features:selected.length,photos:photos.length,qualityMisses:plan.filter(c=>storage.photoFailure(c.id.slice(10))).length};
 const priorFile=join(out,"manifest.json"),prior=fs.existsSync(priorFile)?JSON.parse(fs.readFileSync(priorFile,"utf8")):null;
 const content={version:2,id:"miura-region-landmarks-v1",bounds:regionBounds,sourceHash:regionSourceHash,imageLicense:"https://creativecommons.org/licenses/by-sa/4.0/",metadataLicense:"https://opendatacommons.org/licenses/odbl/1-0/",crop:{size:128,version:1},features:selected,junctions,photos,stats};
 const contentHash=hash(JSON.stringify(content)),preparedAt=prior?.contentHash===contentHash?prior.preparedAt:new Date().toISOString();
 const manifest={...content,contentHash,preparedAt};
 const canExport=options.export!==false&&!aborted&&!errors.length&&!cropErrors.length&&(stats.missing===0||options.allowPartial===true);
 if(canExport){
  const temp=join(out,"manifest-"+randomUUID()+".tmp");fs.writeFileSync(temp,JSON.stringify(manifest)+"\n");fs.renameSync(temp,priorFile);
  const notice="# Mapillary regional landmarks\n\nImages/crops: CC BY-SA 4.0 — https://creativecommons.org/licenses/by-sa/4.0/ . Cropped/resized to 128x128 without generated pixels or background removal. Authors, original image IDs, dates and crop boxes are recorded in manifest.json. No endorsement or current on-site accuracy is implied.\n\nDerived metadata: contains information from Mapillary, made available under ODbL 1.0 — https://opendatacommons.org/licenses/odbl/1-0/ . The entire distributed derived database is manifest.json in this directory. Source: https://www.mapillary.com/ . These licenses are separate from application source code.\n\n"+photos.map(p=>"- "+p.path.split("/").at(-1)+" — "+p.asset.creator+"; https://www.mapillary.com/app/?pKey="+p.asset.imageId+" ; https://www.mapillary.com/app/user/"+encodeURIComponent(p.asset.creator)+" ; CC BY-SA 4.0; modified: crop and resize.").join("\n")+"\n";fs.writeFileSync(join(out,"NOTICE.md"),notice);
 }
 const report={...stats,selectedPhotoFeatures:plan.length,cropErrors:cropErrors.length,errors,requestCounts:client.requestCounts,exported:canExport,contentHash:canExport?contentHash:null,imageBytes:photos.reduce((n,p)=>n+p.bytes,0),aborted,offline,remainingPhotoRequests:plan.filter(c=>!storage.asset(c.id.slice(10))&&!storage.photoFailure(c.id.slice(10))).length};
 fs.mkdirSync(root,{recursive:true});fs.writeFileSync(join(root,"last-report.json"),JSON.stringify(report,null,2)+"\n");return report;
}
export async function regionCommand(argv=process.argv.slice(2)){
 const options={fetch:false,offline:false,export:true};
 for(let i=0;i<argv.length;i++){const arg=argv[i];if(arg==="--fetch")options.fetch=true;else if(arg==="--offline")options.offline=true;else if(arg==="--allow-partial")options.allowPartial=true;else if(arg==="--report")options.export=false;else if(arg==="--max-junctions"||arg==="--max-photos"){const n=Number(argv[++i]);if(!Number.isInteger(n)||n<1||n>5000)throw Error("invalid-limit");options[arg==="--max-junctions"?"maxJunctions":"maxPhotos"]=n}else throw Error("invalid-option")}
 if(options.fetch&&options.offline)throw Error("invalid-mode");
 options.progress=p=>console.error(JSON.stringify(p));const report=await prepareRegion(options);console.log(JSON.stringify(report,null,2));if(report.errors.length||report.cropErrors||report.aborted)process.exitCode=1;else if(options.export!==false&&(report.missing||report.remainingPhotoRequests))process.exitCode=2;return report;
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))regionCommand().catch(()=>{console.error(JSON.stringify({error:"取得設定・保存先・入力条件を確認してください。秘密情報/外部応答/署名URLは表示しません。"}));process.exitCode=1});
