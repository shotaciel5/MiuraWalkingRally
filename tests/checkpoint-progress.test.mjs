import assert from "node:assert/strict";
import test from "node:test";
import {applyCheckpointConfirmation, decodeParticipation, participationKey, readParticipation, saveCheckpointConfirmation, startParticipation} from "../lib/participation.ts";

const edition={id:"misaki-shitamachi",revision:"demo-v1-current",checkpointIds:["C1","C2"],goalStopId:"G"};
const id="a06adbe7-5fb2-4f0f-9237-3718f9d6c38e";
const startedAt="2026-11-08T00:00:00.000Z",later="2026-11-08T00:10:00.000Z";
const record={schemaVersion:3,participationId:id,rallyId:edition.id,rallyRevision:edition.revision,startedAt,achievements:[],completion:null};
const confirmation=(checkpointId="C1",recordedAt=later)=>({checkpointId,method:"demo-button",recordedAt});
function memory(raw=JSON.stringify(record)){
  let value=raw;const writes=[];
  const store={getItem:()=>value,setItem:(key,next)=>{assert.equal(key,participationKey(edition.id));writes.push(next);value=next}};
  return {store,provider:()=>store,writes,raw:()=>value};
}
test("legacy start-only reads preserve identity without writing or accepting old achievement fields",()=>{
  const {achievements,completion,...legacy}=record;legacy.schemaVersion=1;
  const m=memory(JSON.stringify(legacy));
  assert.deepEqual(readParticipation(m.provider,edition),{status:"active",participation:record});
  assert.equal(m.writes.length,0);assert.equal(JSON.parse(m.raw()).schemaVersion,1);
  assert.equal(decodeParticipation(JSON.stringify({...legacy,achievements:[confirmation()]}),edition).status,"invalid");
});
test("the first explicit achievement upgrades a legacy record while retaining its identity and start time",()=>{
  const {achievements,completion,...legacy}=record;legacy.schemaVersion=1;
  const m=memory(JSON.stringify(legacy)),result=saveCheckpointConfirmation(m.provider,edition,id,confirmation());
  assert.equal(result.status,"saved");assert.equal(result.added,true);
  assert.equal(result.participation.participationId,id);assert.equal(result.participation.startedAt,startedAt);
  assert.equal(JSON.parse(m.raw()).schemaVersion,3);assert.deepEqual(JSON.parse(m.raw()).achievements,[confirmation()]);
});
test("the common recording transition appends a confirmation without mutating its input",()=>{
  const before=JSON.stringify(record),result=applyCheckpointConfirmation(record,edition,confirmation());
  assert.equal(result.status,"saved");assert.equal(result.added,true);
  assert.deepEqual(result.participation.achievements,[confirmation()]);
  assert.equal(JSON.stringify(record),before);
});
test("repeated confirmations retain the first time and count without writing again",()=>{
  const m=memory();saveCheckpointConfirmation(m.provider,edition,id,confirmation());
  const saved=m.raw(),again=saveCheckpointConfirmation(m.provider,edition,id,confirmation("C1","2026-11-08T00:20:00.000Z"));
  assert.equal(again.status,"saved");assert.equal(again.added,false);assert.equal(m.raw(),saved);assert.equal(m.writes.length,1);
});
test("demo confirmation accepts either checkpoint order without imposing a future QR policy",()=>{
  const m=memory();saveCheckpointConfirmation(m.provider,edition,id,confirmation("C2"));
  const result=saveCheckpointConfirmation(m.provider,edition,id,confirmation("C1"));
  assert.equal(result.status,"saved");assert.deepEqual(result.participation.achievements.map(a=>a.checkpointId),["C2","C1"]);
});
test("a stale UI identity reads the latest ledger so separate confirmations do not overwrite each other",()=>{
  const m=memory(),firstId=record.participationId;
  saveCheckpointConfirmation(m.provider,edition,firstId,confirmation("C1"));
  saveCheckpointConfirmation(m.provider,edition,firstId,confirmation("C2"));
  assert.deepEqual(JSON.parse(m.raw()).achievements.map(a=>a.checkpointId),["C1","C2"]);
});
test("waypoints, start/finish and unknown IDs are rejected without writes",()=>{
  for(const checkpointId of ["S","G","W1","missing","",1,null]){
    const m=memory();assert.equal(saveCheckpointConfirmation(m.provider,edition,id,confirmation(checkpointId)).status,"invalid-confirmation");
    assert.equal(m.writes.length,0);
  }
});
test("unsupported confirmation methods are not accepted as demo attendance",()=>{
  for(const method of ["qr","gps","unknown",null]){
    const m=memory();assert.equal(saveCheckpointConfirmation(m.provider,edition,id,{...confirmation(),method}).status,"invalid-confirmation");
    assert.equal(m.writes.length,0);
  }
});
test("invalid or pre-start timestamps do not produce an achievement",()=>{
  for(const date of ["invalid","2026-02-30T00:00:00.000Z","2026-11-07T23:59:59.999Z",42,null]){
    const m=memory();assert.equal(saveCheckpointConfirmation(m.provider,edition,id,confirmation("C1",date)).status,"invalid-confirmation");
    assert.equal(m.writes.length,0);
  }
});
test("saving before an explicit start does not create a participation",()=>{
  const m=memory(null);assert.deepEqual(saveCheckpointConfirmation(m.provider,edition,id,confirmation()),{status:"empty"});assert.equal(m.writes.length,0);
});
test("corrupt and different-edition records are not overwritten by a confirmation",()=>{
  for(const [raw,status] of [["broken","invalid"],[JSON.stringify({...record,rallyRevision:"old"}),"different-edition"]]){
    const m=memory(raw);assert.equal(saveCheckpointConfirmation(m.provider,edition,id,confirmation()).status,status);
    assert.equal(m.raw(),raw);assert.equal(m.writes.length,0);
  }
});
test("another participation ID cannot inherit a stale screen's achievement",()=>{
  const m=memory(JSON.stringify({...record,participationId:"b06adbe7-5fb2-4f0f-9237-3718f9d6c38e"}));
  assert.deepEqual(saveCheckpointConfirmation(m.provider,edition,id,confirmation()),{status:"different-participation"});assert.equal(m.writes.length,0);
});
test("quota failure preserves the old ledger and a retry can save once",()=>{
  const m=memory(),before=m.raw(),denied=()=>({...m.store,setItem(){throw Error("QuotaExceededError")}});
  assert.equal(saveCheckpointConfirmation(denied,edition,id,confirmation()).status,"unavailable");assert.equal(m.raw(),before);
  assert.equal(saveCheckpointConfirmation(m.provider,edition,id,confirmation()).status,"saved");assert.equal(m.writes.length,1);
});
test("access/getter failure never reports a saved achievement",()=>{
  for(const provider of [()=>{throw Error("SecurityError")},()=>({getItem(){throw Error("read denied")},setItem(){throw Error("must not write")}})]){
    assert.deepEqual(saveCheckpointConfirmation(provider,edition,id,confirmation()),{status:"unavailable"});
  }
});
test("a silently ignored write is not reported as saved",()=>{
  const m=memory(),ignored=()=>({...m.store,setItem(){}});
  assert.equal(saveCheckpointConfirmation(ignored,edition,id,confirmation()).status,"unavailable");
  assert.equal(JSON.parse(m.raw()).achievements.length,0);
});
test("read-back failure can recover the already-written achievement without changing its time",()=>{
  const m=memory();let reads=0;
  const provider=()=>({...m.store,getItem(){if(++reads===2)throw Error("read back failed");return m.raw()}});
  assert.equal(saveCheckpointConfirmation(provider,edition,id,confirmation()).status,"unavailable");
  const retry=saveCheckpointConfirmation(m.provider,edition,id,confirmation("C1","2026-11-08T00:30:00.000Z"));
  assert.equal(retry.status,"saved");assert.equal(retry.added,false);assert.equal(m.writes.length,1);
  assert.equal(retry.participation.achievements[0].recordedAt,later);
});
test("stored achievement validation rejects duplicates, ineligible IDs, dates, methods and extra fields",()=>{
  const bad=[[confirmation(),confirmation()], [{...confirmation(),checkpointId:"W1"}],
    [{...confirmation(),method:"qr"}],[{...confirmation(),recordedAt:"bad"}],
    [{...confirmation(),recordedAt:"2026-11-07T00:00:00.000Z"}],
    [{...confirmation(),extra:true}], [null],{},null];
  for(const achievements of bad)assert.equal(decodeParticipation(JSON.stringify({...record,achievements}),edition).status,"invalid");
});
test("valid progress survives reads and repeated start without resets or writes",()=>{
  const m=memory();saveCheckpointConfirmation(m.provider,edition,id,confirmation("C1"));
  const saved=m.raw(),never={uuid(){throw Error("must not create")},now(){throw Error("must not reset")}};
  assert.equal(readParticipation(m.provider,edition).status,"active");
  const restarted=startParticipation(m.provider,edition,never);
  assert.equal(restarted.status,"active");assert.equal(restarted.participation.achievements.length,1);
  assert.equal(m.raw(),saved);assert.equal(m.writes.length,1);
});
