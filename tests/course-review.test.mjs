import test from "node:test";
import assert from "node:assert/strict";
import {summarizeCourseReview} from "../lib/operator/course-review.ts";
import {parseCoursePayload,canonicalJson} from "../lib/operator/course-format.ts";
import {prepareCourseSave} from "../lib/operator/course-save.ts";
import {createRallyPreview} from "../lib/operator/rally-preview.ts";
import {getBrowserSpots} from "../lib/spots/browser-catalog.ts";
import {mergeSpotEdits} from "../lib/spots/editing.ts";
import {AUDIT_CASES} from "../scripts/expanded-route-audit.mjs";
const card=(sequence,{state="ready",short=false,branches=[],issues=[],mapIssues=[]}={})=>({map:{sequence,state,...(short?{shortGeometry:{branches:[]}}:{}),issues:mapIssues},candidate:{branches,issues}});
const source=(cards,ids=["a","b","a"])=>({visits:ids.map(spotId=>({spotId})),cards});
const branch=(entry,exit=entry)=>({entry,exit});
test("counts unique facilities separately from repeated visits and retains every koma occurrence",()=>{
 const r=summarizeCourseReview(source([card(1,{state:"held"}),card(2,{state:"held"})]));
 assert.equal(r.spots,2);assert.equal(r.visits,3);assert.equal(r.total,2);assert.deepEqual(r.items.map(x=>[x.index,x.sequence]),[[0,1],[1,2]]);
});
test("keeps true held diagrams separate from retained short geometry",()=>{
 const r=summarizeCourseReview(source([card(1,{state:"held"}),card(2,{state:"held",short:true})]));
 assert.equal(r.held,1);assert.equal(r.short,1);assert.deepEqual(r.items.map(x=>x.reasons),[["held"],["short"]]);
});
test("finds both entry and exit restrictions even on drawable diagrams",()=>{
 const r=summarizeCourseReview(source([card(1,{branches:[branch("candidate","review")]}),card(2,{branches:[branch("excluded","candidate")]}),card(3,{branches:[branch("candidate")]})]));
 assert.equal(r.branches,2);assert.deepEqual(r.items.map(x=>x.reasons),[["review-branch"],["excluded-branch"]]);assert.equal(r.held,0);
});
test("combines overlapping concerns into a single row per koma in passage order",()=>{
 const r=summarizeCourseReview(source([card(1,{state:"held",short:true,branches:[branch("review","excluded")],issues:["unknown"]}),card(2,{branches:[branch("review"),branch("review")]})]));
 assert.equal(r.items.length,2);assert.equal(r.branches,2);assert.deepEqual(r.items[0].reasons,["short","review-branch","excluded-branch","source"]);assert.equal(r.items[1].index,1);
});
test("retains source and drawing issues that do not fit a known geometry category",()=>{
 const r=summarizeCourseReview(source([card(1,{issues:["new source warning"]}),card(2,{mapIssues:["drawing warning"]}),card(3,{state:"held",mapIssues:["unknown heading"]})]));
 assert.deepEqual(r.items.map(x=>x.reasons),[["source"],["source"],["held"]]);
});
test("an empty automatic list does not certify a course or change the input",()=>{
 const input=source([card(1)],["a","a"]),before=structuredClone(input);const r=summarizeCourseReview(input);
 assert.deepEqual(r.items,[]);assert.equal(r.visits,2);assert.equal(r.spots,1);assert.equal("approved" in r,false);assert.equal("safe" in r,false);assert.deepEqual(input,before);
});
test("saved representative payloads reproduce known warnings without a live lookup or mutation",()=>{
 const spots=mergeSpotEdits(getBrowserSpots(),[]),byId=new Map(spots.map(s=>[s.id,s]));
 const expected={"misaki-loop":{short:12,review:[]},"bridge-out":{short:16,review:[66]},"bridge-back":{short:16,review:[4]},"east-park":{short:1,review:[]},"coast":{short:0,review:[2]}};
 let total=0,short=0;
 for(const spec of AUDIT_CASES.filter(s=>expected[s.id])){
  const chosen=spec.ids.map(id=>byId.get(id)),draft={title:spec.label,start:chosen[0],finish:chosen.at(-1),stops:chosen.slice(1,-1).map(spot=>({kind:"waypoint",spot})),revision:1,updatedAt:"2026-11-09T00:00:00.000Z"},context={draft,spots,corrections:{revision:0,updatedAt:null,items:[]}},p=prepareCourseSave(context,createRallyPreview(draft,spots,context.corrections)).payload;
  const saved=parseCoursePayload(JSON.parse(canonicalJson(p))),before=canonicalJson(saved),r=summarizeCourseReview(saved.preview);
  assert.equal(r.short,expected[spec.id].short);assert.equal(r.held,0);assert.deepEqual(r.items.filter(x=>x.reasons.includes("review-branch")).map(x=>x.sequence),expected[spec.id].review);
  assert.deepEqual(r.items.map(x=>x.index),[...new Set(r.items.map(x=>x.index))].sort((a,b)=>a-b));assert.equal(canonicalJson(saved),before);
  // Arbitrary old source metadata and labels do not influence these stored geometry observations.
  saved.preview.source.osmBaseTimestamp="2020-01-01T00:00:00Z";saved.preview.title="old name";assert.deepEqual(summarizeCourseReview(saved.preview),r);
  total+=r.total;short+=r.short;
 }
 assert.equal(total,186);assert.equal(short,45);
});
