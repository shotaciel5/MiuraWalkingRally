import test from "node:test";
import assert from "node:assert/strict";
import {buildShortKomaComparison,adaptiveExtent,scaleContext} from "../scripts/short-koma-comparison.mjs";
import {renderShortKomaComparison} from "../scripts/render-short-koma-comparison.mjs";
const result=buildShortKomaComparison(),{report,examples}=result;
const length=ps=>ps.slice(1).reduce((sum,p,i)=>sum+Math.hypot(p.x-ps[i].x,p.y-ps[i].y),0);
test("comparison accounts for all 45 held occurrences without declaring either method adopted",()=>{
 assert.equal(report.state,"proposal-not-adopted");assert.equal(examples.length,45);assert.equal(report.summary.aLengthPass,45);
 assert.deepEqual([...new Set(report.rows.map(r=>r.caseId))],["misaki-loop","bridge-out","bridge-back","east-park"]);
 assert.ok(report.summary.maxZoom>9.9&&report.summary.maxZoom<10.1);
 for(const e of examples){assert.equal(e.original.state,"held");assert.deepEqual(e.original.branches,[]);assert.equal(e.reference.state,"held");assert.equal(e.zoom.state,"ready");assert.ok(e.zoom.branches.filter(b=>b.arrival||b.departure).every(b=>length(b.points)>=35.99))}
 for(const bad of [0,-1,NaN,Infinity])assert.throws(()=>adaptiveExtent(bad),/Invalid shortest/);
});
test("adaptive diagrams preserve every branch, role, access state, direction and original geometry prefix",()=>{
 for(const e of examples){
  const a=e.zoom,b=e.reference,f=e.row.a.zoomFactor;
  assert.equal(a.headingDegrees,b.headingDegrees);assert.equal(a.nodeId,b.nodeId);assert.equal(a.pathIndex,b.pathIndex);
  assert.deepEqual(a.branches.map(b=>[b.neighborNodeId,b.arrival,b.departure,b.entry,b.exit]),b.branches.map(b=>[b.neighborNodeId,b.arrival,b.departure,b.entry,b.exit]));
  for(const arm of a.branches){
   const old=b.branches.find(b=>b.neighborNodeId===arm.neighborNodeId);
   for(const [j,s]of arm.sourceSegments.entries()){
    const before=old.sourceSegments[j];assert.equal(s.from,before.from);assert.equal(s.to,before.to);assert.deepEqual(s.wayIds,before.wayIds);
    assert.ok(s.fraction>0&&s.fraction<=before.fraction+1e-12);
    if(j<arm.sourceSegments.length-1)assert.equal(s.fraction,before.fraction);
    const ratio=s.fraction/before.fraction,p=old.points[j],q=old.points[j+1],x=p.x+(q.x-p.x)*ratio,y=p.y+(q.y-p.y)*ratio;
    assert.ok(Math.abs(arm.points[j+1].x-(150+(x-150)*f))<.005);
    assert.ok(Math.abs(arm.points[j+1].y-(140+(y-140)*f))<.005);
   }
  }
 }
});
test("external label anchors stay on their real selected branches and expose the nearby-branch tradeoff",()=>{
 assert.equal(report.summary.aNearOtherBranch,0);assert.equal(report.summary.bNearOtherBranch,16);
 for(const e of examples)for(const anchor of e.bAnchors){
  const branch=e.reference.branches.find(b=>b.neighborNodeId===anchor.neighborNodeId);
  assert.ok(anchor.role==="arrival"?branch.arrival:branch.departure);
  const on=branch.points.slice(1).some((q,i)=>{const p=branch.points[i],dx=q.x-p.x,dy=q.y-p.y,t=((anchor.point.x-p.x)*dx+(anchor.point.y-p.y)*dy)/(dx*dx+dy*dy);return t>=-1e-9&&t<=1+1e-9&&Math.hypot(p.x+dx*t-anchor.point.x,p.y+dy*t-anchor.point.y)<1e-6});
  assert.ok(on);
 }
});
test("context layers share the road zoom while original 30m reference data stays intact",()=>{
 assert.equal(report.summary.aWithoutVisibleLandmarks,19);assert.equal(report.summary.bWithoutVisibleLandmarks,8);
 let buildings=0,landmarks=0,steps=0;
 for(const e of examples){
  const before=structuredClone(e.context),scaled=scaleContext(e.context,e.row.a.zoomFactor);
  assert.deepEqual(e.context,before);assert.deepEqual(scaled,e.zoomContext);
  for(const [i,b]of e.context.buildings.entries())for(const [j,p]of b.points.entries()){
   const actual=e.zoomContext.buildings[i].points[j];assert.ok(Math.abs((actual.x-150)/e.row.a.zoomFactor-(p.x-150))<1e-8);buildings++;
  }
  for(const [i,p]of e.context.landmarks.entries()){
   const actual=e.zoomContext.landmarks[i];assert.equal(actual.id,p.id);assert.equal(actual.meters,p.meters);
   assert.ok(Math.abs((actual.y-140)/e.row.a.zoomFactor-(p.y-140))<1e-8);landmarks++;
  }
  steps+=e.context.steps.length;
 }
 assert.ok(buildings>0&&landmarks>0&&steps>0);
});
test("comparison preserves source warnings, next-koma distance and start/finish semantics",()=>{
 const flagged=examples.filter(e=>e.row.sourceIssues.length);assert.equal(flagged.length,2);
 for(const e of flagged){assert.ok(e.row.sourceIssues.includes("branch-access-or-extract-unresolved"));assert.ok(e.zoom.issues.includes("Source access or extract needs review"))}
 const start=examples.find(e=>e.row.caseId==="misaki-loop"&&e.row.sequence===1),finish=examples.find(e=>e.row.caseId==="misaki-loop"&&e.row.sequence===39);
 assert.equal(start.zoom.kind,"start");assert.equal(start.zoom.branches.some(b=>b.arrival),false);
 assert.equal(finish.zoom.kind,"finish");assert.equal(finish.zoom.branches.some(b=>b.departure),false);
 for(const e of examples){assert.equal(e.zoom.metersToNext,e.original.metersToNext);assert.equal(e.reference.metersToNext,e.original.metersToNext)}
});
test("comparison HTML keeps source text escaped and performs no script or external asset requests",()=>{
 const poisoned=structuredClone(result);poisoned.examples[0].row.caseLabel='<script src="https://invalid.test/x">bad</script>';
 poisoned.examples[0].context.landmarks.push({id:"node/1",name:'<img src="https://invalid.test/x">',symbol:"shop",x:80,y:80});
 const html=renderShortKomaComparison(poisoned);assert.match(html,/&lt;script/);assert.match(html,/&lt;img/);
 assert.doesNotMatch(html,/<script\b|<img\b|<iframe\b|<link\b|url\(https?:/i);
 assert.match(html,/Content-Security-Policy/);assert.match(html,/アプリには未適用/);
 assert.equal((html.match(/data-example=/g)??[]).length,45);assert.equal((html.match(/data-callout=/g)??[]).length,87);
});
