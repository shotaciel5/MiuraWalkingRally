import test from "node:test";
import assert from "node:assert/strict";
import {overviewStops,nextStopIndex} from "../lib/operator/overview-markers.ts";
import {demoCourses} from "../lib/demo/seed.ts";
import {createRallyPreview} from "../lib/operator/rally-preview.ts";
import {mergeSpotEdits} from "../lib/spots/editing.ts";
import {getBrowserSpots} from "../lib/spots/browser-catalog.ts";
import {projectOmittedPreview} from "../lib/route/omission/projection.ts";
import {selectOmission} from "../lib/route/omission/selection.ts";

test("round-trip overview keeps start and goal as one selectable road point",()=>{
 const p=demoCourses()[0].payload.preview,g=overviewStops(p.visits);
 const combined=g.find(s=>s.visits.some(v=>v.id==="start"));
 assert.ok(combined.visits.some(v=>v.id==="finish"));assert.equal(combined.badge,"S/G");
 assert.equal(nextStopIndex(combined,-1),0);assert.equal(nextStopIndex(combined,0),p.visits.at(-1).komaIndex);
 assert.equal(nextStopIndex(combined,p.cards.length-1),0);
 assert.equal(g.flatMap(s=>s.visits).length,p.visits.length);
});
test("all visits, repeated road arrivals and names survive without merging nearby distinct road points",()=>{
 const base=demoCourses()[0].payload.preview.visits[0],point={lat:35.14,lon:139.62};
 const visits=[{...base,id:"start",label:"開始",point,komaIndex:0},
  {...base,id:"stop-0",label:"経由地 1",name:"経由先",point:{lat:35.14000001,lon:139.62},komaIndex:2},
  {...base,id:"stop-1",label:"チェックポイント 2",name:"写真地点",point,komaIndex:4},
  {...base,id:"finish",label:"終了",point,komaIndex:8}];
 const groups=overviewStops(visits);assert.equal(groups.length,2);
 assert.equal(groups[0].badge,"S/CP2/G");assert.ok(groups[0].name.includes("写真地点"));assert.equal(groups[1].badge,"経1");
 assert.deepEqual(groups[0].visits.map(v=>v.kind),["start","checkpoint","finish"]);
 assert.deepEqual([nextStopIndex(groups[0],0),nextStopIndex(groups[0],4),nextStopIndex(groups[0],8)],[4,8,0]);
});
test("important overview labels follow retained card indices in all and omitted projections",()=>{
 for(const saved of demoCourses()){
  const p=createRallyPreview(saved.payload.input.draft,mergeSpotEdits(getBrowserSpots(),[]),saved.payload.input.corrections,{omission:true});assert.equal(p.state,"ready");
  for(const mode of ["all","hybrid"]){
   const selected=selectOmission(p.omissionPlan,mode,[]).selected,view=projectOmittedPreview(p,selected);
   for(const group of overviewStops(view.visits))for(const visit of group.visits){
    assert.ok(view.cards[visit.komaIndex].map.stopIds.includes(visit.id));
    assert.deepEqual(group.point,visit.point);
   }
   assert.deepEqual(p.path,view.path);assert.equal(p.meters,view.meters);
  }
 }
});
