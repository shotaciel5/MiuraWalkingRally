import test from "node:test";
import assert from "node:assert/strict";
import {mkdtempSync,mkdirSync,rmSync,readFileSync} from "node:fs";
import {resolve,join,sep} from "node:path";
import {execFileSync} from "node:child_process";
import {DatabaseSync} from "node:sqlite";
import {getBrowserSpots} from "../lib/spots/browser-catalog.ts";
import {createSpotRepository} from "../lib/spots/local-repository.ts";
import {parseSpotInput,mergeSpotEdits,decodeManagedSpot,SpotError} from "../lib/spots/editing.ts";
const seed=getBrowserSpots(),id="local-11111111-2222-4333-8444-555555555555";
const input=(extra={})=>({id,expectedRevision:0,name:"New cafe",category:"cafe",position:{lat:35.141,lon:139.62},description:"Description",...extra});
const existing=()=>input({id:"osm-way-384676338",name:"Edited shrine",category:"religious",position:{lat:seed.find(s=>s.id==="osm-way-384676338").position.lat,lon:seed.find(s=>s.id==="osm-way-384676338").position.lon}});
function fixture(t,loader=()=>seed){
 const parent=resolve(".tools/spot-repository-tests");mkdirSync(parent,{recursive:true});
 const dir=mkdtempSync(join(parent,"case-"));t.after(()=>{assert.ok(resolve(dir).startsWith(parent+sep));rmSync(dir,{recursive:true,force:true})});
 const path=join(dir,"spots.sqlite"),repository=createSpotRepository(path,loader,()=>"2026-11-08T03:00:00.000Z");
 return {path,repository};
}
test("spot input accepts only the approved editable fields and trims plain text",()=>{
 const parsed=parseSpotInput(input({name:" Cafe ",description:" line 1\nline 2 "}));
 assert.equal(parsed.name,"Cafe");assert.equal(parsed.description,"line 1\nline 2");assert.equal(parsed.position.lat,35.141);
 for(const mutation of [
 v=>{v.id="../bad"},v=>{v.expectedRevision=-1},v=>{v.expectedRevision=1.1},v=>{v.name=" "},v=>{v.name="x".repeat(301)},
 v=>{v.category="toString"},v=>{v.category=""},v=>{v.position.lat=NaN},v=>{v.position.lon=Infinity},v=>{v.position.lat=35.16},
 v=>{v.position.lon=139.6},v=>{v.position.lat="35.14"},v=>{v.description="x".repeat(2001)},
 v=>{v.source={url:"javascript:alert(1)"}},v=>{v.position.kind="entrance"},v=>{delete v.description},
 ]){
  const invalid=structuredClone(input());mutation(invalid);assert.throws(()=>parseSpotInput(invalid),e=>e instanceof SpotError&&e.code==="invalid");
 }
});
test("an empty edit store exposes all 178 initial spots without writing seed rows",t=>{
 const {path,repository}=fixture(t);assert.equal(repository.list().length,178);
 const db=new DatabaseSync(path);assert.equal(db.prepare("SELECT count(*) AS n FROM spot_edits").get().n,0);db.close();
 assert.deepEqual(repository.list().find(s=>s.id==="osm-way-384676338").source,seed.find(s=>s.id==="osm-way-384676338").source);
});
test("new spots persist across repository instances and an independent Node process",t=>{
 const {path,repository}=fixture(t);const saved=repository.save(input());
 assert.equal(saved.id,id);assert.equal(saved.revision,1);assert.equal(saved.source,null);assert.equal(saved.position.kind,"operator");assert.equal(saved.reviewStatus,"unverified");
 assert.equal(createSpotRepository(path).list().length,90);
 const code="import {createSpotRepository} from './lib/spots/local-repository.ts';const s=createSpotRepository("+JSON.stringify(path)+").list().find(s=>s.id==="+JSON.stringify(id)+");console.log(JSON.stringify(s));";
 const restored=JSON.parse(execFileSync(process.execPath,["--input-type=module","-e",code],{encoding:"utf8"}));assert.deepEqual(restored,saved);
});
test("editing seed data preserves identity, provenance and its existing anchor when location stays the same",t=>{
 const {repository}=fixture(t),saved=repository.save(existing()),base=seed.find(s=>s.id===saved.id);
 assert.equal(repository.list().length,178);assert.equal(saved.name,"Edited shrine");assert.deepEqual(saved.source,base.source);
 assert.deepEqual(saved.position,base.position);assert.deepEqual(saved.routing,base.routing);assert.equal(saved.revision,1);
 assert.deepEqual(seed.find(s=>s.id===saved.id),base);
});
test("moving a spot invalidates an anchor and returning to the old position does not silently restore it",t=>{
 const {repository}=fixture(t),first=repository.save(existing({}));
 const moved=repository.save({...existing(),expectedRevision:first.revision,position:{lat:35.13,lon:139.62}});
 assert.equal(moved.area,"jogashima-vicinity");assert.equal(moved.routing.state,"outside-road-snapshot");assert.equal(moved.position.kind,"operator");
 const returned=repository.save({...existing(),expectedRevision:moved.revision});
 assert.equal(returned.routing.state,"entrance-unverified");assert.equal(returned.position.kind,"operator");assert.equal(returned.routing.nodeId,undefined);
});
test("a new point within the road snapshot remains entrance-unverified",t=>{
 const {repository}=fixture(t);assert.deepEqual(repository.save(input()).routing,{state:"entrance-unverified"});
});
test("create and update retries preserve the first revision and time without duplicate records",t=>{
 const {repository}=fixture(t);const first=repository.save(input()),retry=repository.save(input());assert.deepEqual(retry,first);
 const changed=repository.save(input({expectedRevision:1,name:"Changed"}));
 assert.deepEqual(repository.save(input({expectedRevision:1,name:"Changed"})),changed);
 assert.equal(repository.list().filter(s=>s.id===id).length,1);assert.equal(changed.revision,2);
});
test("stale edits from a second repository cannot overwrite a newer change",t=>{
 const {path,repository}=fixture(t),other=createSpotRepository(path);
 repository.save(input());repository.save(input({expectedRevision:1,name:"First editor"}));
 assert.throws(()=>other.save(input({expectedRevision:1,name:"Other editor"})),e=>e.code==="conflict");
 assert.equal(other.list().find(s=>s.id===id).name,"First editor");
});
test("unknown OSM ids and a wrong revision for new ids do not create data",t=>{
 const {repository}=fixture(t);
 assert.throws(()=>repository.save(input({id:"osm-node-999999999999"})),e=>e.code==="missing");
 assert.throws(()=>repository.save(input({expectedRevision:5})),e=>e.code==="conflict");assert.equal(repository.list().length,178);
});
test("same names at distinct places keep separate identities",t=>{
 const {repository}=fixture(t);repository.save(input());repository.save(input({id:"local-aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee",position:{lat:35.142,lon:139.621}}));
 assert.equal(repository.list().filter(s=>s.name==="New cafe").length,2);
});
test("reapplying or refreshing seed data preserves operator additions and edits",t=>{
 let source=structuredClone(seed);const {path,repository}=fixture(t,()=>source);
 repository.save(existing());repository.save(input());source=structuredClone(seed);source.find(s=>s.id==="osm-way-384676338").name="Upstream change";
 const restored=createSpotRepository(path,()=>source).list();assert.equal(restored.length,179);assert.equal(restored.find(s=>s.id==="osm-way-384676338").name,"Edited shrine");
 assert.equal(restored.find(s=>s.id===id).name,"New cafe");
});
test("invalid source or corrupt stored data fails closed and is not reset",t=>{
 const {path,repository}=fixture(t);repository.save(input());
 assert.throws(()=>createSpotRepository(path,()=>null).list(),e=>e.code==="unavailable");
 const db=new DatabaseSync(path);db.prepare("UPDATE spot_edits SET value=? WHERE id=?").run("{bad",id);db.close();
 assert.throws(()=>repository.list(),e=>e.code==="unavailable");
 const check=new DatabaseSync(path);assert.equal(check.prepare("SELECT value FROM spot_edits WHERE id=?").get(id).value,"{bad");check.close();
});
test("unsupported database versions and unavailable destinations never report successful saves",t=>{
 const {path,repository}=fixture(t);repository.list();const db=new DatabaseSync(path);db.exec("PRAGMA user_version=99");db.close();
 assert.throws(()=>repository.save(input()),e=>e.code==="unavailable");
 assert.throws(()=>createSpotRepository(resolve(path,"child.sqlite")).save(input()));
});
test("a locked database leaves previous values intact and can be retried after release",t=>{
 const {path,repository}=fixture(t);repository.save(input());const lock=new DatabaseSync(path);lock.exec("BEGIN EXCLUSIVE");
 try{assert.throws(()=>repository.save(input({expectedRevision:1,name:"Changed"})))}finally{lock.exec("ROLLBACK");lock.close()}
 assert.equal(repository.list().find(s=>s.id===id).name,"New cafe");assert.equal(repository.save(input({expectedRevision:1,name:"Changed"})).name,"Changed");
});
test("stored data cannot forge an entrance, source identity, id or timestamp",()=>{
 const edit={...input(),positionOverride:true,revision:1,updatedAt:"2026-11-08T03:00:00.000Z"};delete edit.expectedRevision;
 for(const value of [{...edit,id:"osm-node-999999999999"},{...edit,updatedAt:"invalid"},{...edit,positionOverride:false}]){
  assert.throws(()=>mergeSpotEdits(seed,[value]),e=>e.code==="unavailable");
 }
 assert.throws(()=>mergeSpotEdits(seed,[edit,edit]),e=>e.code==="unavailable");
});
test("managed responses preserve plain text and reject forged public metadata",t=>{
 const {repository}=fixture(t),saved=repository.save(input({name:"<img src=x onerror=alert(1)>"}));
 assert.deepEqual(decodeManagedSpot(saved),saved);
 for(const change of [v=>{v.source={type:"node",id:1,url:"javascript:alert(1)"}},v=>{v.reviewStatus="verified"},v=>{v.routing={state:"poc-reference",nodeId:1}},v=>{v.revision=-1},v=>{v.updatedAt="bad"}]){
  const value=structuredClone(saved);change(value);assert.equal(decodeManagedSpot(value),null);
 }
});
test("repository operations do not alter the immutable source fixture",t=>{
 const path=new URL("../data/spots/initial-spots.json",import.meta.url),before=readFileSync(path);
 const {repository}=fixture(t);repository.list();repository.save(existing());repository.save(input());assert.deepEqual(readFileSync(path),before);
});

test("missing or foreign database tables are not silently recreated or overwritten",t=>{
 const {path,repository}=fixture(t);repository.save(input());
 const broken=new DatabaseSync(path);broken.exec("DROP TABLE spot_edits");broken.close();
 assert.throws(()=>repository.list());
 const check=new DatabaseSync(path);assert.equal(check.prepare("SELECT name FROM sqlite_schema WHERE name='spot_edits'").all().length,0);check.close();
 const foreignPath=path+".foreign.sqlite",foreign=new DatabaseSync(foreignPath);
 foreign.exec("CREATE TABLE unrelated(value TEXT); INSERT INTO unrelated VALUES ('keep')");foreign.close();
 assert.throws(()=>createSpotRepository(foreignPath).save(input()),e=>e.code==="unavailable");
 const preserved=new DatabaseSync(foreignPath);assert.equal(preserved.prepare("SELECT value FROM unrelated").get().value,"keep");
 assert.equal(preserved.prepare("PRAGMA user_version").get().user_version,0);preserved.close();
});
