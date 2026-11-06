import { distanceMeters } from "./graph.ts";
import { KOMA_VIEW, projectKomaPoint } from "./koma.ts";
import type { KomaMap, DiagramPoint } from "./koma.ts";
import type { Graph, Point, Snapshot, Tags } from "./types.ts";

export type Landmark = {
  id: string; point: Point; name: string; kind: string; symbol: string;
  anchor: "node" | "area-label";
};
export type ContextData = {
  buildings: {id:string; points:Point[]}[];
  landmarks: Landmark[];
};
export type KomaContext = {
  buildings: {id:string; points:{x:number;y:number}[]}[];
  landmarks: (Landmark & {x:number;y:number;meters:number})[];
  roads: {id:number;name:string;highway:string}[];
  steps: {from:DiagramPoint;to:DiagramPoint;wayIds:number[]}[];
  availableLandmarks:number; availableBuildings:number;
};

const nameOf = (tags:Tags) => tags["name:ja"] || tags.name || "";
function category(tags:Tags): {kind:string;symbol:string}|null {
  if(tags.highway==="traffic_signals")return {kind:"信号",symbol:"信"};
  if(tags.highway==="crossing")return {kind:"横断箇所",symbol:"横"};
  if(tags.highway==="bus_stop")return {kind:"バス停",symbol:"バ"};
  if(tags.amenity==="place_of_worship")return tags.religion==="shinto"?{kind:"神社",symbol:"神"}:tags.religion==="buddhist"?{kind:"寺院",symbol:"寺"}:{kind:"宗教施設",symbol:"宗"};
  if(tags.amenity==="toilets")return {kind:"トイレ",symbol:"WC"};
  if(tags.amenity==="drinking_water")return {kind:"飲用水",symbol:"水"};
  if(tags.amenity==="parking")return {kind:"駐車場",symbol:"P"};
  if(!nameOf(tags))return null;
  if(tags.shop)return {kind:"店舗",symbol:"店"};
  if(["restaurant","cafe","fast_food","bar","pub"].includes(tags.amenity))return {kind:"飲食店",symbol:"食"};
  if(tags.historic)return {kind:"史跡",symbol:"史"};
  if(tags.tourism)return {kind:"観光施設",symbol:"観"};
  if(tags.amenity)return {kind:"施設",symbol:"施"};
  return null;
}

// A point inside a simple closed polygon, used for a label only; never an entrance.
// Scan between vertex latitudes so a horizontal ray does not pass through a vertex.
export function polygonLabelPoint(points:Point[]): Point|null {
  if(points.length<4)return null;
  const latitudes=[...new Set(points.map(p=>p.lat))].sort((a,b)=>a-b);
  let best:{point:Point;width:number}|null=null;
  for(let row=1;row<latitudes.length;row++){
    const lat=(latitudes[row-1]+latitudes[row])/2;
    const intersections:number[]=[];
    for(let i=1;i<points.length;i++){
      const a=points[i-1],b=points[i];
      if((a.lat>lat)!==(b.lat>lat))intersections.push(a.lon+(b.lon-a.lon)*(lat-a.lat)/(b.lat-a.lat));
    }
    intersections.sort((a,b)=>a-b);
    for(let i=1;i<intersections.length;i+=2){
      const width=intersections[i]-intersections[i-1];
      if(width>0&&(!best||width>best.width))best={width,point:{lat,lon:(intersections[i]+intersections[i-1])/2}};
    }
  }
  return best?.point??null;
}

export function extractContext(snapshot:Snapshot, graph:Graph):ContextData {
  const nodes=new Map(snapshot.elements.filter(e=>e.type==="node").map(e=>[e.id,e]));
  const buildings:ContextData["buildings"]=[];
  const landmarks=new Map<string,Landmark>();
  for(const item of snapshot.elements){
    const tags=item.tags??{}, id=item.type+"/"+item.id;
    let point:Point|null=null, anchor:Landmark["anchor"]="node";
    if(item.type==="node")point={lat:item.lat,lon:item.lon};
    if(item.type==="way"){
      if(item.nodes.some(id=>!nodes.has(id)))throw new Error("Missing context coordinates: "+id);
      if(item.nodes.length<4||item.nodes[0]!==item.nodes.at(-1))continue;
      const points=item.nodes.map(id=>{const n=nodes.get(id)!;return {lat:n.lat,lon:n.lon}});
      if(tags.building&&tags.building!=="no")buildings.push({id,points});
      point=polygonLabelPoint(points);anchor="area-label";
    }
    const kind=category(tags);
    if(point&&kind)landmarks.set(id,{id,point,name:nameOf(tags)||kind.kind,...kind,anchor});
  }
  // Road-node signals/crossings also remain available in synthetic or smaller extracts.
  for(const node of graph.nodes.values()){
    const kind=category(node.tags??{}),id="node/"+node.id;
    if(kind&&!landmarks.has(id))landmarks.set(id,{id,point:{lat:node.lat,lon:node.lon},name:nameOf(node.tags??{})||kind.kind,...kind,anchor:"node"});
  }
  return {buildings:buildings.sort((a,b)=>a.id.localeCompare(b.id,"en")),landmarks:[...landmarks.values()].sort((a,b)=>a.id.localeCompare(b.id,"en"))};
}

function segmentDistance(a:{x:number;y:number},b:{x:number;y:number}){
  const dx=b.x-a.x,dy=b.y-a.y,length=dx*dx+dy*dy;
  const t=length===0?0:Math.max(0,Math.min(1,-(a.x*dx+a.y*dy)/length));
  return Math.hypot(a.x+dx*t,a.y+dy*t);
}
export function createKomaContext(graph:Graph,map:KomaMap,data:ContextData):KomaContext {
  const empty={buildings:[],landmarks:[],roads:[],steps:[],availableLandmarks:0,availableBuildings:0};
  if(map.state!=="ready"||map.headingDegrees===null)return empty;
  const center=graph.nodes.get(map.nodeId);
  if(!center)throw new Error("Missing context center");
  const scale=KOMA_VIEW.radius/30;
  const project=(point:Point)=>{const p=projectKomaPoint(center,point,map.headingDegrees!);return {x:KOMA_VIEW.centerX+p.x*scale,y:KOMA_VIEW.centerY+p.y*scale}};
  const nearby=data.landmarks.map(feature=>({...feature,meters:distanceMeters(center,feature.point)}))
    .filter(f=>f.meters<=30).sort((a,b)=>a.meters-b.meters||a.id.localeCompare(b.id,"en"));
  const buildings=data.buildings.map(building=>{
    const relative=building.points.map(p=>projectKomaPoint(center,p,map.headingDegrees!));
    const distance=Math.min(...relative.slice(1).map((p,i)=>segmentDistance(relative[i],p)));
    // Include a polygon containing the center, even if its boundary is beyond 35m.
    let inside=false;
    for(let i=1;i<relative.length;i++){const a=relative[i-1],b=relative[i];if((a.y>0)!==(b.y>0)&&0<(b.x-a.x)*(-a.y)/(b.y-a.y)+a.x)inside=!inside}
    return {...building,distance,inside};
  }).filter(b=>b.inside||b.distance<=35).sort((a,b)=>a.distance-b.distance||a.id.localeCompare(b.id,"en"));
  const roadIds=[...new Set(map.branches.flatMap(b=>b.sourceSegments.flatMap(s=>s.wayIds)))].sort((a,b)=>a-b);
  const roads=roadIds.map(id=>({id,name:nameOf(graph.ways.get(id)?.tags??{})||graph.ways.get(id)?.tags?.ref||"",highway:graph.ways.get(id)?.tags?.highway??""}));
  const steps=map.branches.flatMap(branch=>branch.sourceSegments.flatMap((segment,i)=>{
    const wayIds=segment.wayIds.filter(id=>graph.ways.get(id)?.tags?.highway==="steps");
    return wayIds.length?[{from:branch.points[i],to:branch.points[i+1],wayIds}]:[];
  }));
  return {
    buildings:buildings.slice(0,12).map(b=>({id:b.id,points:b.points.map(project)})),
    landmarks:nearby.slice(0,4).map(f=>({...f,...project(f.point)})),roads,steps,
    availableLandmarks:nearby.length,availableBuildings:buildings.length,
  };
}

export function placeLandmarkBadges(points:{x:number;y:number}[],width:number,height:number,roads:{x:number;y:number}[][]=[]){
  const placed:{x:number;y:number}[]=[];
  const offsets=[[16,-18],[-16,-18],[16,18],[-16,18],[32,0],[-32,0],[0,-32],[0,32]];
  for(const point of points){
    const candidates=offsets.map(([dx,dy])=>({x:Math.max(18,Math.min(width-18,point.x+dx)),y:Math.max(18,Math.min(height-35,point.y+dy))}));
    const cost=(p:{x:number;y:number})=>placed.reduce((sum,q)=>sum+Math.max(0,20-Math.hypot(p.x-q.x,p.y-q.y))**2*10,0)+
      roads.reduce((sum,line)=>sum+line.slice(1).reduce((s,b,i)=>s+Math.max(0,12-segmentDistance({x:line[i].x-p.x,y:line[i].y-p.y},{x:b.x-p.x,y:b.y-p.y}))**2,0),0);
    // Stable ties keep the first candidate. Only labels move; source points stay fixed.
    placed.push(candidates.reduce((best,p)=>cost(p)<cost(best)?p:best));
  }
  return placed;
}
