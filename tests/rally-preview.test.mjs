import test from "node:test";
import assert from "node:assert/strict";
import {mkdtempSync,mkdirSync,rmSync,readFileSync} from "node:fs";
import {resolve,join,sep} from "node:path";
import {createRallyPreview} from "../lib/operator/rally-preview.ts";
import {getBrowserSpots} from "../lib/spots/browser-catalog.ts";
import {mergeSpotEdits} from "../lib/spots/editing.ts";
import {createDraftRepository} from "../lib/operator/draft-repository.ts";
import {prepareExpandedRoadConnections} from "../lib/miura-road-connections.ts";
import {extractContext,createKomaContext} from "../lib/route/context.ts";
const spots=mergeSpotEdits(getBrowserSpots(),[]),find=id=>spots.find(s=>s.id===id);
const S="osm-way-384676338",C="osm-way-394752558",M="osm-node-2046962408",L="osm-node-1211621029",A="osm-node-12364319660";
const draft=(ids=[S,C,M,S])=>({title:"三崎の生成テスト",start:find(ids[0]),finish:find(ids.at(-1)),stops:ids.slice(1,-1).map((id,i)=>({kind:i%2?"waypoint":"checkpoint",spot:find(id)})),revision:1,updatedAt:"2026-11-09T00:00:00.000Z"});
let loop;
const preview=()=>loop??=createRallyPreview(draft(),spots);
test("preview preserves visit order, roles, distance, koma occurrences and complete branch sets",()=>{
 const p=preview();assert.equal(p.state,"ready");assert.ok(Math.abs(p.meters-1231.9926403365716)<1e-6);assert.equal(p.cards.length,39);
 assert.deepEqual(p.visits.map(v=>v.spotId),[S,C,M,S]);assert.deepEqual(p.visits.map(v=>v.label),["開始","チェックポイント 1","経由地 2","終了"]);
 assert.equal(p.legs.length,3);assert.equal(p.path.length,p.cards.at(-1).map.pathIndex+1);
 for(const v of p.visits){assert.ok(v.komaIndex>=0);assert.ok(p.cards[v.komaIndex].map.stopIds.includes(v.id))}
 for(const card of p.cards){
  assert.deepEqual(card.candidate.point,p.path[card.map.pathIndex]);
  if(card.map.state==="ready")assert.deepEqual(card.map.branches.map(b=>b.neighborNodeId).sort((a,b)=>a-b),card.candidate.branches.map(b=>b.neighborNodeId).sort((a,b)=>a-b));
  else assert.equal(card.map.branches.length,0);
 }
 const total=p.cards.reduce((n,c)=>n+(c.map.metersToNext??0),0);assert.ok(Math.abs(total-p.meters)<1e-6);
 assert.equal(p.cards[0].map.kind,"start");assert.equal(p.cards.at(-1).map.kind,"finish");
});
test("return visits to the same physical point stay separate koma occurrences",()=>{
 const p=preview();assert.equal(p.cards[0].map.nodeId,p.cards.at(-1).map.nodeId);assert.notEqual(p.visits[0].komaIndex,p.visits.at(-1).komaIndex);
 assert.equal(p.visits[0].point.lat,p.visits.at(-1).point.lat);assert.ok(p.visits.some(v=>v.gap>30));
});
test("projected points link to real source ways and all reference IDs are positive",()=>{
 const p=preview();assert.ok(p.cards.some(c=>c.map.nodeId<0));
 for(const c of p.cards){assert.ok(c.evidence.id>0);if(c.map.nodeId<0){assert.equal(c.evidence.kind,"way");assert.ok(c.evidence.fromNodeId>0&&c.evidence.toNodeId>0)}else assert.equal(c.evidence.kind,"node")}
 assert.ok(p.roads.every(r=>r.id>0));assert.ok(p.roads.every(r=>r.points.every(n=>Number.isFinite(n.lat)&&Number.isFinite(n.lon))));
});
test("expanded building/landmark context matches the full source filters and is kept local",()=>{
 const p=preview(),g=prepareExpandedRoadConnections([find(S),find(C),find(M)]).graph,raw=JSON.parse(readFileSync(new URL("../data/miura-expanded/osm.json",import.meta.url))),full=extractContext(raw,g);
 const ready=p.cards.filter(c=>c.map.state==="ready");
 for(const c of [ready[0],ready[Math.floor(ready.length/2)],ready.at(-1)]){
  assert.deepEqual(c.context,createKomaContext(g,c.map,full));assert.ok(c.context.landmarks.length<=4);assert.ok(c.context.buildings.length<=12);
 }
 assert.ok(p.cards.some(c=>c.context.buildings.length>0));assert.ok(p.cards.some(c=>c.context.landmarks.length>0));
 assert.ok(Buffer.byteLength(JSON.stringify(p))<800000);
});
test("held diagrams are retained with reasons rather than dropped or guessed",()=>{
 const p=preview(),held=p.cards.filter(c=>c.map.state==="held");assert.equal(held.length,12);
 for(const c of held){assert.ok(c.map.issues.length>0);assert.deepEqual(c.context.landmarks,[]);assert.deepEqual(c.map.branches,[])}
 assert.deepEqual(p.cards.map(c=>c.map.sequence),Array.from({length:39},(_,i)=>i+1));
});
test("missing, malformed, changed and deleted draft inputs block generation",()=>{
 assert.equal(createRallyPreview(null,spots).reason,"missing");
 assert.equal(createRallyPreview({...draft(),start:null},spots).reason,"invalid");
 const changed=spots.map(s=>s.id===C?{...s,name:"Changed",revision:1}:s);
 assert.equal(createRallyPreview(draft(),changed).reason,"catalog-changed");
 const deleted=spots.filter(s=>s.id!==C),r=createRallyPreview(draft(),deleted);assert.equal(r.reason,"catalog-changed");assert.match(r.message,/本瑞寺/);assert.equal("cards" in r,false);
});
test("unreachable and wholly zero routes return no partial route or fake koma",()=>{
 const r=createRallyPreview(draft([L,A]),spots);assert.equal(r.reason,"unreachable");assert.match(r.message,/城ヶ島灯台.*安房崎灯台/);assert.equal("cards" in r,false);
 const zero=createRallyPreview(draft([S,S]),spots);assert.equal(zero.reason,"zero-route");assert.equal("path" in zero,false);
});
test("coincident intermediate visits keep their roles within an otherwise positive route",()=>{
 const p=createRallyPreview(draft([S,S,M,S]),spots);assert.equal(p.state,"ready");assert.equal(p.legs[0].meters,0);
 assert.equal(p.visits[0].komaIndex,p.visits[1].komaIndex);assert.deepEqual(p.cards[0].map.stopIds,["start","stop-0"]);
});
test("reordered and edited saved inputs generate from their exact new conditions",()=>{
 const p=createRallyPreview(draft([S,M,C,S]),spots);assert.equal(p.state,"ready");assert.deepEqual(p.visits.map(v=>v.spotId),[S,M,C,S]);
 const d=draft();d.title="<img src=x onerror=alert(1)>";d.revision=2;
 const renamed=createRallyPreview(d,spots);assert.equal(renamed.state,"ready");assert.equal(renamed.title,d.title);assert.equal(renamed.draftRevision,2);
 assert.deepEqual(createRallyPreview(draft(),spots),preview());
});
test("cross-region route contains actual source bridge geometry and supports many koma",()=>{
 const p=createRallyPreview(draft([M,L]),spots);assert.equal(p.state,"ready");assert.equal(p.cards.length,69);assert.ok(p.roads.some(r=>r.id===787877796));
 assert.ok(Math.abs(p.meters-3313.8439428446814)<1e-6);assert.equal(p.visits.length,2);
});
test("generation never modifies a saved draft, catalog rows or DB schema",t=>{
 const parent=resolve(".tools/preview-tests");mkdirSync(parent,{recursive:true});const dir=mkdtempSync(join(parent,"case-"));
 t.after(()=>{assert.ok(resolve(dir).startsWith(parent+sep));rmSync(dir,{recursive:true,force:true})});
 const file=join(dir,"db.sqlite"),repo=createDraftRepository(file),d=draft(),ref=s=>({id:s.id,revision:s.revision});
 repo.save({title:d.title,expectedRevision:0,start:ref(d.start),finish:ref(d.finish),stops:d.stops.map(s=>({kind:s.kind,spot:ref(s.spot)}))});
 const current=repo.load(),before=readFileSync(file),result=createRallyPreview(current.draft,current.spots);
 assert.equal(result.state,"ready");assert.deepEqual(repo.load(),current);assert.deepEqual(readFileSync(file),before);
});
