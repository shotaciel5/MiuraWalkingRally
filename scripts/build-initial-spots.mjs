import assert from "node:assert/strict";
import {createHash} from "node:crypto";
import {readFileSync,writeFileSync} from "node:fs";
import {fileURLToPath} from "node:url";
import {createInitialSpotCatalog} from "../lib/spots/initial-catalog.ts";
import {loadMisakiGraph} from "../lib/misaki.ts";
const directory=fileURLToPath(new URL("../data/spots/",import.meta.url));
const root=fileURLToPath(new URL("../",import.meta.url));
const read=name=>JSON.parse(readFileSync(directory+"/"+name,"utf8"));
const sha=value=>createHash("sha256").update(value).digest("hex");
const snapshot=read("osm.json"),source=read("source.json"),review=read("review.json");
assert.equal(review.schemaVersion,1);assert.equal(snapshot.schemaVersion,1);
assert.equal(sha(readFileSync(directory+"/osm.json")),source.snapshotSha256,"Spot source hash mismatch");
const road=JSON.parse(readFileSync(root+"data/misaki/osm.json","utf8"));
const roadSource=JSON.parse(readFileSync(root+"data/misaki/source.json","utf8"));
assert.equal(sha(readFileSync(root+"data/misaki/osm.json")),roadSource.snapshotSha256,"Road snapshot hash mismatch");
const stops=JSON.parse(readFileSync(root+"data/misaki/stops.json","utf8")),graph=loadMisakiGraph();
for(const anchor of review.anchors){
 const fixture=stops.find(s=>s.id===anchor.fixtureStopId);
 assert.equal(fixture?.nodeId,anchor.nodeId,"Anchor must match reviewed PoC fixture");
 assert.ok(graph.adjacency.get(anchor.nodeId)?.length,"Anchor must be in existing walking graph");
}
const result=createInitialSpotCatalog(snapshot,{roadBounds:road.bounds,anchors:review.anchors,holds:review.holds});
const catalog={schemaVersion:1,sourceSnapshotSha256:source.snapshotSha256,roadSnapshotSha256:roadSource.snapshotSha256,...result};
const content=JSON.stringify(catalog,null,2)+"\n";
if(process.argv.includes("--check")) assert.equal(readFileSync(directory+"/initial-spots.json","utf8"),content,"Initial catalog differs: run npm run spots:build");
else writeFileSync(directory+"/initial-spots.json",content);
console.log(JSON.stringify({...result.summary,followUpWithoutCoordinates:review.followUpCandidates.length,duplicateNameGroups:result.duplicateNames.length,catalogSha256:sha(content)},null,2));
