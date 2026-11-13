import {decodeCorrectionContext,CORRECTION_SOURCE} from "../lib/operator/rally-corrections.ts";
import {decodeRoadConnection,connectionMatchesSpot} from "../lib/route/road-connection.ts";
import {decodeDraftContext} from "../lib/operator/rally-draft.ts";
import {decodeManagedSpot} from "../lib/spots/editing.ts";
import {filterSpots,DEFAULT_FILTERS,ROUTING_LABELS} from "../lib/spots/browser-view.ts";
import assert from "node:assert/strict";
import {createHash} from "node:crypto";
import test from "node:test";

const baseUrl = new URL(
  process.env.SMOKE_BASE_URL ?? "http://127.0.0.1:3000",
);

if (
  baseUrl.protocol !== "http:" ||
  !["127.0.0.1", "localhost", "[::1]"].includes(baseUrl.hostname)
) {
  throw new Error("SMOKE_BASE_URL must point to a local HTTP server.");
}

async function get(path) {
  try {
    return await fetch(new URL(path, baseUrl), {
      signal: AbortSignal.timeout(30_000),
    });
  } catch (cause) {
    throw new Error(
      "Start the local app with npm run dev (or npm start after building) before npm run test:smoke.",
      { cause },
    );
  }
}

test("welcome experience HTTP smoke check",async t=>{
 const response=await get("/"),html=await response.text();
 await t.test("serves a Japanese introduction with one main landmark and viewport",()=>{
  assert.equal(response.status,200);assert.match(response.headers.get("content-type")??"",/text\/html/i);
  assert.match(html,/<html\b[^>]*lang="ja"/);assert.equal([...html.matchAll(/<main(?:\s|>)/g)].length,1);
  assert.match(html,/name="viewport"/);assert.match(html,/data-home-page/);assert.doesNotMatch(html,/data-published-catalog/);
 });
 await t.test("serves the local stylesheet",async()=>{
  const href=[...html.matchAll(/<link\b[^>]*>/g)].map(m=>m[0]).find(s=>s.includes('rel="stylesheet"'))?.match(/href="([^"]+)"/)?.[1];
  assert.ok(href);const url=new URL(href.replaceAll("&amp;","&"),baseUrl);assert.equal(url.origin,baseUrl.origin);
  const r=await get(url.pathname+url.search);assert.equal(r.status,200);assert.match(r.headers.get("content-type")??"",/text\/css/);assert.ok((await r.text()).length);
 });
 await t.test("explains play and offers both real role entrances without PoC tabs",()=>{
  assert.match(html,/id="how-it-works"/);assert.match(html,/data-home-participant/);assert.match(html,/data-home-operator/);
  assert.match(html,/href="\/courses"/);assert.match(html,/href="\/operator"/);assert.doesNotMatch(html,/href="\/poc"|class="view-switch"/);
  assert.match(html,/スマホのカメラ/);assert.match(html,/ゴールで写真/);assert.doesNotMatch(html,/data-published-start-link=/);
 });
 await t.test("renders a real generated sample with source attribution",async()=>{
  const {createHomeDemo}=await import("../lib/home-demo.ts"),card=createHomeDemo().introduction;
  assert.ok(card);assert.match(html,/data-home-playing-photo/);assert.match(html,/data-koma-node="2159253432"/);assert.match(html,/data-home-koma/);assert.match(html,/コマ地図の表示例/);
  const figure=html.match(/<figure class="home-koma"[\s\S]*?<\/figure>/)?.[0];assert.ok(figure);assert.deepEqual([...figure.matchAll(/data-koma-branch="(\d+)"/g)].map(m=>Number(m[1])),card.map.branches.map(b=>b.neighborNodeId));
  assert.match(html,/OpenStreetMap contributors/);assert.match(html,/ODbL/);
 });
 await t.test("serves an independent three-frame demo and the operator generation story",()=>{
  assert.match(html,/data-home-demo/);assert.match(html,/class="home-demo walk-player"[^>]*data-walk-design="tsunosuke"/);assert.match(html,/class="tsuna-map-pennant"/);for(const control of ["play","prev","next"])assert.ok(html.includes("data-demo-"+control));
  assert.equal([...html.matchAll(/data-demo-dot=/g)].length,3);assert.equal([...html.matchAll(/data-demo-slide="current"/g)].length,1);
  assert.match(html,/data-home-creation/);assert.match(html,/data-home-route/);assert.match(html,/青い矢印/);assert.doesNotMatch(html,/緑の矢印/);
 });
 await t.test("serves the supplied photographs unchanged",async()=>{
  const {readFileSync}=await import("node:fs");
  for(const file of ["hantoupic.jpg","shitamati.jpg","kainanshrine.jpg","walking-together.png"]){
   const r=await get("/mainphotos/"+file),bytes=Buffer.from(await r.arrayBuffer()),source=readFileSync(new URL("../public/mainphotos/"+file,import.meta.url));
   assert.equal(r.status,200);assert.match(r.headers.get("content-type")??"",/image\/(jpeg|png)/);assert.equal(createHash("sha256").update(bytes).digest("hex"),createHash("sha256").update(source).digest("hex"));
  }
 });
 await t.test("offers a usable operator workspace entrance",async()=>{
  const r=await get("/operator"),body=await r.text();assert.equal(r.status,200);assert.match(body,/data-operator-page="home"/);
  for(const route of ["spots","draft","courses"])assert.ok(body.includes('href="/operator/'+route+'"'));
  assert.doesNotMatch(body,/href="\/poc"|href="\/operator\/landmarks|class="view-switch"|PoC/);
 });
 await t.test("redirects the retired PoC to the operator entrance",async()=>{
  const r=await fetch(new URL("/poc",baseUrl),{redirect:"manual"});assert.equal(r.status,307);assert.equal(r.headers.get("location"),"/operator");await r.arrayBuffer();
 });
 await t.test("returns 404 for an unknown route",async()=>{
  const r=await get("/__smoke_missing_route__");assert.equal(r.status,404);await r.arrayBuffer();
 });
});

test("retired demo and PoC URLs lead to current workflows",async()=>{
 for(const [route,destination]of [["/rallies/misaki-shitamachi","/courses"],["/rallies/misaki-shitamachi/play","/courses"],["/operator/landmarks","/operator/preview"],["/operator/landmarks/review","/operator/preview"]]){
  const r=await fetch(new URL(route,baseUrl),{redirect:"manual"});assert.equal(r.status,307);assert.equal(r.headers.get("location"),destination);await r.arrayBuffer();
 }
 const html=await(await get("/courses")).text();assert.match(html,/data-published-course-count=/);assert.doesNotMatch(html,/data-fixed-demo-link|data-demo-start/);
});

test("operator spot catalog HTTP smoke check",async t=>{
 const apiResponse=await get("/api/operator/spots"),catalog=await apiResponse.json();
 assert.equal(apiResponse.status,200);assert.equal(apiResponse.headers.get("cache-control"),"no-store");
 assert.ok(Array.isArray(catalog.spots));
 const spots=catalog.spots.map(decodeManagedSpot);assert.ok(spots.every(Boolean));
 assert.equal(new Set(spots.map(s=>s.id)).size,spots.length);
 const visible=filterSpots(spots,DEFAULT_FILTERS);
 const response=await get("/operator/spots"),html=await response.text();
 await t.test("serves the curated catalog without demo/all display modes",()=>{
  assert.equal(response.status,200);assert.match(html,/data-operator-page="spots"/);assert.match(html,/data-spot-browser/);
  assert.ok(html.includes('data-visible-count="'+visible.length+'"'));
  assert.equal([...html.matchAll(/data-spot-list-id="/g)].length,visible.length);
  const displayed=[...html.matchAll(/data-spot-list-id="([^"]+)"/g)].map(m=>m[1]);assert.deepEqual(displayed,visible.map(s=>s.id));
  assert.doesNotMatch(html,/data-spot-mode=|デモ表示/);
 });
 await t.test("shows current review states, attribution and management without route creation",()=>{
  for(const state of new Set(visible.map(s=>s.routing.state)))assert.ok(html.includes(ROUTING_LABELS[state]));
  assert.match(html,/OpenStreetMap contributors/);assert.match(html,/ODbL 1.0/);
  assert.match(html,/コースへの追加は「ラリー下書き」で行います/);assert.match(html,/data-spot-add/);assert.doesNotMatch(html,/data-demo-start/);
  assert.match(html,/name="robots"[^>]*noindex/);
 });
 await t.test("keeps a clear operator navigation and a participant link",()=>{
  const active=[...html.matchAll(/<a\b[^>]*>/g)].map(m=>m[0]).find(tag=>tag.includes('href="/operator/spots"'));
  assert.ok(active?.includes('aria-current="page"'));assert.match(html,/href="\/courses"/);assert.match(html,/href="\/"/);assert.doesNotMatch(html,/href="\/poc"/);
 });
 await t.test("returns 404 for an unknown operator page",async()=>{
  const missing=await get("/operator/__missing__");assert.equal(missing.status,404);await missing.arrayBuffer();
 });
});

test("operator rally draft HTTP smoke check",async t=>{
 const response=await get("/operator/draft"),html=await response.text(),api=await get("/api/operator/draft"),state=await api.json();
 await t.test("loads a single draft with active catalog data and no-store",()=>{
  assert.equal(api.status,200);assert.equal(api.headers.get("cache-control"),"no-store");assert.ok(decodeDraftContext(state));
  assert.equal(response.status,200);assert.match(html,/data-operator-page="draft"/);assert.match(html,/data-draft-builder/);
  assert.ok(html.includes('data-draft-revision="'+(state.draft?.revision??0)+'"'));
 });
 await t.test("provides selection and save controls and an explicit preview action",()=>{
  assert.match(html,/data-draft-title/);assert.match(html,/data-draft-slot="start"/);assert.match(html,/data-draft-slot="finish"/);
  assert.match(html,/data-draft-save/);assert.match(html,/data-draft-refresh/);assert.match(html,/data-preview-generate/);assert.doesNotMatch(html,/data-demo-start|data-koma-count/);
 });
 await t.test("links the spot catalog and draft work area",()=>{
  assert.match(html,/href="\/operator\/spots"/);assert.match(html,/href="\/operator\/draft"/);
  assert.match(html,/OpenStreetMap contributors/);assert.match(html,/ODbL 1.0/);
 });
 await t.test("returns 404 for an unknown draft child page",async()=>{const missing=await get("/operator/draft/__unknown__");assert.equal(missing.status,404);await missing.arrayBuffer()});
});

test("expanded road candidate API uses current active spots, no-store and validates input",async()=>{
 const catalog=await (await get("/api/operator/spots")).json();
 const spot=catalog.spots.find(s=>s.area==="jogashima-vicinity")??catalog.spots[0];
 const response=await get("/api/operator/spots/connection?id="+encodeURIComponent(spot.id));
 assert.equal(response.status,200);assert.match(response.headers.get("cache-control")??"",/no-store/);
 const {connection}=await response.json();assert.equal(connection.spotId,spot.id);assert.equal(connection.spotRevision,spot.revision);
 assert.deepEqual(connection.facility,{lat:spot.position.lat,lon:spot.position.lon});
 assert.ok(connection.segment.wayId>0);assert.ok(connection.distanceMeters>=0);
 const value=decodeRoadConnection(connection);assert.ok(value);assert.equal(connectionMatchesSpot(value,spot),true);
 for(const suffix of ["","?id=bad","?id=..%2F.."]){assert.equal((await get("/api/operator/spots/connection"+suffix)).status,400)}
 assert.equal((await get("/api/operator/spots/connection?id=local-00000000-0000-4000-8000-000000000000")).status,404);
});

test("operator preview page exposes saved generation or a clear blocking reason",async()=>{
 const response=await get("/operator/preview"),html=await response.text();
 assert.equal(response.status,200);assert.match(html,/data-operator-page="preview"/);
 assert.match(html,/data-rally-preview|data-preview-blocked/);assert.match(html,/href="\/operator\/draft"/);
 assert.doesNotMatch(html,/https:\/\/www\.openstreetmap\.org\/node\/-\d/);
 if(html.includes("data-rally-preview")){assert.match(html,/data-preview-overview/);assert.match(html,/data-preview-select/);assert.match(html,/現地未確認/);assert.match(html,/data-preview-card=/)}
 const unknown=await get("/operator/preview/__unknown__");assert.equal(unknown.status,404);await unknown.arrayBuffer();
});

test("road correction API and editor expose versioned context and reject invalid writes",async()=>{
 const api=await get("/api/operator/connections"),value=await api.json();
 assert.equal(api.status,200);assert.match(api.headers.get("cache-control")??"",/no-store/);assert.ok(decodeCorrectionContext(value));
 const page=await get("/operator/connections"),html=await page.text();assert.equal(page.status,200);assert.match(html,/data-operator-page="connections"/);assert.match(html,/data-correction-editor|data-correction-blocked/);
 const unknown=await get("/operator/connections/__unknown__");assert.equal(unknown.status,404);await unknown.arrayBuffer();
 const body={expectedDraftRevision:1,expectedCorrectionRevision:0,spotId:"osm-way-384676338",spotRevision:0,sourceHash:CORRECTION_SOURCE.snapshotSha256,mode:"manual",point:{lat:35.14,lon:139.62}};
 for(const [extra,status]of [[{headers:{"Content-Type":"application/json",Origin:"https://example.com"},body:JSON.stringify(body)},403],[{headers:{"Content-Type":"text/plain",Origin:baseUrl.origin},body:"x"},415],[{headers:{"Content-Type":"application/json",Origin:baseUrl.origin},body:"{bad"},400],[{headers:{"Content-Type":"application/json",Origin:baseUrl.origin},body:JSON.stringify({...body,point:{lat:0,lon:0}})},400]]){
  const response=await fetch(new URL("/api/operator/connections",baseUrl),{method:"PUT",...extra});assert.equal(response.status,status);await response.arrayBuffer();
 }
});

test("saved course pages expose review views and unknown IDs return 404",async()=>{
 const r=await get("/operator/courses"),html=await r.text();assert.equal(r.status,200);assert.match(html,/data-operator-page="courses"/);assert.match(html,/現地未確認/);assert.match(html,/data-course-list(?:-empty|-error)?/);assert.match(html,/name="robots"[^>]*noindex/);
 for(const id of ["invalid","course-00000000-0000-4000-8000-000000000000"]){const missing=await get("/operator/courses/"+id);assert.equal(missing.status,404);await missing.arrayBuffer()}
 const method=await get("/api/operator/courses");assert.equal(method.status,405);await method.arrayBuffer();
});
test("saved course POST validates origin, JSON, size and strict receipt without saving",async()=>{
 const valid={formatVersion:1,fingerprint:"a".repeat(64),draftRevision:1,correctionRevision:0,roadSha256:"b".repeat(64),contextSha256:"c".repeat(64)};
 for(const [headers,body,status]of [
  [{"Content-Type":"application/json",Origin:"https://example.com"},JSON.stringify(valid),403],
  [{"Content-Type":"application/json"},JSON.stringify(valid),403],
  [{"Content-Type":"text/plain",Origin:baseUrl.origin},"x",415],
  [{"Content-Type":"application/json",Origin:baseUrl.origin},"{bad",400],
  [{"Content-Type":"application/json",Origin:baseUrl.origin},JSON.stringify({...valid,payload:{}}),400],
  [{"Content-Type":"application/json",Origin:baseUrl.origin},"x".repeat(17000),400]
 ]){
  const response=await fetch(new URL("/api/operator/courses",baseUrl),{method:"POST",headers,body});assert.equal(response.status,status);assert.equal(response.headers.get("cache-control"),"no-store");await response.arrayBuffer();
 }
});

test("unpublished and malformed course IDs cannot be opened by participants",async()=>{
 for(const id of ["invalid","course-00000000-0000-4000-8000-000000000000"])for(const suffix of ["","/play"]){const r=await get("/rallies/"+id+suffix);assert.equal(r.status,404);await r.arrayBuffer()}
});
test("publication POST rejects missing origin, extra metadata and forged bodies",async()=>{
 const valid={courseId:"course-00000000-0000-4000-8000-000000000000",fingerprint:"a".repeat(64),expectedRevision:0};
 for(const [headers,body,status]of [
  [{"Content-Type":"application/json"},JSON.stringify(valid),403],
  [{"Content-Type":"application/json",Origin:"https://example.com"},JSON.stringify(valid),403],
  [{"Content-Type":"text/plain",Origin:baseUrl.origin},"x",415],
  [{"Content-Type":"application/json",Origin:baseUrl.origin},"{bad",400],
  [{"Content-Type":"application/json",Origin:baseUrl.origin},JSON.stringify({...valid,publishedAt:"2026-11-10T00:00:00.000Z"}),400],
  [{"Content-Type":"application/json",Origin:baseUrl.origin},"x".repeat(17000),400],
  [{"Content-Type":"application/json",Origin:baseUrl.origin},JSON.stringify(valid),404]
 ]){
  const r=await fetch(new URL("/api/operator/courses/publish",baseUrl),{method:"POST",headers,body});assert.equal(r.status,status);assert.equal(r.headers.get("cache-control"),"no-store");await r.arrayBuffer();
 }
 const r=await get("/api/operator/courses/publish");assert.equal(r.status,405);await r.arrayBuffer();
});

test("publication stop API applies the same local mutation guards",async()=>{
 const valid={courseId:"course-00000000-0000-4000-8000-000000000000",fingerprint:"a".repeat(64),expectedRevision:1};
 for(const [headers,body,status]of [
  [{"Content-Type":"application/json"},JSON.stringify(valid),403],
  [{"Content-Type":"application/json",Origin:"https://example.com"},JSON.stringify(valid),403],
  [{"Content-Type":"text/plain",Origin:baseUrl.origin},"x",415],
  [{"Content-Type":"application/json",Origin:baseUrl.origin},"{bad",400],
  [{"Content-Type":"application/json",Origin:baseUrl.origin},JSON.stringify({...valid,changedAt:"2026-11-10T00:00:00.000Z"}),400],
  [{"Content-Type":"application/json",Origin:baseUrl.origin},"x".repeat(17000),400],
  [{"Content-Type":"application/json",Origin:baseUrl.origin},JSON.stringify(valid),404]
 ]){const r=await fetch(new URL("/api/operator/courses/unpublish",baseUrl),{method:"POST",headers,body});assert.equal(r.status,status);assert.equal(r.headers.get("cache-control"),"no-store");await r.arrayBuffer()}
 const r=await get("/api/operator/courses/unpublish");assert.equal(r.status,405);await r.arrayBuffer();
});
test("public availability hides unknown course content and disables caching",async()=>{
 for(const id of ["invalid","course-00000000-0000-4000-8000-000000000000"]){const r=await get("/api/rallies/"+id+"/availability");assert.equal(r.status,404);assert.equal(r.headers.get("cache-control"),"no-store");assert.deepEqual(await r.json(),{status:"missing"})}
 const r=await fetch(new URL("/api/rallies/invalid/availability",baseUrl),{method:"POST"});assert.equal(r.status,405);await r.arrayBuffer();
});

test("published detail URLs redirect straight to the map entry without an itinerary",async()=>{
 const id="course-00000000-0000-4000-8000-000000000000",r=await fetch(new URL("/rallies/"+id,baseUrl),{redirect:"manual"});
 assert.equal(r.status,307);assert.equal(r.headers.get("location"),"/rallies/"+id+"/play");await r.arrayBuffer();
});

test("only the real draft landmark API remains available, with external acquisition disabled",async()=>{
 const invalid=await get("/api/operator/landmarks?source=sample");assert.equal(invalid.status,400);assert.equal(invalid.headers.get("cache-control"),"no-store");await invalid.arrayBuffer();
 const r=await get("/api/operator/landmarks"),state=await r.json();const context=await(await get("/api/operator/draft")).json();assert.equal(r.status,context.draft?200:503);assert.equal(r.headers.get("cache-control"),"no-store");if(r.status===200){assert.equal(state.dataset.source,"draft");assert.ok(state.dataset.cards.length);for(const c of Object.values(state.targets).flatMap(t=>t.candidates))if(c.kind==="unique")assert.equal(state.assets[c.id.slice(10)]?.crop?.size,128)}assert.doesNotMatch(JSON.stringify(state),/thumb_1024_url|access_token=|MLY\|/);
 for(const [body,status]of [[{action:"save",source:"sample"},400],[{action:"prepare",source:"draft"},403],[{action:"photo",source:"draft"},403],[{action:"save",source:"draft",datasetId:"wrong",expectedRevision:0,choices:{}},context.draft?409:503]]){
  const res=await fetch(new URL("/api/operator/landmarks",baseUrl),{method:"POST",headers:{"Content-Type":"application/json",Origin:baseUrl.origin},body:JSON.stringify(body)});assert.equal(res.status,status);await res.arrayBuffer();
 }
 const wrong=await fetch(new URL("/api/operator/landmarks",baseUrl),{method:"POST",headers:{"Content-Type":"application/json",Origin:"https://example.com"},body:"{}"});assert.equal(wrong.status,403);await wrong.arrayBuffer();
 const image=await get("/api/operator/landmarks/images/invalid");assert.equal(image.status,404);await image.arrayBuffer();
});
test("bundled regional crops and provenance still serve production courses",async()=>{
 const r=await get("/landmarks/miura-v1/manifest.json");assert.equal(r.status,200);const manifest=await r.json();assert.equal(manifest.version,2);assert.equal(manifest.junctions.length,1326);assert.equal(manifest.stats.missing,0);
 const notice=await get("/landmarks/miura-v1/NOTICE.md");assert.equal(notice.status,200);assert.match(await notice.text(),/CC BY-SA 4.0/);
 for(const photo of manifest.photos){const res=await get(photo.path);assert.equal(res.status,200);const bytes=new Uint8Array(await res.arrayBuffer());assert.equal(bytes.length,photo.bytes);assert.equal(createHash("sha256").update(bytes).digest("hex"),photo.sha256)}
});

test("shared participant design assets are bundled locally with their recorded source bytes",async()=>{
 const {default:provenance}=await import("../data/ui/koma-ui-provenance.json",{with:{type:"json"}});for(const asset of provenance.assets){const r=await get(asset.path);assert.equal(r.status,200);const bytes=new Uint8Array(await r.arrayBuffer());assert.equal(bytes.length,asset.bytes);assert.equal(createHash("sha256").update(bytes).digest("hex"),asset.sha256)}
});
