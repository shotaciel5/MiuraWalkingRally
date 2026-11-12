import {distanceMeters} from "../route/graph.ts";
import {mapillaryKind,validPoint,type Candidate,type Target,type PhotoAsset} from "./model.ts";
import {detectionCrop} from "./detection-crop.ts";
import {MAX_IMAGE_BYTES,type LandmarkStorage} from "./local-storage.ts";
type Obj=Record<string,unknown>;
const obj=(v:unknown):Obj=>v&&typeof v==="object"&&!Array.isArray(v)?v as Obj:{};
const text=(v:unknown,max=200)=>typeof v==="string"?v.slice(0,max):"";
const id=(v:unknown)=>typeof v==="string"&&/^\d{1,30}$/.test(v)?v:"";
export class MapillaryError extends Error{code:string;constructor(code:string){super("Mapillary "+code);this.code=code}}
async function bytes(response:Response,limit:number){
 if(Number(response.headers.get("content-length"))>limit)throw new MapillaryError("response-too-large");
 const reader=response.body?.getReader();if(!reader)throw new MapillaryError("empty-response");const parts:Uint8Array[]=[];let length=0;
 while(true){const {done,value}=await reader.read();if(done)break;length+=value.length;if(length>limit){await reader.cancel();throw new MapillaryError("response-too-large")}parts.push(value)}
 const result=new Uint8Array(length);let i=0;for(const p of parts){result.set(p,i);i+=p.length}return result;
}
export function createMapillaryClient(token:string|undefined,request:typeof fetch=fetch){
 const requestCounts={graph:0,images:0};
 async function query(path:string,parameters:Record<string,string>){
  if(!token?.trim())throw new MapillaryError("not-configured");
  const url=new URL("https://graph.mapillary.com/"+path);url.search=new URLSearchParams(parameters).toString();
  let response:Response;try{requestCounts.graph++;response=await request(url,{headers:{Authorization:"OAuth "+token.trim()},signal:AbortSignal.timeout(15000),redirect:"error",cache:"no-store"})}catch{throw new MapillaryError("network")}
  if(!response.ok)throw new MapillaryError(response.status===401||response.status===403?"authorization":response.status===429?"rate-limit":"http-"+response.status);
  try{return obj(JSON.parse(new TextDecoder().decode(await bytes(response,2000000))))}catch(e){if(e instanceof MapillaryError)throw e;throw new MapillaryError("invalid-response")}
 }
 return {
  configured:!!token?.trim(),
  get requestCounts(){return {...requestCounts}},
  async target(target:Target){
   const delta=32/111000,lon=delta/Math.cos(target.point.lat*Math.PI/180),bbox=[target.point.lon-lon,target.point.lat-delta,target.point.lon+lon,target.point.lat+delta].join(","),found=new Map<string,Candidate>();let after="",partial=false;
   for(let page=0;page<2;page++){
    const data=await query("map_features",{bbox,fields:"id,geometry,object_value,first_seen_at,last_seen_at",limit:"100",...(after?{after}:{})});
    if(!Array.isArray(data.data))throw new MapillaryError("invalid-response");
    for(const raw of data.data.slice(0,200)){const f=obj(raw),key=id(f.id),classification=text(f.object_value),kind=mapillaryKind(classification),coordinates=obj(f.geometry).coordinates;
     if(!key||!kind||obj(f.geometry).type!=="Point"||!Array.isArray(coordinates))continue;
     const point={lon:Number(coordinates[0]),lat:Number(coordinates[1])};if(!validPoint(point)||distanceMeters(target.point,point)>32)continue;
     found.set(key,{id:"mapillary:"+key,provider:"mapillary",...kind,point,classification,sourceUrl:"https://www.mapillary.com/",lastSeen:typeof f.last_seen_at==="number"?f.last_seen_at:undefined,note:"Mapillaryの自動検出・推定位置。現地と進入方向からの見え方は未確認です。"});
    }
    const paging=obj(data.paging);partial=!!paging.next;after=text(obj(paging.cursors).after,1000);if(!partial||!after)break;
   }
   return {version:1 as const,key:target.key,point:{...target.point},fetchedAt:new Date().toISOString(),candidates:[...found.values()].sort((a,b)=>a.id.localeCompare(b.id,"en")),partial};
  },
  async photo(feature:Candidate,storage:LandmarkStorage):Promise<PhotoAsset>{
   const featureId=feature.id.replace("mapillary:","");if(!id(featureId)||feature.provider!=="mapillary")throw new MapillaryError("invalid-feature");
   const cached=storage.asset(featureId);if(cached)return cached;
   if(storage.photoFailure(featureId))throw new MapillaryError("no-usable-photo");
   const data=await query(featureId+"/detections",{fields:"id,geometry,value,image{id,thumb_1024_url,captured_at,creator,width,height}",limit:"10"});
   if(!Array.isArray(data.data))throw new MapillaryError("invalid-response");
   const options=data.data.slice(0,100).flatMap(raw=>{const d=obj(raw),image=obj(d.image);if(d.value!==feature.classification||!id(image.id)||typeof d.geometry!=="string")return [];try{const roi=detectionCrop(d.geometry),width=Number(image.width),height=Number(image.height),aspect=roi.width*width/(roi.height*height),scale=Math.min(1,1024/width,1024/height);if(!Number.isFinite(aspect)||aspect<.25||aspect>4||!Number.isFinite(scale)||width<=0||height<=0||roi.width/100*width*scale<20||roi.height/100*height*scale<12)return [];return [{image,roi}]}catch{return []}}).sort((a,b)=>b.roi.width*b.roi.height-a.roi.width*a.roi.height);
   let networkFailed=false;
   for(const {image,roi}of options.slice(0,3)){
    let url:URL;try{url=new URL(String(image.thumb_1024_url))}catch{continue}
    if(url.protocol!=="https:"||url.username||url.password||url.port||!url.hostname.endsWith(".fbcdn.net"))continue;
    let response:Response;try{requestCounts.images++;response=await request(url,{signal:AbortSignal.timeout(15000),redirect:"error",cache:"no-store"})}catch{networkFailed=true;continue}
    if(!response.ok){networkFailed=true;continue}const contentType=response.headers.get("content-type")?.split(";")[0]??"";if(!["image/jpeg","image/png","image/webp"].includes(contentType))continue;
    const body=await bytes(response,MAX_IMAGE_BYTES);if(body.length<16||contentType==="image/jpeg"&&(body[0]!==255||body[1]!==216)||contentType==="image/png"&&(body[0]!==137||body[1]!==80)||contentType==="image/webp"&&new TextDecoder().decode(body.slice(8,12))!=="WEBP")continue;
    const meta:PhotoAsset={version:1,policyVersion:2,featureId,imageId:id(image.id),creator:text(obj(image.creator).username,100)||"Mapillary contributor",capturedAt:typeof image.captured_at==="number"?image.captured_at:0,fetchedAt:new Date().toISOString(),roi,contentType};
    storage.saveAsset(meta,body);return meta;
   }
   if(networkFailed)throw new MapillaryError("network");
   storage.savePhotoFailure({version:1,policyVersion:2,featureId,fetchedAt:new Date().toISOString(),code:"no-usable-photo"});
   throw new MapillaryError("no-usable-photo");
  }
 };
}
