import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import {createHash} from "node:crypto";
import {getParticipantCourse} from "../lib/participant-course.ts";
import {participantFrame} from "../lib/participant-view.ts";
import {createMisakiReviewPoc} from "../lib/misaki-review.ts";
import {getDemoRally} from "../lib/demo-rally.ts";
import {decodeParticipation} from "../lib/participation.ts";

test("every participant card uses the unchanged generated PoC map, context and occurrence binding",()=>{
  const course=getParticipantCourse(),poc=createMisakiReviewPoc();
  assert.equal(course.cards.length,31);
  assert.deepEqual(course.cards,poc.koma.map(({map,context,stops})=>({map,context,stopIds:stops.map(s=>s.id)})));
  assert.ok(course.cards.every(c=>c.map.state==="ready"));
});
test("participant visits preserve the distinct start, waypoint, checkpoints and finish occurrences",()=>{
  const course=getParticipantCourse();
  assert.deepEqual(course.cards.flatMap(c=>c.stopIds.map(id=>({id,sequence:c.map.sequence}))),
    [{id:"S",sequence:1},{id:"C1",sequence:9},{id:"W1",sequence:18},{id:"C2",sequence:20},{id:"G",sequence:31}]);
  assert.equal(course.cards[0].map.nodeId,course.cards.at(-1).map.nodeId);
  assert.notEqual(course.cards[0].map.pathIndex,course.cards.at(-1).map.pathIndex);
  assert.equal(new Set(course.cards.map(c=>c.map.pathIndex)).size,31);
});
test("selecting frames does not mutate the course or turn viewing into achievements",()=>{
  const course=getParticipantCourse(),before=JSON.stringify(course);
  const record={schemaVersion:2,participationId:"a06adbe7-5fb2-4f0f-9237-3718f9d6c38e",
    rallyId:course.rally.id,rallyRevision:course.rally.revision,startedAt:"2026-11-07T06:00:00.000Z",achievements:[]};
  const saved=JSON.stringify(record);
  for(const i of [...course.cards.keys(),...course.cards.keys()].reverse()){
    const frame=participantFrame(course,i);
    assert.equal(frame.card.map.sequence,i+1);
    assert.deepEqual(frame.stops.map(s=>s.id),frame.card.stopIds);
  }
  assert.equal(JSON.stringify(course),before);
  assert.deepEqual(decodeParticipation(saved,course.rally),{status:"active",participation:record});
  assert.deepEqual(Object.keys(record).sort(),["schemaVersion","participationId","rallyId","rallyRevision","startedAt","achievements"].sort());
});
test("invalid viewing indices and missing stop bindings fail instead of selecting another occurrence",()=>{
  const course=getParticipantCourse();
  for(const index of [-1,course.cards.length,0.5,NaN,Infinity])assert.throws(()=>participantFrame(course,index),RangeError);
  const broken={...course,cards:[{...course.cards[0],stopIds:["missing"]}]};
  assert.throws(()=>participantFrame(broken,0),/Unknown participant stop/);
});
test("only the two checkpoint candidates carry the checked local reference photos and roles",()=>{
  const course=getParticipantCourse(),checkpoints=course.stops.filter(s=>s.kind==="checkpoint");
  assert.deepEqual(checkpoints.map(s=>s.id),["C1","C2"]);
  for(const spot of checkpoints){
    const photo=spot.photo;
    assert.ok(photo);assert.equal(photo.spotId,spot.id);
    assert.match(photo.path,/^\/photos\/[a-z-]+\.jpg$/);
    assert.ok(photo.sourceUrl.startsWith("https://commons.wikimedia.org/wiki/File:"));
    assert.ok(photo.creator&&photo.title&&photo.capturedLabel&&photo.changes);
    assert.match(photo.license,/^CC BY(?:-SA)? 4\.0$/);
    const bytes=fs.readFileSync(new URL("../public"+photo.path,import.meta.url));
    assert.equal(bytes.length,photo.bytes);
    assert.equal(bytes.readUInt16BE(0),0xffd8);
    assert.equal(createHash("sha256").update(bytes).digest("hex"),photo.sha256);
  }
  assert.ok(course.stops.filter(s=>s.kind!=="checkpoint").every(s=>s.photo===null));
});
test("the participant edition matches the detail/start model including its licensed photo metadata",()=>{
  const course=getParticipantCourse(),rally=getDemoRally();
  assert.deepEqual(course.rally,{id:rally.id,revision:rally.revision,title:rally.title,href:rally.href,checkpointIds:rally.checkpointIds});
  assert.deepEqual(course.stops,rally.stops);
  assert.equal(getParticipantCourse().rally.revision,course.rally.revision);
});
