import assert from "node:assert/strict";
import {createHash} from "node:crypto";
import {readFileSync} from "node:fs";
import test from "node:test";
import {INITIAL_SPOT_BOUNDS,SPOT_CATEGORIES,categoryFor,createInitialSpotCatalog,initialSpotQuery,normalizeSpotSnapshot,spotId} from "../lib/spots/initial-catalog.ts";
import {loadMisakiGraph} from "../lib/misaki.ts";
const bounds={south:35.125,west:139.608,north:35.157,east:139.638};
const roadBounds={south:35.137,west:139.614,north:35.147,east:139.627};
const raw=(id=1,tags={name:"Cafe A",amenity:"cafe"},position={lat:35.141,lon:139.62})=>({type:"node",id,...position,tags});
const snapshot=elements=>normalizeSpotSnapshot({elements},bounds);
const create=(elements,extra={})=>createInitialSpotCatalog(snapshot(elements),{roadBounds,anchors:[],holds:[],...extra});
const read=name=>JSON.parse(readFileSync(new URL("../data/spots/"+name,import.meta.url),"utf8"));
const sha=value=>createHash("sha256").update(value).digest("hex");

test("normalization retains landmark coordinates and whitelisted tags without editor/contact metadata",()=>{
 const input={elements:[{...raw(),user:"private editor",uid:123,tags:{...raw().tags,phone:"secret",email:"secret","addr:full":"secret",opening_hours:"24/7"}},
 {type:"way",id:7,center:{lat:35.14,lon:139.62},nodes:[1,2,3],tags:{name:"Market",shop:"seafood"}}]};
 const normalized=normalizeSpotSnapshot(input);
 assert.deepEqual(normalized.elements[0],{type:"node",id:1,lat:35.141,lon:139.62,positionKind:"node",tags:{name:"Cafe A",amenity:"cafe"}});
 assert.equal(normalized.elements[1].positionKind,"bounding-box-center");
 const encoded=JSON.stringify(normalized);for(const key of ["private editor","phone","email","addr:full","opening_hours","nodes"])assert.ok(!encoded.includes(key));
 assert.equal(input.elements[0].tags.phone,"secret");
});
test("normalization is deterministic and deduplicates only identical OSM identities",()=>{
 const a=raw(2),b=raw(1),sameTypeDifferent={...raw(1),type:"way",center:{lat:35.141,lon:139.62}};
 assert.deepEqual(snapshot([a,b,b]),snapshot([b,a]));
 assert.equal(snapshot([b,sameTypeDifferent]).elements.length,2);
 assert.notEqual(spotId(snapshot([b,sameTypeDifferent]).elements[0]),spotId(snapshot([b,sameTypeDifferent]).elements[1]));
 assert.throws(()=>snapshot([b,{...b,lat:35.142}]),/Conflicting/);
});
test("partial responses, invalid identities/coordinates and missing area centres fail without inventing positions",()=>{
 for(const payload of [null,{}, {elements:[],remark:"timeout"}, {elements:[{...raw(),type:["node"]}]},
 {elements:[{...raw(),id:0}]}, {elements:[{...raw(),id:1.1}]}, {elements:[{...raw(),lat:NaN}]},
 {elements:[{...raw(),lat:91}]}, {elements:[{...raw(),lon:"139.62"}]},
 {elements:[{type:"way",id:2,tags:{name:"A"}}]}, {elements:[{...raw(),tags:[]}]}
 ])assert.throws(()=>normalizeSpotSnapshot(payload));
});
test("the explicit acquisition query stays bounded and invalid boundaries cannot become a broad request",()=>{
 const query=initialSpotQuery();assert.ok(query.includes("35.125,139.608,35.157,139.638"));assert.ok(query.includes("out center"));
 assert.ok(query.includes('"shop"'));assert.ok(query.includes('"natural"'));assert.ok(!query.includes(">;"));
 assert.deepEqual(INITIAL_SPOT_BOUNDS,bounds);
 for(const value of [{...bounds,south:36},{...bounds,east:200},{...bounds,north:Infinity}])assert.throws(()=>initialSpotQuery(value));
});
test("classification covers food, shopping, souvenirs, scenery and ordinary local places as well as shrines",()=>{
 for(const [tags,expected]of [
 [{amenity:"cafe"},"cafe"],[{amenity:"restaurant"},"food"],[{amenity:"marketplace"},"market"],
 [{shop:"seafood"},"market"],[{shop:"greengrocer"},"market"],[{shop:"bakery"},"sweets"],[{shop:"gift"},"souvenir"],
 [{shop:"antiques"},"shopping"],[{shop:"convenience"},"shopping"],[{tourism:"viewpoint"},"scenery"],
 [{natural:"beach"},"scenery"],[{leisure:"park"},"park"],[{historic:"memorial"},"history"],
 [{amenity:"place_of_worship"},"religious"],[{historic:"wayside_shrine"},"religious"],
 [{man_made:"lighthouse"},"attraction"],[{leisure:"fishing"},"activity"],[{tourism:"hotel"},"stay"]
 ])assert.equal(categoryFor(tags),expected);
 for(const tags of [{amenity:"school"},{amenity:"hospital"},{tourism:"information",information:"guidepost"},{shop:"vacant"}])assert.equal(categoryFor(tags),null);
});
test("names use the Japanese label when available and nameless entries never become spots",()=>{
 const result=create([raw(1,{"name:ja":"  Local Japanese Name ",name:"English",amenity:"cafe"}),raw(2,{amenity:"cafe"}),raw(3,{name:"  ",amenity:"cafe"})]);
 assert.equal(result.spots[0].name,"Local Japanese Name");assert.equal(result.excluded.length,2);
 assert.ok(result.excluded.every(s=>s.reason==="missing-name"));
});
test("source centres outside the collection extent are excluded instead of pretending to be local",()=>{
 const result=create([raw(1),raw(2,{name:"Distant area",natural:"bay"},{lat:34,lon:139.62})]);
 assert.equal(result.spots.length,1);assert.equal(result.excluded[0].reason,"representative-point-outside-collection");
});
test("inactive and restricted-access records do not silently become visitable candidates",()=>{
 const result=create([raw(1,{name:"Closed",shop:"gift",disused:"yes"}),raw(2,{name:"Private",amenity:"cafe",access:"private"}),
 raw(3,{name:"Old",amenity:"cafe","disused:amenity":"cafe"}),raw(4,{name:"Open label",amenity:"cafe",disused:"no"})]);
 assert.equal(result.spots.length,1);assert.equal(result.spots[0].id,"osm-node-4");
 assert.equal(result.excluded.length,2);assert.equal(result.held[0].reason,"restricted-access");
});
test("area centres and nearby roads do not create entrances or automatic walking connections",()=>{
 const result=create([raw(1),raw(2,{name:"Island",amenity:"cafe"},{lat:35.135,lon:139.62}),
 raw(3,{name:"Reviewed fixture",amenity:"cafe"})],{anchors:[{spotId:"osm-node-3",nodeId:99}]});
 assert.deepEqual(result.spots[0].routing,{state:"entrance-unverified"});
 assert.deepEqual(result.spots[1].routing,{state:"outside-road-snapshot"});
 assert.deepEqual(result.spots[2].routing,{state:"poc-reference",nodeId:99});
 assert.ok(result.spots.every(s=>s.reviewStatus==="unverified"));
});
test("manual holds preserve their reasons and invalid/stale curation references fail",()=>{
 const result=create([raw()],{holds:[{spotId:"osm-node-1",reason:"Check the current name"}]});
 assert.equal(result.spots.length,0);assert.equal(result.held[0].reason,"Check the current name");
 for(const extra of [{holds:[{spotId:"osm-node-2",reason:"A"}]},{anchors:[{spotId:"osm-node-2",nodeId:3}]},
 {anchors:[{spotId:"osm-node-1",nodeId:-1}]},{anchors:[{spotId:"osm-node-1",nodeId:3}],holds:[{spotId:"osm-node-1",reason:"A"}]}])assert.throws(()=>create([raw()],extra));
});
test("same names and close locations remain separate source identities for review",()=>{
 const result=create([raw(1,{name:"Cafe A",amenity:"cafe"}),raw(2,{name:"Cafe A",amenity:"cafe"},{lat:35.14101,lon:139.62})]);
 assert.equal(result.spots.length,2);assert.equal(result.duplicateNames.length,1);
 assert.deepEqual(result.duplicateNames[0].ids,["osm-node-1","osm-node-2"]);
});
test("fixed input and generated catalog have matching provenance, accounting and broad categories",()=>{
 const source=read("source.json"),fixed=read("osm.json"),catalog=read("initial-spots.json");
 assert.equal(sha(readFileSync(new URL("../data/spots/osm.json",import.meta.url))),source.snapshotSha256);
 assert.equal(source.license,"ODbL-1.0");assert.equal(source.query,initialSpotQuery());
 assert.equal(catalog.sourceSnapshotSha256,source.snapshotSha256);
 assert.equal(fixed.elements.length,catalog.summary.source);assert.equal(catalog.spots.length,catalog.summary.admitted);
 assert.equal(catalog.spots.length+catalog.held.length+catalog.excluded.length,fixed.elements.length);
 assert.equal(new Set([...catalog.spots,...catalog.held,...catalog.excluded].map(s=>s.id)).size,fixed.elements.length);
 assert.ok(catalog.spots.length>100);
 for(const category of ["market","cafe","food","sweets","souvenir","shopping","scenery","park","religious","history"])assert.ok(catalog.spots.some(s=>s.category===category));
 assert.ok(catalog.spots.every(s=>s.category in SPOT_CATEGORIES && s.reviewStatus==="unverified"));
 assert.ok(fixed.elements.every(e=>!Object.keys(e.tags).some(k=>/^(contact:|addr:|phone|email|user|uid)/.test(k))));
});
test("offline rebuilding reproduces the committed catalog and uses only the three existing reviewed fixture anchors",()=>{
 const source=read("source.json"),fixed=read("osm.json"),review=read("review.json"),catalog=read("initial-spots.json");
 const road=JSON.parse(readFileSync(new URL("../data/misaki/osm.json",import.meta.url),"utf8"));
 const stops=JSON.parse(readFileSync(new URL("../data/misaki/stops.json",import.meta.url),"utf8")),graph=loadMisakiGraph();
 const result=createInitialSpotCatalog(fixed,{roadBounds:road.bounds,anchors:review.anchors,holds:review.holds});
 assert.deepEqual(catalog,{schemaVersion:1,sourceSnapshotSha256:source.snapshotSha256,roadSnapshotSha256:sha(readFileSync(new URL("../data/misaki/osm.json",import.meta.url))),...result});
 assert.equal(result.spots.filter(s=>s.routing.state==="poc-reference").length,3);
 for(const anchor of review.anchors){
  assert.equal(stops.find(s=>s.id===anchor.fixtureStopId).nodeId,anchor.nodeId);
  assert.ok(graph.adjacency.get(anchor.nodeId)?.length);
 }
 const twoShrines=result.spots.filter(s=>s.name==="海南神社");assert.equal(twoShrines.length,2);assert.notEqual(twoShrines[0].id,twoShrines[1].id);
});
test("officially listed follow-up candidates without verified coordinates stay outside the seed and never receive invented locations",()=>{
 const review=read("review.json"),catalog=read("initial-spots.json");
 assert.ok(review.followUpCandidates.length>=3);
 for(const candidate of review.followUpCandidates){
  assert.equal(candidate.position,null);assert.match(candidate.sourceUrl,/^https:\/\//);assert.ok(candidate.reason);
  assert.ok(!catalog.spots.some(s=>s.id===candidate.id));
 }
 const outdated=review.holds.find(s=>s.spotId==="osm-node-4200247030");assert.ok(outdated.evidenceUrl);
 assert.ok(!catalog.spots.some(s=>s.id===outdated.spotId));
});
