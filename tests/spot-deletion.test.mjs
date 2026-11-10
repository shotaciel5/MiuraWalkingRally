import test from "node:test";
import assert from "node:assert/strict";
import {getFixedCourseUses} from "../lib/spots/fixed-course-usage.ts";
import {getDemoRally} from "../lib/demo-rally.ts";
import {getBrowserSpots} from "../lib/spots/browser-catalog.ts";

test("fixed course usage resolves three stable catalog IDs to the actual demo stops",()=>{
 const uses=getFixedCourseUses(),rally=getDemoRally(),seed=getBrowserSpots();
 assert.equal(uses.length,3);assert.equal(new Set(uses.map(u=>u.spotId)).size,3);
 assert.deepEqual(uses.map(u=>[u.spotId,u.stopId]),[["osm-way-384676338","C1"],["osm-way-394752554","W1"],["osm-way-394752558","C2"]]);
 for(const use of uses){const stop=rally.stops.find(s=>s.id===use.stopId);assert.ok(seed.some(s=>s.id===use.spotId));assert.equal(use.stopName,stop.name);assert.equal(use.role,stop.role);assert.equal(use.courseTitle,rally.title);assert.equal(use.href,rally.href)}
});
test("usage lookup is independent from edited catalog names, positions or routing status",()=>{
 const uses=getFixedCourseUses(),spot={id:"osm-way-384676338",name:"Changed",position:{lat:35.13,lon:139.62},routing:{state:"outside-road-snapshot"}};
 assert.equal(uses.find(u=>u.spotId===spot.id).stopId,"C1");
 assert.equal(uses.find(u=>u.spotId==="local-11111111-2222-4333-8444-555555555555"),undefined);
});

import {mkdtempSync,mkdirSync,rmSync,readFileSync} from "node:fs";
import {resolve,join,sep} from "node:path";
import {execFileSync} from "node:child_process";
import {DatabaseSync} from "node:sqlite";
import {createSpotRepository} from "../lib/spots/local-repository.ts";
import {parseSpotDeleteInput,parseSpotDeletion,activeSpots} from "../lib/spots/deletion.ts";
import {SpotError} from "../lib/spots/editing.ts";
import {filterSpots,DEFAULT_FILTERS} from "../lib/spots/browser-view.ts";
const seed=getBrowserSpots(),firstId="osm-way-384676338",localId="local-11111111-2222-4333-8444-555555555555";
const added=(extra={})=>({id:localId,expectedRevision:0,name:"Local cafe",category:"cafe",position:{lat:35.141,lon:139.62},description:"Keep this data",...extra});
function fixture(t,load=()=>seed){
 const root=resolve(".tools/spot-deletion-tests");mkdirSync(root,{recursive:true});
 const dir=mkdtempSync(join(root,"case-"));t.after(()=>{assert.ok(resolve(dir).startsWith(root+sep));rmSync(dir,{recursive:true,force:true})});
 const path=join(dir,"spots.sqlite");
 return {path,repository:createSpotRepository(path,load,()=>"2026-11-08T04:00:00.000Z")};
}
const remove=(repository,id=firstId,expectedRevision=0)=>repository.remove({id,expectedRevision});
test("deletion input accepts only stable identity and a valid expected revision",()=>{
 assert.deepEqual(parseSpotDeleteInput({id:firstId,expectedRevision:0}),{id:firstId,expectedRevision:0});
 for(const value of [null,[],{}, {id:"../bad",expectedRevision:0},{id:firstId,expectedRevision:-1},{id:firstId,expectedRevision:1.1},
  {id:firstId,expectedRevision:NaN},{id:firstId,expectedRevision:Number.MAX_SAFE_INTEGER},{id:firstId,expectedRevision:0,force:true}])
  assert.throws(()=>parseSpotDeleteInput(value),e=>e instanceof SpotError&&e.code==="invalid");
});
test("deleting an initial spot hides it without removing the immutable source and survives another process",t=>{
 const {path,repository}=fixture(t),before=readFileSync(new URL("../data/spots/initial-spots.json",import.meta.url));
 const deleted=remove(repository);assert.equal(deleted.id,firstId);assert.equal(deleted.deletedFromRevision,0);assert.equal(deleted.revision,1);
 assert.equal(repository.list().length,177);assert.equal(repository.list().some(s=>s.id===firstId),false);
 const code="import {createSpotRepository} from './lib/spots/local-repository.ts';console.log(JSON.stringify(createSpotRepository("+JSON.stringify(path)+").list().map(s=>s.id)));";
 const ids=JSON.parse(execFileSync(process.execPath,["--input-type=module","-e",code],{encoding:"utf8"}));assert.equal(ids.length,177);assert.ok(!ids.includes(firstId));
 const db=new DatabaseSync(path);assert.equal(db.prepare("SELECT count(*) AS n FROM spot_edits").get().n,0);assert.equal(db.prepare("SELECT count(*) AS n FROM spot_deletions").get().n,1);db.close();
 assert.deepEqual(readFileSync(new URL("../data/spots/initial-spots.json",import.meta.url)),before);
});
test("deleting an added spot retains its saved fields and blocks implicit restoration by a delayed PUT",t=>{
 const {path,repository}=fixture(t),saved=repository.save(added());const deletion=remove(repository,localId,saved.revision);
 assert.equal(repository.list().length,178);assert.equal(deletion.name,"Local cafe");
 for(const input of [added(),added({expectedRevision:saved.revision,name:"Delayed edit"})])assert.throws(()=>repository.save(input),e=>e.code==="conflict");
 const db=new DatabaseSync(path);const stored=JSON.parse(db.prepare("SELECT value FROM spot_edits WHERE id=?").get(localId).value);db.close();
 assert.equal(stored.description,"Keep this data");assert.equal(stored.name,"Local cafe");assert.equal(stored.revision,1);
});
test("editing an initial spot before deleting it preserves the edit instead of undoing it",t=>{
 const {path,repository}=fixture(t),base=repository.list().find(s=>s.id===firstId);
 const edited=repository.save(added({id:firstId,name:"Edited shrine",category:base.category,position:{lat:base.position.lat,lon:base.position.lon}}));
 assert.equal(remove(repository,firstId,edited.revision).deletedFromRevision,1);assert.equal(repository.list().length,177);
 const db=new DatabaseSync(path);assert.equal(JSON.parse(db.prepare("SELECT value FROM spot_edits WHERE id=?").get(firstId).value).name,"Edited shrine");db.close();
 assert.throws(()=>repository.save(added({id:firstId,expectedRevision:1,name:"Edited shrine",category:base.category,position:{lat:base.position.lat,lon:base.position.lon}})),e=>e.code==="conflict");
});
test("repeated deletion returns the first timestamp and revision without a second tombstone",t=>{
 const {path,repository}=fixture(t),first=remove(repository);
 const other=createSpotRepository(path,()=>seed,()=>"2026-11-09T00:00:00.000Z");assert.deepEqual(remove(other),first);
 assert.throws(()=>remove(other,firstId,1),e=>e.code==="conflict");
 const db=new DatabaseSync(path);assert.equal(db.prepare("SELECT count(*) AS n FROM spot_deletions").get().n,1);db.close();
});
test("a stale confirmation cannot delete a spot edited by a different screen",t=>{
 const {repository}=fixture(t),saved=repository.save(added());
 repository.save(added({expectedRevision:saved.revision,name:"Other editor"}));
 assert.throws(()=>remove(repository,localId,saved.revision),e=>e.code==="conflict");
 const current=repository.list().find(s=>s.id===localId);assert.equal(current.name,"Other editor");assert.equal(current.revision,2);
 assert.equal(remove(repository,localId,current.revision).name,"Other editor");
});
test("unknown identities and invalid requests do not create deletion records",t=>{
 const {path,repository}=fixture(t);repository.list();
 assert.throws(()=>remove(repository,"osm-node-999999999999"),e=>e.code==="missing");
 assert.throws(()=>remove(repository,"local-aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee"),e=>e.code==="missing");
 assert.throws(()=>remove(repository,firstId,-1),e=>e.code==="invalid");
 const db=new DatabaseSync(path);assert.equal(db.prepare("SELECT count(*) AS n FROM spot_deletions").get().n,0);db.close();assert.equal(repository.list().length,178);
});
test("reapplying initial data does not revive a deleted ID even if its source name changes",t=>{
 let source=structuredClone(seed);const {path,repository}=fixture(t,()=>source);remove(repository);
 source=structuredClone(seed);source.find(s=>s.id===firstId).name="New upstream label";
 assert.equal(createSpotRepository(path,()=>source).list().some(s=>s.id===firstId),false);
 assert.equal(repository.list().length,177);
});
test("same-named places retain separate identities when one is deleted",t=>{
 const {repository}=fixture(t),other="osm-way-395998657";
 assert.equal(repository.list().find(s=>s.id===other).name,repository.list().find(s=>s.id===firstId).name);
 remove(repository);assert.equal(repository.list().some(s=>s.id===other),true);
});
test("known fixed-course places may be deleted while the original course and its revision remain intact",t=>{
 const {repository}=fixture(t),rally=getDemoRally(),before=JSON.stringify(rally);
 for(const use of getFixedCourseUses())remove(repository,use.spotId);
 assert.equal(repository.list().length,175);assert.equal(filterSpots(repository.list(),DEFAULT_FILTERS).length,21);
 assert.equal(JSON.stringify(getDemoRally()),before);assert.equal(getDemoRally().revision,rally.revision);
});
test("all demo sample spots may be hidden and the sample then reports zero rather than phantom entries",t=>{
 const {repository}=fixture(t);for(const spot of filterSpots(repository.list(),DEFAULT_FILTERS))remove(repository,spot.id,spot.revision);
 assert.equal(filterSpots(repository.list(),DEFAULT_FILTERS).length,0);assert.equal(repository.list().length,154);
});
test("version 1 databases migrate transactionally and preserve existing seed edits and added rows",t=>{
 const {path}=fixture(t),db=new DatabaseSync(path),base=seed.find(s=>s.id===firstId);
 db.exec("CREATE TABLE spot_edits (id TEXT PRIMARY KEY,value TEXT NOT NULL) STRICT; PRAGMA user_version=1");
 const rows=[{...added(),positionOverride:true,revision:1,updatedAt:"2026-11-08T03:00:00.000Z"},
  {...added({id:firstId,name:"Earlier edit",category:base.category,position:{lat:base.position.lat,lon:base.position.lon}}),positionOverride:false,revision:1,updatedAt:"2026-11-08T03:00:00.000Z"}];
 for(const row of rows){delete row.expectedRevision;db.prepare("INSERT INTO spot_edits VALUES (?,?)").run(row.id,JSON.stringify(row))}db.close();
 const repository=createSpotRepository(path);assert.equal(repository.list().length,179);assert.equal(repository.list().find(s=>s.id===firstId).name,"Earlier edit");
 const migrated=new DatabaseSync(path);assert.equal(migrated.prepare("PRAGMA user_version").get().user_version,7);
 for(const row of rows)assert.deepEqual(JSON.parse(migrated.prepare("SELECT value FROM spot_edits WHERE id=?").get(row.id).value),row);
 assert.equal(migrated.prepare("SELECT count(*) AS n FROM spot_deletions").get().n,0);migrated.close();
 assert.equal(remove(repository,localId,1).revision,2);assert.equal(repository.list().length,178);
});
test("failed version 1 migrations roll back and do not overwrite an unexpected table",t=>{
 const {path}=fixture(t),db=new DatabaseSync(path);
 db.exec("CREATE TABLE spot_edits (id TEXT PRIMARY KEY,value TEXT NOT NULL) STRICT; CREATE TABLE spot_deletions(note TEXT); INSERT INTO spot_deletions VALUES ('keep'); PRAGMA user_version=1");db.close();
 assert.throws(()=>createSpotRepository(path).list());
 const check=new DatabaseSync(path);assert.equal(check.prepare("PRAGMA user_version").get().user_version,1);assert.equal(check.prepare("SELECT note FROM spot_deletions").get().note,"keep");check.close();
});
test("corrupt deletion data or a missing deletion table fails closed without reviving records",t=>{
 const {path,repository}=fixture(t);remove(repository);
 const db=new DatabaseSync(path);db.prepare("UPDATE spot_deletions SET value=? WHERE id=?").run("{bad",firstId);db.close();
 assert.throws(()=>repository.list(),e=>e.code==="unavailable");assert.throws(()=>repository.save(added()),e=>e.code==="unavailable");
 const check=new DatabaseSync(path);assert.equal(check.prepare("SELECT value FROM spot_deletions WHERE id=?").get(firstId).value,"{bad");check.exec("DROP TABLE spot_deletions");check.close();
 assert.throws(()=>repository.list());const missing=new DatabaseSync(path);assert.equal(missing.prepare("SELECT name FROM sqlite_schema WHERE name='spot_deletions'").all().length,0);missing.close();
});
test("database locking does not report deletion success and can be retried after release",t=>{
 const {path,repository}=fixture(t);repository.list();const db=new DatabaseSync(path);db.exec("BEGIN EXCLUSIVE");
 try{assert.throws(()=>remove(repository))}finally{db.exec("ROLLBACK");db.close()}
 assert.equal(repository.list().length,178);assert.equal(remove(repository).id,firstId);assert.equal(repository.list().length,177);
});
test("malformed deletion metadata, duplicate tombstones and revision mismatches fail validation",()=>{
 const deletion={id:firstId,name:"Name",deletedFromRevision:0,revision:1,deletedAt:"2026-11-08T04:00:00.000Z"};
 assert.deepEqual(parseSpotDeletion(deletion),deletion);
 for(const value of [{...deletion,revision:2},{...deletion,deletedAt:"bad"},{...deletion,name:""},{...deletion,id:"bad"},{...deletion,extra:true}])assert.throws(()=>parseSpotDeletion(value),e=>e.code==="unavailable");
 const active=seed.map(s=>({...s,description:"",revision:0,updatedAt:null}));
 assert.throws(()=>activeSpots(active,[deletion,deletion]),e=>e.code==="unavailable");
 assert.throws(()=>activeSpots(active,[{...deletion,deletedFromRevision:1,revision:2}]),e=>e.code==="unavailable");
 assert.throws(()=>activeSpots(active,[{...deletion,id:"osm-node-999999999999"}]),e=>e.code==="unavailable");
});
