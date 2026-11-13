import test from "node:test";
import assert from "node:assert/strict";
import data from "../data/spots/initial-spots.json" with {type:"json"};
import {getBrowserSpots} from "../lib/spots/browser-catalog.ts";
import {SPOT_CATEGORIES} from "../lib/spots/initial-catalog.ts";
import {decodeBrowserSpots,DEFAULT_FILTERS,SPOT_GROUPS,filterSpots,groupFor,visibleSelection} from "../lib/spots/browser-view.ts";
const spots=getBrowserSpots(),clone=v=>structuredClone(v);
test("the browser model preserves every admitted source identity, coordinate and review state",()=>{
 assert.equal(spots.length,178);
 for(const spot of spots)assert.deepEqual(spot,data.spots.find(s=>s.id===spot.id));
 assert.equal(new Set(spots.map(s=>s.id)).size,178);
 assert.equal(spots.filter(s=>s.routing.state==="poc-reference").length,3);
 assert.equal(spots.filter(s=>s.routing.state==="outside-road-snapshot").length,92);
});
test("filters display the supplied operational catalog without a demo mode",()=>{
 assert.equal(Object.hasOwn(DEFAULT_FILTERS,"mode"),false);const before=JSON.stringify(spots);assert.equal(filterSpots(spots,DEFAULT_FILTERS).length,178);assert.equal(JSON.stringify(spots),before);
});

test("every source category belongs to exactly one visible group",()=>{
 for(const category of Object.keys(SPOT_CATEGORIES)){
  const groups=Object.entries(SPOT_GROUPS).filter(([,g])=>g.categories.includes(category));
  assert.equal(groups.length,1);assert.equal(groupFor(category),groups[0][0]);
 }
});
test("genre, region and text filters compose and do not change unverified routing states",()=>{
 const filtered=filterSpots(spots,{group:"cafe",area:"misaki-vicinity",query:"ミサキプレッソ"});
 assert.equal(filtered.length,1);assert.equal(filtered[0].name,"ミサキプレッソ");
 assert.deepEqual(filtered[0],spots.find(s=>s.id===filtered[0].id));
 assert.equal(filterSpots(spots,{group:"cafe",area:"jogashima-vicinity",query:""}).length,0);
 assert.equal(filterSpots(spots,{...DEFAULT_FILTERS,group:"shopping",query:"風致亭"}).length,1);
});
test("search normalizes width, case and whitespace without changing original display names",()=>{
 const base={...spots[0],name:"Ｃａｆｅ A"};
 const result=filterSpots([base],{group:"all",area:"all",query:" cafe　a "});
 assert.equal(result.length,1);assert.equal(result[0].name,"Ｃａｆｅ A");
 assert.equal(filterSpots(spots,{...DEFAULT_FILTERS,query:"存在しない候補"}).length,0);
});
test("a hidden selection is absent rather than selecting a different spot or retaining stale details",()=>{
 const filtered=filterSpots(spots,{...DEFAULT_FILTERS,group:"shopping"});
 assert.equal(visibleSelection(filtered,"osm-way-384676338"),null);
 assert.equal(visibleSelection(spots,"missing"),null);assert.equal(visibleSelection(spots,null),null);
 const valid=visibleSelection(filtered,"osm-node-3988005814");assert.equal(valid.name,"風致亭");
});
test("duplicate names keep separate selectable identities and coordinates",()=>{
 const shrines=filterSpots(spots,{group:"all",area:"all",query:"海南神社"});
 assert.ok(shrines.length>=2);
 const a=shrines.find(s=>s.id==="osm-way-384676338"),b=shrines.find(s=>s.id==="osm-way-395998657");
 assert.notDeepEqual(a.position,b.position);assert.notEqual(a.id,b.id);
});
test("invalid schemas and malformed spot data fail as a whole instead of silently dropping entries",()=>{
 for(const value of [null,{}, {...data,schemaVersion:2},{...data,spots:null}])assert.equal(decodeBrowserSpots(value),null);
 for(const change of [
 s=>{s.id="S"},s=>{s.name=""},s=>{s.category="toString"},s=>{s.area="unknown"},
 s=>{s.position.lat=NaN},s=>{s.position.lon=0},s=>{s.position.kind="entrance"},
 s=>{s.source.url="javascript:alert(1)"},s=>{s.source.type=["node"]},
 s=>{s.reviewStatus="verified"},s=>{s.routing={state:"ready"}},
 s=>{s.routing={state:"poc-reference",nodeId:-1}}
 ]){
  const value=clone(data);change(value.spots[0]);assert.equal(decodeBrowserSpots(value),null);
 }
 const duplicate=clone(data);duplicate.spots.push(duplicate.spots[0]);assert.equal(decodeBrowserSpots(duplicate),null);
});
test("source labels remain text and do not become HTML or invented entrances",()=>{
 const value=clone(data);value.spots[0].name='<img src=x onerror=alert(1)>';
 const decoded=decodeBrowserSpots(value);assert.equal(decoded[0].name,value.spots[0].name);
 assert.equal(decoded[0].position.kind,value.spots[0].position.kind);
 assert.equal(decoded[0].routing.state,value.spots[0].routing.state);
});
