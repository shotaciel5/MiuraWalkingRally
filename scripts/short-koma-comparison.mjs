// Presentation comparison only: no application, route, walking-policy or database changes.
import assert from "node:assert/strict";
import {readFileSync,writeFileSync,mkdirSync} from "node:fs";
import {fileURLToPath} from "node:url";
import {resolve} from "node:path";
import {AUDIT_CASES,traceBranch} from "./expanded-route-audit.mjs";
import {getBrowserSpots} from "../lib/spots/browser-catalog.ts";
import {mergeSpotEdits} from "../lib/spots/editing.ts";
import {prepareExpandedRoadConnections,expandedRoadSource as source} from "../lib/miura-road-connections.ts";
import {routeThroughStops} from "../lib/route/routing.ts";
import {extractJunctions,buildRoadBranches} from "../lib/route/junctions.ts";
import {createKomaMaps,projectKomaPoint,KOMA_VIEW,arrowPath} from "../lib/route/koma.ts";
import {expandedKomaContext} from "../lib/expanded-context.ts";
import {renderShortKomaComparison} from "./render-short-koma-comparison.mjs";

const SHORT_ISSUE="Selected arms too short to distinguish symbols",TARGET_PIXELS=36;
const CENTER={x:KOMA_VIEW.centerX,y:KOMA_VIEW.centerY};
const SELECTOR_GAP=12; // Comparison indicator only, not an adoption, safety or geographic accuracy threshold.
export function adaptiveExtent(shortestMeters){
 assert.ok(Number.isFinite(shortestMeters)&&shortestMeters>0,"Invalid shortest selected arm");
 return Math.min(30,shortestMeters*KOMA_VIEW.radius/TARGET_PIXELS);
}
const length=points=>points.slice(1).reduce((sum,p,i)=>sum+Math.hypot(p.x-points[i].x,p.y-points[i].y),0);
const affine=(p,factor)=>({...p,x:CENTER.x+(p.x-CENTER.x)*factor,y:CENTER.y+(p.y-CENTER.y)*factor});
export function scaleContext(context,factor){
 return {...context,buildings:context.buildings.map(b=>({...b,points:b.points.map(p=>affine(p,factor))})),
  landmarks:context.landmarks.map(f=>affine(f,factor)),steps:context.steps.map(s=>({...s,from:affine(s.from,factor),to:affine(s.to,factor)}))};
}
function selectorAnchors(map){
 return [
  ...map.branches.filter(b=>b.arrival).map(b=>({role:"arrival",neighborNodeId:b.neighborNodeId,point:b.points.at(-1)})),
  ...map.branches.filter(b=>b.departure).map(b=>({role:"departure",neighborNodeId:b.neighborNodeId,point:arrowPath(b.points).at(-1)}))
 ];
}
function distanceToLine(p,a,b){
 const x=b.x-a.x,y=b.y-a.y,t=Math.max(0,Math.min(1,((p.x-a.x)*x+(p.y-a.y)*y)/(x*x+y*y||1)));
 return Math.hypot(p.x-a.x-x*t,p.y-a.y-y*t);
}
function clearance(map){
 return selectorAnchors(map).map(a=>{
  const other=map.branches.filter(b=>b.neighborNodeId!==a.neighborNodeId);
  const distances=other.flatMap(b=>b.points.slice(1).map((p,i)=>distanceToLine(a.point,b.points[i],p)));
  return {role:a.role,neighborNodeId:a.neighborNodeId,nearestOtherBranchPixels:distances.length?Math.min(...distances):null};
 });
}
const near=c=>c.some(a=>a.nearestOtherBranchPixels!==null&&a.nearestOtherBranchPixels<SELECTOR_GAP);
const visible=features=>features.filter(p=>p.x>=9&&p.x<=291&&p.y>=9&&p.y<=241).length;
export function buildShortKomaComparison(){
 const pinned=JSON.parse(readFileSync(new URL("../docs/reports/expanded-route-audit.json",import.meta.url),"utf8"));
 assert.equal(pinned.source.roadSha256,source.roadSnapshotSha256,"Audit source changed");
 const spots=mergeSpotEdits(getBrowserSpots(),[]),byId=new Map(spots.map(s=>[s.id,s])),rows=[],examples=[];
 for(const spec of AUDIT_CASES){
  const expected=pinned.cases.find(c=>c.id===spec.id);
  if(expected.state!=="ready")continue;
  const selected=spec.ids.map(id=>byId.get(id)),prepared=prepareExpandedRoadConnections(selected),{graph}=prepared;
  const route=routeThroughStops(graph,selected.map((s,i)=>({id:"visit-"+i,name:s.name,nodeId:prepared.nodeIdsBySpot.get(s.id),note:"comparison only"})));
  const analysis=extractJunctions(graph,route),maps=createKomaMaps(graph,analysis),topology=buildRoadBranches(graph);
  assert.equal(maps.length,expected.cards);assert.deepEqual(maps.filter(m=>m.state==="held").map(m=>m.sequence),expected.held.map(m=>m.sequence));
  for(const [index,original]of maps.entries()){
   if(original.state!=="held")continue;
   assert.deepEqual(original.issues,[SHORT_ISSUE],"Only known short-arm diagrams may enter this comparison");
   const candidate=analysis.candidates[index],center=graph.nodes.get(candidate.nodeId);
   const traced=candidate.branches.map(b=>({...b,...traceBranch(graph,topology,candidate.nodeId,b.neighborNodeId)}));
   const reference={...original,branches:traced.map(b=>({...b,sourceSegments:b.segments,points:b.points.map(p=>{
    const q=projectKomaPoint(center,p,original.headingDegrees);return {...p,x:CENTER.x+q.x*KOMA_VIEW.radius/30,y:CENTER.y+q.y*KOMA_VIEW.radius/30};
   })}))};
   // Reference geometry remains flagged held; it is not adopted as a production KomaMap.
   const shortest=Math.min(...traced.filter(b=>b.arrival||b.departure).map(b=>b.meters)),extent=adaptiveExtent(shortest);
   const zoom=createKomaMaps(graph,{...analysis,candidates:[candidate]},extent)[0];
   assert.equal(zoom.state,"ready","Adaptive prototype still held");
   assert.deepEqual(zoom.branches.map(b=>b.neighborNodeId),reference.branches.map(b=>b.neighborNodeId));
   assert.deepEqual(zoom.branches.map(b=>[b.arrival,b.departure,b.entry,b.exit]),reference.branches.map(b=>[b.arrival,b.departure,b.entry,b.exit]));
   // Existing context API is fixed to 30m; this comparison applies the same affine transform to every layer.
   const context=expandedKomaContext(graph,{...reference,state:"ready"}),factor=30/extent,zoomContext=scaleContext(context,factor);
   const aClear=clearance(zoom),bClear=clearance(reference);
   const row={caseId:spec.id,caseLabel:spec.label,sequence:original.sequence,nodeId:original.nodeId,kind:original.kind,point:{lat:center.lat,lon:center.lon},branches:reference.branches.length,
    shortestSelectedMeters:shortest,sourceBranchIds:reference.branches.map(b=>b.neighborNodeId),sourceIssues:candidate.issues,metersToNext:original.metersToNext,
    a:{extentMeters:extent,zoomFactor:factor,minimumSelectedPixels:Math.min(...zoom.branches.filter(b=>b.arrival||b.departure).map(b=>length(b.points))),clearance:aClear,nearOtherBranch:near(aClear),visibleLandmarks:visible(zoomContext.landmarks)},
    b:{extentMeters:30,clearance:bClear,nearOtherBranch:near(bClear),visibleLandmarks:visible(context.landmarks)}};
   rows.push(row);examples.push({row,original,reference,zoom,context,zoomContext,bAnchors:selectorAnchors(reference)});
  }
 }
 assert.equal(rows.length,pinned.cases.reduce((sum,c)=>sum+(c.held?.length??0),0));
 return {report:{schemaVersion:1,state:"proposal-not-adopted",source:pinned.source,totalHeld:rows.length,
  policy:{targetSelectedPixels:TARGET_PIXELS,otherBranchInspectionPixels:SELECTOR_GAP,scope:"Comparison only. A ready model means length-check passed, not readability or access approval."},
  summary:{aLengthPass:rows.filter(r=>r.a.minimumSelectedPixels>=30).length,aNearOtherBranch:rows.filter(r=>r.a.nearOtherBranch).length,bNearOtherBranch:rows.filter(r=>r.b.nearOtherBranch).length,
   aWithoutVisibleLandmarks:rows.filter(r=>r.a.visibleLandmarks===0).length,bWithoutVisibleLandmarks:rows.filter(r=>r.b.visibleLandmarks===0).length,
   maxZoom:Math.max(...rows.map(r=>r.a.zoomFactor)),minExtentMeters:Math.min(...rows.map(r=>r.a.extentMeters)),maxExtentMeters:Math.max(...rows.map(r=>r.a.extentMeters))},
  rows,limitations:["No application, walking rule, source data, participant course or stored correction changed.","Neither method is approved. Text readability, marker collisions and thumbnails still need review.","Nearby branch indication is a comparison aid, not a public-safety acceptance criterion."]},examples};
}
export function shortKomaArtifacts(){
 const result=buildShortKomaComparison();return {json:JSON.stringify(result.report,null,2)+"\n",html:renderShortKomaComparison(result)};
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const args=process.argv.slice(2);if(args.length>1||args.some(a=>!["--write","--check"].includes(a)))throw Error("Use no option, --write or --check");
 const {json,html}=shortKomaArtifacts(),dir=new URL("../docs/reports/",import.meta.url);
 if(args[0]==="--write"){mkdirSync(dir,{recursive:true});writeFileSync(new URL("short-koma-comparison.json",dir),json);writeFileSync(new URL("short-koma-comparison.html",dir),html)}
 else if(args[0]==="--check"){
  assert.equal(readFileSync(new URL("short-koma-comparison.json",dir),"utf8"),json,"Comparison JSON drift");
  assert.equal(readFileSync(new URL("short-koma-comparison.html",dir),"utf8"),html,"Comparison HTML drift");
 }
 console.log(args.length?JSON.stringify({result:"passed",mode:args[0],summary:JSON.parse(json).summary}):json);
}
