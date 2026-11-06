import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";
import { createMisakiPoc } from "../lib/misaki.ts";
import { distanceMeters } from "../lib/route/graph.ts";

test("fixed OSM snapshot matches its source checksum", () => {
  const source=JSON.parse(readFileSync(new URL("../data/misaki/source.json",import.meta.url),"utf8"));
  const bytes=readFileSync(new URL("../data/misaki/osm.json",import.meta.url));
  assert.equal(createHash("sha256").update(bytes).digest("hex"),source.snapshotSha256);
  assert.equal(source.license,"ODbL-1.0");
});
test("Misaki fixture visits all provisional anchors through real adjacent road nodes", () => {
  const {graph,route,reference}=createMisakiPoc();
  assert.deepEqual(route.stops.map(s=>s.id),["S","C1","W1","C2","G"]);
  assert.equal(route.legs.length,4);
  assert.ok(route.meters>0);
  for(const [i,leg] of route.legs.entries()){
    assert.equal(leg.nodeIds[0],route.stops[i].nodeId);
    assert.equal(leg.nodeIds.at(-1),route.stops[i+1].nodeId);
    let independentlySummed=0;
    for(const edge of leg.edges){
      const way=graph.ways.get(edge.wayId);
      const adjacent=way.nodes.some((id,index)=>id===edge.from && (way.nodes[index-1]===edge.to || way.nodes[index+1]===edge.to));
      assert.ok(adjacent,"No invented edge");
      independentlySummed+=distanceMeters(graph.nodes.get(edge.from),graph.nodes.get(edge.to));
    }
    assert.ok(Math.abs(independentlySummed-leg.meters)<1e-9);
    assert.ok(leg.meters<=reference[i].meters+1e-9,"A shortest path cannot exceed the feasible manual reference");
  }
  assert.equal(route.stops[0].nodeId,route.stops.at(-1).nodeId);
  assert.ok(route.legs.some(leg=>leg.edges.some(e=>graph.ways.get(e.wayId).tags.highway==="steps")));
  assert.ok(!route.legs.flatMap(l=>l.edges).some(e=>e.wayId===336634884));
});
test("fixture keeps reference disagreement visible instead of changing the baseline", () => {
  const {route,reference}=createMisakiPoc();
  assert.notDeepEqual(route.legs[1].nodeIds,reference[1].nodeIds);
  assert.notDeepEqual(route.legs[3].nodeIds,reference[3].nodeIds);
});


test("provisional facility arrivals are road nodes inside the identified OSM site areas", () => {
  const snapshot=JSON.parse(readFileSync(new URL("../data/misaki/osm.json",import.meta.url),"utf8"));
  const nodes=new Map(snapshot.elements.filter(x=>x.type==="node").map(x=>[x.id,x]));
  const {graph}=createMisakiPoc();
  for(const [nodeId,wayId] of [[2845402200,384676338],[2845402186,394752554],[2845403964,394752558]]){
    const p=nodes.get(nodeId);
    const polygon=snapshot.elements.find(x=>x.type==="way"&&x.id===wayId).nodes.map(id=>nodes.get(id));
    let inside=false;
    for(let i=0,j=polygon.length-1;i<polygon.length;j=i++){
      const a=polygon[i],b=polygon[j];
      if(((a.lat>p.lat)!==(b.lat>p.lat))&&(p.lon<(b.lon-a.lon)*(p.lat-a.lat)/(b.lat-a.lat)+a.lon))inside=!inside;
    }
    assert.ok(inside,"Arrival candidate must belong to the named site area");
    assert.ok(graph.adjacency.has(nodeId),"Arrival candidate must already be a connected road node");
  }
});
