import {decodeCorrectionContext,CORRECTION_SOURCE} from "../lib/operator/rally-corrections.ts";
import {decodeRoadConnection,connectionMatchesSpot} from "../lib/route/road-connection.ts";
import {decodeDraftContext} from "../lib/operator/rally-draft.ts";
import {decodeManagedSpot} from "../lib/spots/editing.ts";
import {filterSpots,DEFAULT_FILTERS,ROUTING_LABELS} from "../lib/spots/browser-view.ts";
import assert from "node:assert/strict";
import {createHash} from "node:crypto";
import test from "node:test";
import {getDemoRally} from "../lib/demo-rally.ts";

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

test("retained route PoC HTTP smoke check", async (t) => {
  const response = await get("/poc");
  const html = await response.text();

  await t.test("serves a Japanese HTML document with a main landmark", () => {
    assert.equal(response.status, 200);
    assert.match(response.headers.get("content-type") ?? "", /text\/html/i);
    assert.match(html, /<html\b[^>]*\blang="ja"/i);
    assert.match(html, /<main(?:\s|>)/i);
    assert.match(html, /<meta\b[^>]*\bname="viewport"/i);
  });

  await t.test("serves the stylesheet referenced by the rendered document", async () => {
    const links = [...html.matchAll(/<link\b[^>]*>/gi)].map(([tag]) => tag);
    const stylesheet = links.find((tag) => /\brel="stylesheet"/i.test(tag));
    assert.ok(stylesheet, "The rendered page must include a stylesheet.");
    const href = stylesheet.match(/\bhref="([^"]+)"/i)?.[1];
    assert.ok(href, "The stylesheet must have a URL.");
    const stylesheetUrl = new URL(href.replaceAll("&amp;", "&"), baseUrl);
    assert.equal(stylesheetUrl.origin, baseUrl.origin);
    const cssResponse = await get(stylesheetUrl.pathname + stylesheetUrl.search);
    assert.equal(cssResponse.status, 200);
    assert.match(cssResponse.headers.get("content-type") ?? "", /text\/css/i);
    assert.ok((await cssResponse.text()).length > 0);
  });

  await t.test("serves the generated route, reference geometry and review status", () => {
    assert.equal([...html.matchAll(/data-generated-leg=/g)].length, 4);
    assert.equal([...html.matchAll(/data-reference-leg=/g)].length, 4);
    assert.match(html, /OpenStreetMap contributors/);
    assert.match(html, /\u673a\u4e0a\u5019\u88dc\u30fb\u78ba\u8a8d\u5f85\u3061/);
    assert.match(html.replace(/<!--[\s\S]*?-->/g, ""), /\u6642\u901f4/);
  });

  await t.test("serves the junction inspection controls and source counts", () => {
    assert.match(html, /data-junction-count="31"/);
    assert.match(html, /<select\b[^>]*\bid="junction-point"/);
    assert.match(html, /data-junction-sequence="1"/);
    assert.match(html, /data-junction-highlight="1"/);
  });
  await t.test("serves the first koma, stop binding and navigation controls", () => {
    assert.match(html, /data-koma-count="31"/);
    assert.match(html, /data-koma-svg="1"/);
    assert.match(html, /data-koma-stop="S"/);
    assert.match(html, /id="koma-select"/);
  });
  await t.test("serves all ordered thumbnails and linked selection with OSM context", () => {
    assert.equal([...html.matchAll(/data-review-card=/g)].length,31);
    assert.match(html,/data-review-card="1" aria-pressed="true"/);
    assert.match(html,/data-map-pin=/);
    assert.match(html,/data-next-koma-segment="1"/);
    assert.match(html,/data-context-landmark=/);
    assert.match(html,/data-context-building=/);
    assert.match(html,/data-context-toggle="landmarks"/);
    assert.match(html,/data-landmark-icon="bus"/);
    assert.match(html,/data-landmark-label=/);
    assert.match(html,/data-landmark-name=/);
    assert.match(html,/class="landmark-details"/);
  });
  await t.test("returns 404 for an unknown route", async () => {
    const missing = await get("/__smoke_missing_route__");
    assert.equal(missing.status, 404);
    await missing.arrayBuffer();
  });
});


test("participant rally list and detail HTTP smoke check",async t=>{
  const rally=getDemoRally(),listResponse=await get("/"),list=await listResponse.text();
  const detailResponse=await get(rally.href),detail=await detailResponse.text();
  const plain=html=>html.replace(/<!--[\s\S]*?-->/g,"");
  await t.test("serves a publication-only catalog with an explicit retained demo link",()=>{
    assert.equal(listResponse.status,200);assert.match(list,/data-participant-page="list"/);
    assert.match(list,/data-published-course-count=/);assert.match(list,/data-fixed-demo-link/);
    assert.equal([...list.matchAll(/data-rally-card=/g)].length,0);assert.ok(list.includes('href="'+rally.href+'"'));
    assert.match(list,/data-published-empty|data-published-catalog/);assert.match(list,/name="robots"[^>]*noindex/);
  });
  await t.test("serves detail with the same route facts, stop order and return path",()=>{
    assert.equal(detailResponse.status,200);assert.match(detail,/data-participant-page="detail"/);
    assert.ok(detail.includes('data-rally-id="'+rally.id+'"'));

    assert.ok(detail.includes('data-rally-distance="'+rally.distanceMeters+'"'));
    assert.ok(detail.includes('data-rally-minutes="'+rally.walkingMinutes+'"'));
    assert.deepEqual([...detail.matchAll(/data-rally-stop="([^"]+)"/g)].map(m=>m[1]),rally.stops.map(s=>s.id));
    const anchors=[...detail.matchAll(/<a\b[^>]*>/g)].map(m=>m[0]);
    assert.ok(anchors.some(tag=>/data-rally-back-link/.test(tag)&&/href="\/"/.test(tag)),"Detail must link back to the rally list.");
    assert.match(detail,/name="robots"[^>]*noindex/);
  });
  await t.test("distinguishes the development demo from public participation and future visit actions",()=>{
    for(const html of [detail]){
      assert.ok(plain(html).includes("参加は受け付けていません"));
      const actions=[...html.matchAll(/<(?:a|button)\b[^>]*>[\s\S]*?<\/(?:a|button)>/g)].map(m=>m[0]);
      assert.ok(!actions.some(action=>/参加する|ラリーを開始|チェックイン|QRを読み取る|クーポンを受け取る/.test(action)));
    }
    assert.ok(detail.includes("両チェックポイント達成後"));assert.ok(detail.includes("実利用の条件・特典は未定"));
  });
  await t.test("serves a demo start page with a matching edition and detail link",async()=>{
    const response=await get(rally.href+"/play"),html=await response.text();
    assert.equal(response.status,200);assert.match(html,/data-participant-page="play"/);
    assert.match(html,/data-participation-state="loading"/);
    assert.ok(html.includes(rally.revision));assert.ok(html.includes('href="'+rally.href+'"'));
    assert.match(html,/name="robots"[^>]*noindex/);
  });
  await t.test("server HTML never invents a per-tab participation",()=>{
    assert.match(detail,/data-participation-state="loading"/);
    assert.doesNotMatch(detail,/data-participation-id=/);
    assert.doesNotMatch(detail,/data-participation-state="active"/);
  });
  await t.test("serves the two local reference photos with their recorded bytes",async()=>{
    for(const spot of rally.stops.filter(s=>s.photo)){
      const photo=spot.photo,response=await get(photo.path),bytes=Buffer.from(await response.arrayBuffer());
      assert.equal(response.status,200);assert.match(response.headers.get("content-type")??"",/image\/jpeg/);
      assert.equal(bytes.length,photo.bytes);assert.equal(createHash("sha256").update(bytes).digest("hex"),photo.sha256);
    }
  });
  await t.test("does not render an active navigator before the tab explicitly starts",async()=>{
    const response=await get(rally.href+"/play"),html=await response.text();
    assert.doesNotMatch(html,/<section\b[^>]*data-participant-navigator/);
    assert.match(html,/data-participation-state="loading"/);
  });
  await t.test("returns 404 for an unknown rally",async()=>{
    const response=await get("/rallies/__unknown_rally__");
    assert.equal(response.status,404);await response.arrayBuffer();
  });
});

test("operator spot catalog HTTP smoke check",async t=>{
 const apiResponse=await get("/api/operator/spots"),catalog=await apiResponse.json();
 assert.equal(apiResponse.status,200);assert.equal(apiResponse.headers.get("cache-control"),"no-store");
 assert.ok(Array.isArray(catalog.spots));
 const spots=catalog.spots.map(decodeManagedSpot);assert.ok(spots.every(Boolean));
 assert.equal(new Set(spots.map(s=>s.id)).size,spots.length);
 const visible=filterSpots(spots,DEFAULT_FILTERS);
 const response=await get("/operator/spots"),html=await response.text();
 await t.test("serves active sample entries and an all-candidate option after edits or deletions",()=>{
  assert.equal(response.status,200);assert.match(html,/data-operator-page="spots"/);assert.match(html,/data-spot-browser/);
  assert.ok(html.includes('data-visible-count="'+visible.length+'"'));
  assert.equal([...html.matchAll(/data-spot-list-id="/g)].length,visible.length);
  const displayed=[...html.matchAll(/data-spot-list-id="([^"]+)"/g)].map(m=>m[1]);assert.deepEqual(displayed,visible.map(s=>s.id));
  assert.match(html,/data-spot-mode="all"/);
 });
 await t.test("shows current review states, attribution and management without route creation",()=>{
  for(const state of new Set(visible.map(s=>s.routing.state)))assert.ok(html.includes(ROUTING_LABELS[state]));
  assert.match(html,/OpenStreetMap contributors/);assert.match(html,/ODbL 1.0/);
  assert.match(html,/コースへの追加は「ラリー下書き」で行います/);assert.match(html,/data-spot-add/);assert.doesNotMatch(html,/data-demo-start/);
  assert.match(html,/name="robots"[^>]*noindex/);
 });
 await t.test("keeps participant and route PoC navigation with a distinct active operator link",()=>{
  const active=[...html.matchAll(/<a\b[^>]*>/g)].map(m=>m[0]).find(tag=>tag.includes('href="/operator/spots"')); assert.ok(active?.includes('aria-current="true"'));
  assert.match(html,/href="\/poc"/);assert.match(html,/href="\/"/);
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
