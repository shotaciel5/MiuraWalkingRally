import test from "node:test";import assert from "node:assert/strict";import fs from "node:fs";import crypto from "node:crypto";
import {THEMES,THEME_IDS,DEFAULT_DESIGN,DESIGN_KEYS,isTheme,isMapDesign,readDesignPreferences,saveDesignPreference,effectiveMapDesign} from "../lib/participant-design.ts";
import provenance from "../data/ui/koma-ui-provenance.json" with {type:"json"};
const memory=(values={})=>{const data=new Map(Object.entries(values));return {data,getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,v)}};
test("the shared UI exposes the twelve original design choices and Tsunosuke/follow defaults",()=>{
 assert.equal(THEMES.length,12);assert.deepEqual(THEMES.map(t=>t.id),[...THEME_IDS]);assert.equal(new Set(THEMES.map(t=>t.id)).size,12);assert.ok(THEMES.every(t=>t.name&&t.caption&&t.icon));assert.deepEqual(DEFAULT_DESIGN,{screen:"tsunosuke",map:"follow"});
});
test("only known design names can be restored; stored text is never treated as CSS or markup",()=>{
 for(const id of THEME_IDS){assert.equal(isTheme(id),true);assert.equal(isMapDesign(id),true)}assert.equal(isMapDesign("follow"),true);assert.equal(isTheme("follow"),false);
 for(const v of ["","__proto__","toString","<svg/onload=alert(1)>","url(https://example.com)",null,{},[],1]){assert.equal(isTheme(v),false);assert.equal(isMapDesign(v),false)}
});
test("screen and map preferences restore independently and never share participation keys",()=>{
 const store=memory({[DESIGN_KEYS.screen]:"forest",[DESIGN_KEYS.map]:"miuran",participation:"keep"});assert.deepEqual(readDesignPreferences(()=>store),{screen:"forest",map:"miuran"});
 store.data.set(DESIGN_KEYS.screen,"unknown");assert.deepEqual(readDesignPreferences(()=>store),{screen:"tsunosuke",map:"miuran"});
 assert.equal(saveDesignPreference(()=>store,"screen","donburi"),true);assert.equal(store.data.get(DESIGN_KEYS.screen),"donburi");assert.equal(store.data.get("participation"),"keep");assert.equal(store.data.get(DESIGN_KEYS.map),"miuran");
});
test("storage denial remains a usable in-memory design selection, and corrupt individual keys fall back safely",()=>{
 assert.deepEqual(readDesignPreferences(()=>{throw Error("denied")}),DEFAULT_DESIGN);assert.deepEqual(readDesignPreferences(()=>({getItem:k=>{if(k===DESIGN_KEYS.screen)throw Error("denied");return "tuna"},setItem(){}})),{screen:"tsunosuke",map:"tuna"});
 assert.equal(saveDesignPreference(()=>{throw Error("denied")},"screen","sea"),false);const store=memory();assert.equal(saveDesignPreference(()=>store,"map","bad"),false);assert.equal(store.data.size,0);
});
test("all 156 independent/follow combinations select the expected palette without route data",()=>{
 for(const screen of THEME_IDS){assert.equal(effectiveMapDesign({screen,map:"follow"}),screen);for(const map of THEME_IDS)assert.equal(effectiveMapDesign({screen,map}),map)}
});
test("all supplied character bytes and the design metadata match the recorded handoff provenance",()=>{
 for(const asset of provenance.assets){const bytes=fs.readFileSync(new URL("../public"+asset.path,import.meta.url));assert.equal(bytes.length,asset.bytes);assert.equal(crypto.createHash("sha256").update(bytes).digest("hex"),asset.sha256)}
 assert.equal(provenance.themes,12);assert.equal(provenance.assets.length,3);
});
