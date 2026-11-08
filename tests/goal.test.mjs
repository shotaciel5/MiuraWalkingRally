import assert from "node:assert/strict";
import test from "node:test";
import {applyCheckpointConfirmation, applyGoalConfirmation, decodeParticipation, participationKey, readParticipation, saveGoalConfirmation, startParticipation} from "../lib/participation.ts";

const edition={id:"misaki-shitamachi",revision:"demo-v1-current",checkpointIds:["C1","C2"],goalStopId:"G"};
const id="a06adbe7-5fb2-4f0f-9237-3718f9d6c38e";
const startedAt="2026-11-08T00:00:00.000Z";
const achievements=[{checkpointId:"C1",method:"demo-button",recordedAt:"2026-11-08T00:10:00.000Z"},{checkpointId:"C2",method:"demo-button",recordedAt:"2026-11-08T00:20:00.000Z"}];
const record={schemaVersion:3,participationId:id,rallyId:edition.id,rallyRevision:edition.revision,startedAt,achievements,completion:null};
const goal={stopId:"G",method:"demo-button",recordedAt:"2026-11-08T00:30:00.000Z"};
function memory(raw=JSON.stringify(record)){
  let value=raw;const writes=[];
  const store={getItem:()=>value,setItem:(key,next)=>{assert.equal(key,participationKey(edition.id));writes.push(next);value=next}};
  return {provider:()=>store,store,writes,raw:()=>value};
}
test("zero or one achievement cannot finish and never writes",()=>{
  for(const achievements of [[],[record.achievements[0]],[record.achievements[1]]]){
    const m=memory(JSON.stringify({...record,achievements})),before=m.raw();
    const result=saveGoalConfirmation(m.provider,edition,id,goal);
    assert.equal(result.status,"incomplete");assert.ok(result.missingCheckpointIds.length>0);
    assert.equal(m.raw(),before);assert.equal(m.writes.length,0);
  }
});
test("all checkpoints remain unfinished until an explicit goal transition",()=>{
  const m=memory();assert.equal(readParticipation(m.provider,edition).participation.completion,null);
  assert.equal(m.writes.length,0);
  const result=applyGoalConfirmation(record,edition,goal);
  assert.equal(result.status,"finished");assert.equal(result.added,true);
  assert.deepEqual(result.participation.completion,goal);assert.equal(record.completion,null);
  assert.deepEqual(result.participation.achievements,achievements);
});
test("an explicit goal stores its target, method and time while preserving start and progress",()=>{
  const m=memory(),result=saveGoalConfirmation(m.provider,edition,id,goal);
  assert.equal(result.status,"finished");assert.equal(m.writes.length,1);
  const saved=JSON.parse(m.raw());
  assert.equal(saved.participationId,id);assert.equal(saved.startedAt,startedAt);
  assert.deepEqual(saved.achievements,achievements);assert.deepEqual(saved.completion,goal);
});
test("repeated goal calls preserve the first completion without another write",()=>{
  const m=memory();saveGoalConfirmation(m.provider,edition,id,goal);const before=m.raw();
  const result=saveGoalConfirmation(m.provider,edition,id,{...goal,recordedAt:"2026-11-08T00:40:00.000Z"});
  assert.equal(result.status,"finished");assert.equal(result.added,false);
  assert.equal(m.raw(),before);assert.equal(m.writes.length,1);
});
test("start, waypoint, checkpoints and unknown targets cannot be used as the goal",()=>{
  for(const stopId of ["S","W1","C1","C2","missing","",null,7]){
    const m=memory();assert.equal(saveGoalConfirmation(m.provider,edition,id,{...goal,stopId}).status,"invalid-confirmation");
    assert.equal(m.writes.length,0);
  }
});
test("unsupported methods, invalid dates and times before the latest achievement are rejected",()=>{
  for(const candidate of [{...goal,method:"qr"},{...goal,recordedAt:"bad"},
    {...goal,recordedAt:"2026-02-30T00:00:00.000Z"},{...goal,recordedAt:"2026-11-08T00:19:59.999Z"}]){
    const m=memory();assert.equal(saveGoalConfirmation(m.provider,edition,id,candidate).status,"invalid-confirmation");
    assert.equal(m.writes.length,0);
  }
});
test("zero configured checkpoints never grant a vacuous goal",()=>{
  assert.equal(applyGoalConfirmation({...record,achievements:[]},{...edition,checkpointIds:[]},goal).status,"invalid-confirmation");
});
test("missing, corrupt and another edition's sessions cannot be finished or overwritten",()=>{
  for(const[raw,status]of [[null,"empty"],["broken","invalid"],[JSON.stringify({...record,rallyRevision:"other"}),"different-edition"]]){
    const m=memory(raw);assert.equal(saveGoalConfirmation(m.provider,edition,id,goal).status,status);
    assert.equal(m.raw(),raw);assert.equal(m.writes.length,0);
  }
});
test("a stale screen cannot finish a different participation",()=>{
  const m=memory(JSON.stringify({...record,participationId:"b06adbe7-5fb2-4f0f-9237-3718f9d6c38e"}));
  assert.equal(saveGoalConfirmation(m.provider,edition,id,goal).status,"different-participation");assert.equal(m.writes.length,0);
});
test("write failure leaves the goal pending and a retry can finish once",()=>{
  const m=memory(),before=m.raw(),denied=()=>({...m.store,setItem(){throw Error("QuotaExceededError")}});
  assert.equal(saveGoalConfirmation(denied,edition,id,goal).status,"unavailable");assert.equal(m.raw(),before);
  assert.equal(saveGoalConfirmation(m.provider,edition,id,goal).status,"finished");assert.equal(m.writes.length,1);
});
test("getter/read failures and ignored writes never report a finished session",()=>{
  for(const provider of [()=>{throw Error("SecurityError")},()=>({getItem(){throw Error("denied")},setItem(){}}),
    ()=>({getItem:()=>JSON.stringify(record),setItem(){}})]){
    assert.equal(saveGoalConfirmation(provider,edition,id,goal).status,"unavailable");
  }
});
test("read-back failure recovers the stored first completion without duplicating it",()=>{
  const m=memory();let reads=0;
  const provider=()=>({...m.store,getItem(){if(++reads===2)throw Error("read-back");return m.raw()}});
  assert.equal(saveGoalConfirmation(provider,edition,id,goal).status,"unavailable");
  const result=saveGoalConfirmation(m.provider,edition,id,{...goal,recordedAt:"2026-11-08T00:50:00.000Z"});
  assert.equal(result.status,"finished");assert.equal(result.added,false);
  assert.deepEqual(result.participation.completion,goal);assert.equal(m.writes.length,1);
});
test("v2 progress reads without a migration write and finishing upgrades it without losing achievements",()=>{
  const {completion,...legacy}=record;legacy.schemaVersion=2;
  const m=memory(JSON.stringify(legacy)),before=m.raw();
  assert.deepEqual(readParticipation(m.provider,edition),{status:"active",participation:record});
  assert.equal(m.raw(),before);assert.equal(m.writes.length,0);
  assert.equal(saveGoalConfirmation(m.provider,edition,id,goal).status,"finished");
  const saved=JSON.parse(m.raw());assert.equal(saved.schemaVersion,3);
  assert.equal(saved.participationId,id);assert.deepEqual(saved.achievements,achievements);assert.deepEqual(saved.completion,goal);
});
test("v1 start-only data cannot acquire a goal by reading or attempting to finish",()=>{
  const {achievements,completion,...legacy}=record;legacy.schemaVersion=1;
  const m=memory(JSON.stringify(legacy)),before=m.raw();
  assert.equal(readParticipation(m.provider,edition).participation.completion,null);
  assert.equal(saveGoalConfirmation(m.provider,edition,id,goal).status,"incomplete");
  assert.equal(m.raw(),before);assert.equal(m.writes.length,0);
});
test("stored completions require every checkpoint, the correct goal, exact fields and a valid time",()=>{
  const invalid=[{...record,achievements:[],completion:goal},
    {...record,completion:{...goal,stopId:"S"}},{...record,completion:{...goal,method:"qr"}},
    {...record,completion:{...goal,recordedAt:"bad"}},{...record,completion:{...goal,recordedAt:startedAt}},
    {...record,completion:{...goal,extra:true}},{...record,completion:{}},{...record,completion:[]},
    {...record,completion:true}];
  for(const data of invalid)assert.equal(decodeParticipation(JSON.stringify(data),edition).status,"invalid");
});
test("legacy schemas cannot smuggle a completion field into the new record",()=>{
  const {completion,...v2}=record;v2.schemaVersion=2;
  assert.equal(decodeParticipation(JSON.stringify({...v2,completion:goal}),edition).status,"invalid");
  const {achievements,...v1}=v2;v1.schemaVersion=1;
  assert.equal(decodeParticipation(JSON.stringify({...v1,completion:goal}),edition).status,"invalid");
});
test("finished sessions survive read/restart and checkpoint retries without resetting completion",()=>{
  const m=memory();const finished=saveGoalConfirmation(m.provider,edition,id,goal).participation,before=m.raw();
  assert.deepEqual(readParticipation(m.provider,edition),{status:"active",participation:finished});
  const never={uuid(){throw Error("must not replace identity")},now(){throw Error("must not reset time")}};
  assert.deepEqual(startParticipation(m.provider,edition,never),{status:"active",participation:finished});
  const duplicate=applyCheckpointConfirmation(finished,edition,{...achievements[0],recordedAt:"2026-11-08T00:45:00.000Z"});
  assert.equal(duplicate.added,false);assert.deepEqual(duplicate.participation,finished);
  assert.equal(m.raw(),before);assert.equal(m.writes.length,1);
});
test("checkpoint order does not change the all-checkpoint goal condition",()=>{
  const result=applyGoalConfirmation({...record,achievements:[...achievements].reverse()},edition,goal);
  assert.equal(result.status,"finished");assert.deepEqual(result.participation.completion,goal);
});
