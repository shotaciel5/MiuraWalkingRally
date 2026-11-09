import {getBrowserSpots} from "../lib/spots/browser-catalog.ts";
import {mergeSpotEdits} from "../lib/spots/editing.ts";
import {prepareExpandedRoadConnections,expandedRoadSource} from "../lib/miura-road-connections.ts";
import {routeThroughStops} from "../lib/route/routing.ts";

const spots=mergeSpotEdits(getBrowserSpots(),[]),{graph,nodeIdsBySpot,splits,connections}=prepareExpandedRoadConnections(spots);
const byId=new Map(spots.map(s=>[s.id,s])),byConnection=new Map(connections.map(c=>[c.spotId,c]));
function reachableFrom(start){
 const seen=new Set([start]),queue=[start];
 for(let i=0;i<queue.length;i++)for(const edge of graph.adjacency.get(queue[i])??[])if(!seen.has(edge.to)){seen.add(edge.to);queue.push(edge.to)}
 return seen;
}
const reach=new Map(spots.map(s=>[s.id,reachableFrom(nodeIdsBySpot.get(s.id))]));
let reachablePairs=0;const unreachable=[];
for(const from of spots)for(const to of spots)if(from.id!==to.id){
 if(reach.get(from.id).has(nodeIdsBySpot.get(to.id)))reachablePairs++;else unreachable.push([from.id,to.id]);
}
const remaining=new Set(spots.map(s=>s.id)),components=[];
for(const s of spots)if(remaining.has(s.id)){
 const members=spots.filter(t=>remaining.has(t.id)&&reach.get(s.id).has(nodeIdsBySpot.get(t.id))&&reach.get(t.id).has(nodeIdsBySpot.get(s.id)));
 for(const t of members)remaining.delete(t.id);
 components.push(members.map(t=>({id:t.id,name:t.name})));
}
components.sort((a,b)=>b.length-a.length||(a[0].id<b[0].id?-1:1));
function example(label,ids){
 if(ids.some(id=>!byId.has(id)))throw Error("Report spot is missing");
 const visits=ids.map((id,i)=>({id:"visit-"+i,name:byId.get(id).name,nodeId:nodeIdsBySpot.get(id),note:"未確認の道路上候補。施設までの通路は未検証。"}));
 const candidates=ids.map(id=>({id,name:byId.get(id).name,facilityToRoadStraightMeters:byConnection.get(id).distanceMeters}));
 try{
  const route=routeThroughStops(graph,visits);
  return {label,status:"reachable-on-road-data",visits:candidates,roadMeters:route.meters,roadMinutes:route.minutes,speedKmh:route.speedKmh,
   bridgeWays:[...new Set(route.legs.flatMap(l=>l.edges.map(e=>e.wayId)))].filter(id=>graph.ways.get(id)?.tags?.bridge==="yes").map(id=>({id,highway:graph.ways.get(id).tags.highway,name:graph.ways.get(id).tags.name??""})),
   legs:route.legs.map(l=>({from:l.from.name,to:l.to.name,roadMeters:l.meters,edges:l.edges.length}))};
 }catch(error){
  if(!(error instanceof Error)||!/No walking path|Stop is missing/.test(error.message))throw error;
  return {label,status:"unreachable-on-road-data",visits:candidates,roadMeters:null,roadMinutes:null,reason:"道路の接続・歩行制限・取得範囲を要確認。地点の省略や直線経路への置換はしない。"};
 }
}
const shrine="osm-way-384676338",market="osm-node-2046962408",light="osm-node-1211621029";
const examples=[
 example("三崎の指定順・同じ開始終了",[shrine,"osm-way-394752558",market,shrine]),
 example("三崎から城ヶ島灯台",[market,light]),
 example("城ヶ島の灯台間",[light,"osm-node-12364319660"]),
 example("三崎から灘ヶ崎",[shrine,"osm-node-4202281807"]),
 ...(unreachable.length?[example("到達不能の例",unreachable[0])]:[])
];
console.log(JSON.stringify({
 state:"local-verification-unverified-candidates",source:{snapshotSha256:expandedRoadSource.roadSnapshotSha256,osmBaseTimestamp:expandedRoadSource.osmBaseTimestamp},
 note:"道路上の候補間だけの計算。施設から道路への直線距離は別記し、歩行距離に含めない。入口・敷地内通路・通行・安全性は未確認。実DB・保存済み下書きは読み書きしない。",
 candidateSpots:spots.length,virtualNodes:splits.size,walkingNodes:graph.adjacency.size,
 orderedPairs:spots.length*(spots.length-1),reachablePairs,unreachablePairs:unreachable.length,
 mutualReachabilityGroupSizes:components.map(c=>c.length),spotsOutsideLargestMutualGroup:components.slice(1).flat(),
 examples
},null,2));
