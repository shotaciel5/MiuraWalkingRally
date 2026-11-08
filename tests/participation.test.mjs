import assert from "node:assert/strict";
import test from "node:test";
import {decodeParticipation, participationKey, readParticipation, startParticipation} from "../lib/participation.ts";

const edition = {id:"misaki-shitamachi", revision:"demo-v1-current",checkpointIds:["C1","C2"]};
const id = "a06adbe7-5fb2-4f0f-9237-3718f9d6c38e";
const startedAt = "2026-11-07T06:00:00.000Z";
const record = {schemaVersion:2, participationId:id, rallyId:edition.id, rallyRevision:edition.revision, startedAt, achievements:[]};
function memory(initial = null) {
  const values = new Map(initial === null ? [] : [[participationKey(edition.id),initial]]);
  const writes = [];
  const store = {getItem:key=>values.get(key)??null,setItem:(key,value)=>{writes.push({key,value});values.set(key,value)}};
  return {values,writes,store,provider:()=>store};
}
const source = () => ({uuid:()=>id,now:()=>startedAt});

test("viewing an empty session does not create a participation",()=>{
  const m=memory();assert.deepEqual(readParticipation(m.provider,edition),{status:"empty"});
  assert.equal(m.writes.length,0);
});
test("an explicit start saves only anonymous identity, time and the selected rally edition",()=>{
  const m=memory(),result=startParticipation(m.provider,edition,source());
  assert.deepEqual(result,{status:"active",participation:record});assert.equal(m.writes.length,1);
  assert.equal(m.writes[0].key,participationKey(edition.id));
  assert.deepEqual(JSON.parse(m.writes[0].value),record);
});
test("a valid start is restored by a new read without changing its ID or start time",()=>{
  const m=memory();startParticipation(m.provider,edition,source());
  assert.deepEqual(readParticipation(m.provider,edition),{status:"active",participation:record});
  assert.equal(m.writes.length,1);
});
test("repeated start operations reuse the persisted record without generating another identity",()=>{
  const m=memory();startParticipation(m.provider,edition,source());
  const never={uuid:()=>{throw Error("must not create a second ID")},now:()=>{throw Error("must not reset time")}};
  assert.deepEqual(startParticipation(m.provider,edition,never),{status:"active",participation:record});
  assert.equal(m.writes.length,1);
});
test("the click reads current storage even when an earlier view saw an empty session",()=>{
  const m=memory();assert.equal(readParticipation(m.provider,edition).status,"empty");
  m.values.set(participationKey(edition.id),JSON.stringify(record));
  assert.deepEqual(startParticipation(m.provider,edition,source()),{status:"active",participation:record});
  assert.equal(m.writes.length,0);
});
test("malformed, incomplete and extended records never restore an active participation",()=>{
  const cases=["","broken","null","[]","{}",JSON.stringify({...record,schemaVersion:3}),
    JSON.stringify({...record,participationId:"not-a-uuid"}),JSON.stringify({...record,startedAt:"not-a-date"}),
    JSON.stringify({...record,startedAt:"2026-02-30T00:00:00.000Z"}),
    JSON.stringify({...record,startedAt:123}),JSON.stringify({...record,rallyId:""}),
    JSON.stringify({...record,achievedCheckpointIds:["C1","C2"]})];
  for(const raw of cases)assert.deepEqual(decodeParticipation(raw,edition),{status:"invalid"},raw);
});
test("another rally or edition is detected without deleting or silently replacing its record",()=>{
  for(const previous of [{...record,rallyId:"another"},{...record,rallyRevision:"old-version"}]){
    const raw=JSON.stringify(previous),m=memory(raw);
    assert.deepEqual(readParticipation(m.provider,edition),{status:"different-edition"});
    assert.deepEqual(startParticipation(m.provider,edition,source()),{status:"different-edition"});
    assert.equal(m.writes.length,0);assert.equal(m.store.getItem(participationKey(edition.id)),raw);
  }
});
test("an invalid record is retained until an explicit new-demo action",()=>{
  const m=memory("broken");
  assert.deepEqual(startParticipation(m.provider,edition,source()),{status:"invalid"});
  assert.equal(m.writes.length,0);
  assert.deepEqual(startParticipation(m.provider,edition,source(),true),{status:"active",participation:record});
});
test("an explicit new-demo action binds the replacement to the current edition",()=>{
  const m=memory(JSON.stringify({...record,rallyRevision:"old-version"}));
  assert.deepEqual(startParticipation(m.provider,edition,source(),true),{status:"active",participation:record});
  assert.equal(m.writes.length,1);
});
test("storage getter and read access failures do not create or report an active record",()=>{
  for(const provider of [()=>{throw Error("SecurityError")},()=>({getItem(){throw Error("read denied")},setItem(){throw Error("must not write")}})]){
    assert.deepEqual(readParticipation(provider,edition),{status:"unavailable"});
    assert.deepEqual(startParticipation(provider,edition,source()),{status:"unavailable"});
  }
});
test("quota/write failures leave the session empty and allow a later successful retry",()=>{
  const m=memory(),denied=()=>({...m.store,setItem(){throw Error("QuotaExceededError")}});
  assert.deepEqual(startParticipation(denied,edition,source()),{status:"unavailable"});
  assert.equal(m.store.getItem(participationKey(edition.id)),null);
  assert.deepEqual(startParticipation(m.provider,edition,source()),{status:"active",participation:record});
});
test("a silently ignored write does not report success",()=>{
  const provider=()=>({getItem:()=>null,setItem(){}});
  assert.deepEqual(startParticipation(provider,edition,source()),{status:"unavailable"});
});
test("a read-back failure after writing is recoverable without inventing a second start",()=>{
  const m=memory();let reads=0;
  const provider=()=>({...m.store,getItem(key){if(++reads===2)throw Error("read back denied");return m.store.getItem(key)}});
  assert.deepEqual(startParticipation(provider,edition,source()),{status:"unavailable"});
  assert.deepEqual(startParticipation(m.provider,edition,source()),{status:"active",participation:record});
  assert.equal(m.writes.length,1);
});
test("unavailable or invalid ID/time sources cannot save a partial participation",()=>{
  for(const factory of [{uuid(){throw Error("randomUUID unavailable")},now:()=>startedAt},
    {uuid:()=>id,now(){throw Error("clock unavailable")}},
    {uuid:()=>"bad",now:()=>startedAt},{uuid:()=>id,now:()=>"bad"}]){
    const m=memory();assert.deepEqual(startParticipation(m.provider,edition,factory),{status:"unavailable"});
    assert.equal(m.writes.length,0);
  }
});
test("different rally keys do not read another rally's session",()=>{
  const m=memory(JSON.stringify(record));
  assert.equal(readParticipation(m.provider,{id:"another-rally",revision:edition.revision}).status,"empty");
  assert.equal(m.writes.length,0);
});
