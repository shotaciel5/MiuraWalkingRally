import assert from "node:assert/strict";
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

test("local Next.js HTTP smoke check", async (t) => {
  const response = await get("/");
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
