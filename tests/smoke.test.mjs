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
  await t.test("serves one unpublished rally with a link to its detail",()=>{
    assert.equal(listResponse.status,200);assert.match(list,/data-participant-page="list"/);
    assert.equal([...list.matchAll(/data-rally-card=/g)].length,1);
    assert.ok(list.includes('href="'+rally.href+'"'));
    assert.ok(list.includes(rally.title));assert.ok(list.includes("開発用・未公開"));
    assert.match(list,/<html\b[^>]*\blang="ja"/);assert.match(list,/<meta\b[^>]*\bname="robots"[^>]*noindex/);
  });
  await t.test("serves detail with the same route facts, stop order and return path",()=>{
    assert.equal(detailResponse.status,200);assert.match(detail,/data-participant-page="detail"/);
    assert.ok(detail.includes('data-rally-id="'+rally.id+'"'));
    assert.ok(list.includes('data-rally-distance="'+rally.distanceMeters+'"'));
    assert.ok(detail.includes('data-rally-distance="'+rally.distanceMeters+'"'));
    assert.ok(detail.includes('data-rally-minutes="'+rally.walkingMinutes+'"'));
    assert.deepEqual([...detail.matchAll(/data-rally-stop="([^"]+)"/g)].map(m=>m[1]),rally.stops.map(s=>s.id));
    const anchors=[...detail.matchAll(/<a\b[^>]*>/g)].map(m=>m[0]);
    assert.ok(anchors.some(tag=>/data-rally-back-link/.test(tag)&&/href="\/"/.test(tag)),"Detail must link back to the rally list.");
    assert.match(detail,/name="robots"[^>]*noindex/);
  });
  await t.test("distinguishes the development demo from public participation and future visit actions",()=>{
    for(const html of [list,detail]){
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
 const response=await get("/operator/spots"),html=await response.text();
 await t.test("serves an operator page with 24 default entries and an all-candidate option",()=>{
  assert.equal(response.status,200);assert.match(html,/data-operator-page="spots"/);
  assert.match(html,/data-spot-browser/);assert.match(html,/data-visible-count="24"/);
  assert.equal([...html.matchAll(/data-spot-list-id="/g)].length,24);
  assert.match(html,/data-spot-mode="all"/);assert.match(html,/178/);
 });
 await t.test("shows review states, source attribution and no route creation or editing actions",()=>{
  assert.match(html,/道路データの範囲外/);assert.match(html,/入口・接続の確認待ち/);
  assert.match(html,/OpenStreetMap contributors/);assert.match(html,/ODbL 1.0/);
  assert.match(html,/コースへの追加は後続/);assert.doesNotMatch(html,/data-demo-start|data-spot-save|data-spot-delete/);
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
