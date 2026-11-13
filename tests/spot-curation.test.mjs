import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";import path from "node:path";import crypto from "node:crypto";
import selection from "../data/spots/curation.json" with {type:"json"};
import {getBrowserSpots} from "../lib/spots/browser-catalog.ts";
import {curateManagedSpots,curatedSpotIds} from "../lib/spots/curation.ts";
import {mergeSpotEdits} from "../lib/spots/editing.ts";
import {createSpotRepository,readSpotState} from "../lib/spots/local-repository.ts";
import {createDraftRepository} from "../lib/operator/draft-repository.ts";
import {draftIssues} from "../lib/operator/rally-draft.ts";
import {DatabaseSync} from "node:sqlite";
const source=getBrowserSpots(),raw=mergeSpotEdits(source,[]),curated=curateManagedSpots(raw,source),local="local-11111111-2222-4333-8444-555555555555";
function fixture(t){const parent=path.resolve(".tools/curation-tests");fs.mkdirSync(parent,{recursive:true});const dir=fs.mkdtempSync(path.join(parent,"case-"));t.after(()=>{assert.ok(path.resolve(dir).startsWith(parent+path.sep));fs.rmSync(dir,{recursive:true,force:true})});return path.join(dir,"spots.sqlite")}
const input=(s,extra={})=>({id:s.id,expectedRevision:s.revision,name:s.name,category:s.category,position:{lat:s.position.lat,lon:s.position.lon},description:s.description,...extra});

test("the reviewed 89-place catalog keeps original IDs/coordinates, both areas and all 13 categories",()=>{
 assert.equal(curated.length,89);assert.equal(source.length,178);assert.equal(new Set(curated.map(s=>s.id)).size,89);
 assert.deepEqual(Object.fromEntries(["misaki-vicinity","jogashima-vicinity"].map(a=>[a,curated.filter(s=>s.area===a).length])),{"misaki-vicinity":58,"jogashima-vicinity":31});
 assert.equal(new Set(curated.map(s=>s.category)).size,13);for(const s of curated)assert.deepEqual(s,raw.find(r=>r.id===s.id));
 assert.equal(crypto.createHash("sha256").update(fs.readFileSync(new URL("../data/spots/initial-spots.json",import.meta.url))).digest("hex"),selection.sourceCatalogSha256);
 assert.equal(selection.excluded.length,89);assert.ok(selection.excluded.every(s=>!curated.some(c=>c.id===s.id)));
});
test("same-premises details are represented once, while distant same-named shrines stay distinct",()=>{
 for(const g of selection.groups){assert.ok(curated.some(s=>s.id===g.representativeId));for(const id of g.memberIds){assert.ok(source.some(s=>s.id===id));assert.ok(!curated.some(s=>s.id===id))}}
 assert.ok(curated.some(s=>s.id==="osm-way-384676338"));assert.ok(curated.some(s=>s.id==="osm-way-395998657"));
 assert.equal(curated.filter(s=>s.name.includes("海南神社")).length,2);assert.equal(curated.filter(s=>s.name.includes("海南神社のイチョウ")).length,0);
});
test("a default empty repository exposes the same curated catalog to spots and draft without writing a seed",t=>{
 const dbPath=fixture(t),repo=createSpotRepository(dbPath);assert.deepEqual(repo.list(),curated);assert.deepEqual(createDraftRepository(dbPath).load().spots,curated);
 const db=new DatabaseSync(dbPath);try{assert.equal(readSpotState(db).all.length,178);assert.equal(db.prepare("SELECT count(*) AS n FROM spot_edits").get().n,0)}finally{db.close()}
});
test("previous edits of excluded OSM spots and new local places survive curation/restart/deletion",t=>{
 const dbPath=fixture(t),legacy=createSpotRepository(dbPath,()=>source),excluded=raw.find(s=>s.id===selection.groups[0].memberIds[0]);
 const edited=legacy.save(input(excluded,{name:"運営者が編集した場所"})),repo=createSpotRepository(dbPath);
 assert.equal(repo.list().length,90);assert.deepEqual(repo.list().find(s=>s.id===edited.id),edited);
 const added=repo.save({id:local,expectedRevision:0,name:"新しいお店",category:"cafe",position:{lat:35.141,lon:139.62},description:""});assert.equal(repo.list().length,91);
 assert.deepEqual(createSpotRepository(dbPath).list().find(s=>s.id===local),added);repo.remove({id:edited.id,expectedRevision:edited.revision});assert.equal(repo.list().length,90);assert.ok(!repo.list().some(s=>s.id===edited.id));
 assert.throws(()=>repo.save(input(excluded)),e=>e.code==="conflict");
});
test("catalog reduction never silently maps a working draft to a representative spot",t=>{
 const dbPath=fixture(t),legacy=createDraftRepository(dbPath,()=>source),excluded=selection.groups[0].memberIds[0],ref=id=>({id,revision:0});
 const original=legacy.save({expectedRevision:0,title:"以前の下書き",start:ref("osm-way-384676338"),finish:ref("osm-way-384676338"),stops:[{kind:"checkpoint",spot:ref(excluded)}]}).draft;
 const current=createDraftRepository(dbPath).load();assert.deepEqual(current.draft,original);assert.ok(draftIssues(current.draft,current.spots).some(i=>i.state==="missing"));assert.throws(()=>createDraftRepository(dbPath).save({expectedRevision:1,title:original.title,start:ref(original.start.id),finish:ref(original.finish.id),stops:[{kind:"checkpoint",spot:ref(excluded)}]}),e=>e.reason==="catalog-conflict");
});
test("an incomplete source cannot silently drop curated entries",()=>{assert.throws(()=>curatedSpotIds(source.slice(1)));assert.throws(()=>curatedSpotIds(source.filter(s=>s.id!=="osm-way-384676338")))});
