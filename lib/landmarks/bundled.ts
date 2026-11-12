import manifest from "../../public/landmarks/miura-v1/manifest.json" with {type:"json"};
import {distanceMeters} from "../route/graph.ts";
import type {Point} from "../route/types.ts";
import type {TargetCache,PhotoAsset,Candidate} from "./model.ts";
import type {RegionBundle} from "./region-format.ts";
export type LandmarkBundle={version:1;id:string;targets:TargetCache[];photos:{asset:PhotoAsset;path:string;sha256:string;bytes:number}[]};
const region=manifest as unknown as RegionBundle,features=new Map(region.features.map(c=>[c.id,c]));
const cells=new Map<string,Candidate[]>(),cell=(p:Point)=>[Math.floor(p.lat/.0002),Math.floor(p.lon/.0002)];
for(const feature of region.features){const key=cell(feature.point).join(",");cells.set(key,[...(cells.get(key)??[]),feature])}
const bundle:LandmarkBundle={version:1,id:region.id,photos:region.photos,targets:region.junctions.map(t=>({version:1,key:t.key,point:t.point,fetchedAt:t.fetchedAt??region.preparedAt,partial:t.status!=="ready",candidates:t.candidateIds.flatMap(id=>{const c=features.get(id);return c?[c]:[]})}))};
export function getBundledLandmarks(){return bundle}
export const bundledRegionInfo={id:region.id,manifestPath:"/landmarks/miura-v1/manifest.json",noticePath:"/landmarks/miura-v1/NOTICE.md",stats:region.stats,preparedAt:region.preparedAt};
export function bundledTarget(key:string,point?:Point):TargetCache|null{
 const exact=bundle.targets.find(t=>t.key===key);if(!point)return exact?structuredClone(exact):null;
 const b=region.bounds;if(!Number.isFinite(point.lat)||!Number.isFinite(point.lon)||point.lat<b.south||point.lat>b.north||point.lon<b.west||point.lon>b.east)return null;
 const [lat,lon]=cell(point),found=new Map<string,Candidate>();
 for(let i=-3;i<=3;i++)for(let j=-3;j<=3;j++)for(const c of cells.get([lat+i,lon+j].join(","))??[])if(distanceMeters(point,c.point)<=32)found.set(c.id,c);
 const covering=region.junctions.find(t=>t.status==="ready"&&distanceMeters(point,t.point)<=2);
 return {version:1,key,point:{...point},fetchedAt:exact?.fetchedAt??region.preparedAt,partial:exact?exact.partial:!covering,candidates:structuredClone([...found.values()].sort((a,b)=>a.id.localeCompare(b.id,"en")))};
}
