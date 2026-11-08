import {readFileSync,writeFileSync} from "node:fs";
import {createHash} from "node:crypto";
import {fileURLToPath} from "node:url";
import {expandedRoutingSnapshot,encodeExpandedSnapshot} from "../lib/expanded-osm.ts";
import {buildWalkingGraph} from "../lib/route/graph.ts";
const dir=fileURLToPath(new URL("../data/miura-expanded/",import.meta.url)),raw=readFileSync(dir+"osm.json"),source=JSON.parse(readFileSync(dir+"source.json","utf8"));
const sha=v=>createHash("sha256").update(v).digest("hex");if(sha(raw)!==source.snapshotSha256)throw Error("Expanded source hash mismatch");
const roads=expandedRoutingSnapshot(JSON.parse(raw)),encoded=encodeExpandedSnapshot(roads),graph=buildWalkingGraph(roads),hash=sha(encoded);
if(process.argv.includes("--check")){
 if(sha(readFileSync(dir+"roads.json"))!==hash||source.roadSnapshotSha256!==hash)throw Error("Expanded road projection differs; run roads:build");
}else{
 writeFileSync(dir+"roads.json",encoded);source.roadSnapshotSha256=hash;source.roadProjection="Highway ways, their nodes and restriction relations derived from the same full snapshot; no changed geometry or walking rules.";
 source.roadCounts={nodes:graph.nodes.size,highways:graph.ways.size,routableNodes:graph.adjacency.size,bytes:Buffer.byteLength(encoded)};writeFileSync(dir+"source.json",JSON.stringify(source,null,2)+"\n");
}
console.log(JSON.stringify({roadSnapshotSha256:hash,nodes:graph.nodes.size,highways:graph.ways.size,routableNodes:graph.adjacency.size,bytes:Buffer.byteLength(encoded)}));
