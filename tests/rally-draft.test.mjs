import test from "node:test";
import assert from "node:assert/strict";
import {mkdtempSync,mkdirSync,rmSync,readFileSync} from "node:fs";
import {resolve,join,sep} from "node:path";
import {execFileSync} from "node:child_process";
import {DatabaseSync} from "node:sqlite";
import {createDraftRepository} from "../lib/operator/draft-repository.ts";
import {createSpotRepository} from "../lib/spots/local-repository.ts";
import {getBrowserSpots} from "../lib/spots/browser-catalog.ts";
import {blankDraft,parseDraftInput,decodeRallyDraft,draftInput,draftSignature,draftIssues,refreshDraftSpots,decodeDraftContext} from "../lib/operator/rally-draft.ts";
import {getDemoRally} from "../lib/demo-rally.ts";
const seed=getBrowserSpots(),s="osm-way-384676338",a="osm-way-394752554",b="osm-way-394752558";
const ref=id=>({id,revision:0});
const input=(extra={})=>({expectedRevision:0,title:"Walking draft",start:ref(s),finish:ref(s),stops:[{kind:"checkpoint",spot:ref(a)},{kind:"waypoint",spot:ref(b)}],...extra});
function fixture(t,loader=()=>seed){
 const root=resolve(".tools/rally-draft-tests");mkdirSync(root,{recursive:true});const dir=mkdtempSync(join(root,"case-"));
 t.after(()=>{assert.ok(resolve(dir).startsWith(root+sep));rmSync(dir,{recursive:true,force:true})});
 const path=join(dir,"operator.sqlite");return {path,repo:createDraftRepository(path,loader,()=>"2026-11-08T05:00:00.000Z"),spots:createSpotRepository(path,loader)};
}
test("draft input permits a shared start and finish and optional intermediate places",()=>{
 assert.equal(parseDraftInput(input()).start.id,parseDraftInput(input()).finish.id);
 assert.equal(parseDraftInput(input({stops:[]})).stops.length,0);
 assert.equal(parseDraftInput(input({stops:[{kind:"checkpoint",spot:ref(s)}]})).stops[0].spot.id,s);
 assert.equal(parseDraftInput(input({title:"  Title  "})).title,"Title");
});
test("invalid names, IDs, revisions, roles and repeated intermediate identities are rejected",()=>{
 for(const value of [null,{},input({title:" "}),input({title:"x".repeat(101)}),input({expectedRevision:-1}),input({start:null}),
 input({start:{id:"../bad",revision:0}}),input({finish:{id:s,revision:NaN}}),input({stops:[{kind:"wrong",spot:ref(a)}]}),
 input({stops:[{kind:"checkpoint",spot:ref(a)},{kind:"waypoint",spot:ref(a)}]}),{...input(),published:true},
 input({start:{id:s,revision:0,position:{lat:0,lon:0}}})])assert.throws(()=>parseDraftInput(value));
});
test("opening the work area does not create a draft and initializes version 5",t=>{
 const {path,repo}=fixture(t),state=repo.load();assert.equal(state.draft,null);assert.equal(state.spots.length,178);
 const db=new DatabaseSync(path);assert.equal(db.prepare("PRAGMA user_version").get().user_version,5);assert.equal(db.prepare("SELECT count(*) AS n FROM rally_draft").get().n,0);db.close();
});
test("saving records roles and source snapshots without generating a route",t=>{
 const {repo}=fixture(t),state=repo.save(input()),draft=state.draft;
 assert.equal(draft.start.id,draft.finish.id);assert.deepEqual(draft.stops.map(s=>s.kind),["checkpoint","waypoint"]);assert.equal(draft.revision,1);
 assert.equal(draft.start.name,seed.find(s0=>s0.id===s).name);assert.equal(draft.route,undefined);assert.equal(draft.published,undefined);
 assert.deepEqual(decodeRallyDraft(draft),draft);assert.equal(draftInput(draft,1).expectedRevision,1);
});
test("a saved draft survives independent repositories and a separate Node process",t=>{
 const {path,repo}=fixture(t),saved=repo.save(input()).draft;
 assert.deepEqual(createDraftRepository(path).load().draft,saved);
 const code="import {createDraftRepository} from './lib/operator/draft-repository.ts';console.log(JSON.stringify(createDraftRepository("+JSON.stringify(path)+").load().draft));";
 assert.deepEqual(JSON.parse(execFileSync(process.execPath,["--input-type=module","-e",code],{encoding:"utf8"})),saved);
});
test("lost-response retries return the first saved revision and time",t=>{
 const {path,repo}=fixture(t),first=repo.save(input()).draft,later=createDraftRepository(path,()=>seed,()=>"2026-11-09T00:00:00.000Z");
 assert.deepEqual(later.save(input()).draft,first);const db=new DatabaseSync(path);assert.equal(db.prepare("SELECT count(*) AS n FROM rally_draft").get().n,1);db.close();
});
test("updating the single draft is explicit and stale different edits cannot overwrite it",t=>{
 const {path,repo}=fixture(t);repo.save(input());const updated=repo.save(input({expectedRevision:1,title:"Updated"})).draft;
 assert.equal(updated.revision,2);assert.throws(()=>createDraftRepository(path).save(input({expectedRevision:1,title:"Other editor"})),e=>e.reason==="draft-conflict");
 assert.equal(repo.load().draft.title,"Updated");assert.deepEqual(repo.save(input({expectedRevision:1,title:"Updated"})).draft,updated);
});
test("deleted source places remain visible in saved snapshots and block another save",t=>{
 const {repo,spots}=fixture(t),saved=repo.save(input()).draft;spots.remove({id:a,expectedRevision:0});
 const state=repo.load();assert.deepEqual(state.draft,saved);assert.equal(state.spots.some(s0=>s0.id===a),false);
 assert.equal(draftIssues(state.draft,state.spots)[0].state,"missing");
 assert.throws(()=>repo.save(input({expectedRevision:1})),e=>e.reason==="catalog-conflict");
 const fixed={...state.draft,stops:state.draft.stops.filter(v=>v.spot.id!==a)};
 assert.equal(repo.save(draftInput(fixed,1)).draft.stops.length,1);
});
test("edited places require review, and explicit refresh preserves title and roles",t=>{
 const {repo,spots}=fixture(t),first=repo.save(input()).draft,old=first.start;
 spots.save({id:old.id,expectedRevision:old.revision,name:"Changed spot",category:old.category,position:{lat:35.13,lon:139.62},description:"Changed"});
 const state=repo.load();assert.equal(state.draft.start.name,old.name);assert.equal(draftIssues(state.draft,state.spots).length,2);
 assert.throws(()=>repo.save(input({expectedRevision:1})),e=>e.reason==="catalog-conflict");
 const refreshed=refreshDraftSpots(state.draft,state.spots);assert.equal(refreshed.title,first.title);assert.deepEqual(refreshed.stops.map(s0=>s0.kind),first.stops.map(s0=>s0.kind));
 assert.equal(refreshed.start.name,"Changed spot");assert.equal(refreshed.start.id,refreshed.finish.id);
 assert.equal(repo.save(draftInput(refreshed,1)).draft.revision,2);
});
test("unknown or deleted references cannot be forged into saved snapshots",t=>{
 const {repo}=fixture(t);
 assert.throws(()=>repo.save(input({start:ref("osm-node-999999999999")})),e=>e.reason==="catalog-conflict");
 assert.equal(repo.load().draft,null);
});
test("unconnected and outside-road-snapshot places may be saved as unverified draft inputs",t=>{
 const {repo}=fixture(t),state=repo.load(),outside=state.spots.find(s0=>s0.routing.state==="outside-road-snapshot"),unconnected=state.spots.find(s0=>s0.routing.state==="entrance-unverified");
 const saved=repo.save(input({start:ref(outside.id),finish:ref(unconnected.id),stops:[]})).draft;
 assert.equal(saved.start.reviewStatus,"unverified");assert.equal(saved.start.routing.state,"outside-road-snapshot");assert.equal(saved.finish.routing.state,"entrance-unverified");
});
test("initial data content changes are detected even when its operator revision is still zero",t=>{
 let source=structuredClone(seed);const {repo}=fixture(t,()=>source);repo.save(input());source=structuredClone(seed);source.find(v=>v.id===s).name="Changed source name";
 const state=repo.load();assert.equal(state.draft.start.revision,0);assert.equal(draftIssues(state.draft,state.spots).length,2);
});
test("version 2 migration preserves edited and deleted spot records",t=>{
 const {path}=fixture(t),db=new DatabaseSync(path),base=seed.find(v=>v.id===s);
 db.exec("CREATE TABLE spot_edits(id TEXT PRIMARY KEY,value TEXT NOT NULL) STRICT; CREATE TABLE spot_deletions(id TEXT PRIMARY KEY,value TEXT NOT NULL) STRICT; PRAGMA user_version=2");
 const edit={id:s,name:"Earlier name",category:base.category,position:{lat:base.position.lat,lon:base.position.lon},description:"Earlier edit",positionOverride:false,revision:1,updatedAt:"2026-11-08T04:00:00.000Z"};
 const deletion={id:a,name:"Deleted",deletedFromRevision:0,revision:1,deletedAt:"2026-11-08T04:00:00.000Z"};
 db.prepare("INSERT INTO spot_edits VALUES (?,?)").run(s,JSON.stringify(edit));db.prepare("INSERT INTO spot_deletions VALUES (?,?)").run(a,JSON.stringify(deletion));db.close();
 const state=createDraftRepository(path).load();assert.equal(state.draft,null);assert.equal(state.spots.length,177);assert.equal(state.spots.find(v=>v.id===s).name,"Earlier name");
 const check=new DatabaseSync(path);assert.equal(check.prepare("PRAGMA user_version").get().user_version,5);
 assert.deepEqual(JSON.parse(check.prepare("SELECT value FROM spot_edits WHERE id=?").get(s).value),edit);assert.deepEqual(JSON.parse(check.prepare("SELECT value FROM spot_deletions WHERE id=?").get(a).value),deletion);check.close();
});
test("corrupt or missing draft tables fail without replacing saved data",t=>{
 const {path,repo,spots}=fixture(t);repo.save(input());const db=new DatabaseSync(path);db.exec("UPDATE rally_draft SET value='{bad'");db.close();
 assert.throws(()=>repo.load(),e=>e.reason==="unavailable");assert.throws(()=>repo.save(input({expectedRevision:1})),e=>e.reason==="unavailable");
 const check=new DatabaseSync(path);assert.equal(check.prepare("SELECT value FROM rally_draft").get().value,"{bad");check.exec("DROP TABLE rally_draft");check.close();
 assert.throws(()=>repo.load());assert.throws(()=>spots.list());const missing=new DatabaseSync(path);assert.equal(missing.prepare("SELECT name FROM sqlite_schema WHERE name='rally_draft'").all().length,0);missing.close();
});
test("failed migrations roll back without losing a version 2 store",t=>{
 const {path}=fixture(t),db=new DatabaseSync(path);
 db.exec("CREATE TABLE spot_edits(id TEXT PRIMARY KEY,value TEXT NOT NULL) STRICT; CREATE TABLE spot_deletions(id TEXT PRIMARY KEY,value TEXT NOT NULL) STRICT; CREATE TABLE rally_draft(note TEXT); INSERT INTO rally_draft VALUES('keep'); PRAGMA user_version=2");db.close();
 assert.throws(()=>createDraftRepository(path).load());const check=new DatabaseSync(path);assert.equal(check.prepare("PRAGMA user_version").get().user_version,2);assert.equal(check.prepare("SELECT note FROM rally_draft").get().note,"keep");check.close();
});
test("locked saves do not report success and can be retried",t=>{
 const {path,repo}=fixture(t);repo.load();const lock=new DatabaseSync(path);lock.exec("BEGIN EXCLUSIVE");
 try{assert.throws(()=>repo.save(input()))}finally{lock.exec("ROLLBACK");lock.close()}
 assert.equal(repo.load().draft,null);assert.equal(repo.save(input()).draft.revision,1);
});
test("malformed snapshots and inconsistent copies of a shared spot are rejected",t=>{
 const {repo}=fixture(t),draft=repo.save(input()).draft;
 for(const change of [v=>{v.revision=0},v=>{v.updatedAt="bad"},v=>{v.start.source.url="javascript:alert(1)"},v=>{v.finish.name="Inconsistent"},v=>{v.stops[0].kind="unknown"}]){
  const bad=structuredClone(draft);change(bad);assert.equal(decodeRallyDraft(bad),null);
 }
 assert.equal(decodeDraftContext({draft,spots:[null]}),null);assert.equal(decodeDraftContext({draft:null,spots:[]}).spots.length,0);
});
test("saving and arranging draft selections leaves the fixed participant course and source fixture unchanged",t=>{
 const {repo}=fixture(t),before=getDemoRally().revision,path=new URL("../data/spots/initial-spots.json",import.meta.url),bytes=readFileSync(path);
 const first=repo.save(input()).draft,changed={...first,stops:[...first.stops].reverse()};assert.notEqual(draftSignature(first),draftSignature(changed));
 assert.equal(repo.save(draftInput(changed,1)).draft.stops[0].spot.id,b);assert.equal(getDemoRally().revision,before);assert.deepEqual(readFileSync(path),bytes);assert.equal(draftSignature(blankDraft()),draftSignature(blankDraft()));
});
