"use client";
// Artwork and layout ported from the collaborator-provided koma-ui-share.
import {Fragment,useId} from "react";
import Image from "next/image";
import {THEMES,type ThemeId} from "../lib/participant-design";

function TsunaAdventure() { return <div className="tsuna-adventure" aria-hidden="true"><div className="tsuna-hero"><span className="tsuna-hero-rays"/><Image src="/characters/tsunosuke-cutout.png" alt="" width="230" height="275" decoding="async"/><span className="tsuna-spark tsuna-spark-one">{"\u2726"}</span><span className="tsuna-spark tsuna-spark-two">{"\u2727"}</span></div><div className="tsuna-adventure-copy"><span className="tsuna-kicker">{"\u307E\u3050\u308D\u306E\u307E\u3061\u306E\u5192\u967A\u76F8\u68D2"}</span><strong>{"\u4E09\u6D66\u30C4\u30CA\u4E4B\u4ECB"}<span>{"\u3068\u3001\u3044\u3056\u51FA\u9663\uFF01"}</span></strong></div></div>; }

export function TsunaMapPennant() { return <div className="tsuna-map-pennant" aria-hidden="true"><span>{"\u30C4\u30CA\u4E4B\u4ECB\u306E\u5192\u967A\u5730\u56F3"}</span><span className="tsuna-map-emblem">{"\u2726"}</span></div>; }

function TsunaMapScenery() { return <g className="map-atmosphere-tsuna-adventure"><path d="m0 0 56 0-9 9H10v43L0 62Zm300 280h-57l10-10h37v-40l10-11Z" fill="#c6473b"/><path d="M7 15v29m4-29v20m278 211v20m4-29v29" stroke="#f5b86a" strokeWidth="1.5"/><g fill="#e8c367"><path d="m28 17 2 6 6 2-6 2-2 6-2-6-6-2 6-2Zm242 223 2 5 5 2-5 2-2 5-2-5-5-2 5-2Z"/></g><g fill="none" stroke="#d4b86e" strokeWidth="1"><path d="m18 242 9 5-4 9-9-5Zm212-224 5-5 5 5-5 5Z"/></g></g>; }

function TsunaSurroundings() { return <g className="walk-tsuna-adventure-scenery"><g stroke="#ebbc60" opacity=".3" strokeWidth="2"><path d="m27 215 11-12m4 20 13-4m-24-25 4-13m425 435 12-11m-6 26 15-3"/></g><path d="m0 340 28-12 21 36-26 15-23-7m500 282-28-12-21 36 26 15 23-7" fill="#cf5945" opacity=".15"/><g fill="none" stroke="#f8d381" opacity=".4" strokeWidth="2"><path d="m20 337 18 30m-26-25 18 30m438 277-18 30m26-25-18 30"/></g><path d="M0 879q125-36 250 0t250 0v21H0Z" fill="#1e6687" opacity=".2"/><g fill="#f8d381" opacity=".6"><path d="m35 570 3 9 9 3-9 3-3 9-3-9-9-3 9-3Zm420-374 3 7 7 3-7 3-3 7-3-7-7-3 7-3Z"/></g></g>; }

function TunaSlice({ x: A, y: g, scale: C = 1, rotate: I = 0 }: {
    x: number;
    y: number;
    scale?: number;
    rotate?: number;
}) { return <g transform={`translate(${A} ${g}) rotate(${I}) scale(${C})`}><path d="M-27-13Q-6-19 27-11l-3 26q-27 6-52-2Z" fill="#c94d49" stroke="#ac383b" strokeWidth="1.2"/><path d="m-18-13 5 28m7-29 6 30m7-29 6 28m6-26 3 22" stroke="#f3b1a3" strokeWidth="2.2" opacity=".8"/><path d="M-23-10q21-5 44 1" fill="none" stroke="#ef8b7f" strokeWidth="2"/></g>; }

function GreenGarnish({ x: A, y: g, scale: C = 1, rotate: I = 0 }: {
    x: number;
    y: number;
    scale?: number;
    rotate?: number;
}) { return <g transform={`translate(${A} ${g}) rotate(${I}) scale(${C})`} fill="#fffef4" stroke="#ddd3b8" strokeWidth=".8"><ellipse rx="2.3" ry="5"/><ellipse cx="8" cy="4" rx="2.3" ry="5" transform="rotate(35 8 4)"/><ellipse cx="-6" cy="7" rx="2.3" ry="5" transform="rotate(-25 -6 7)"/></g>; }

function Wasabi({ x: A, y: g, scale: C = 1 }: {
    x: number;
    y: number;
    scale?: number;
}) { return <g transform={`translate(${A} ${g}) scale(${C})`}><path d="m-18 3-6-7 6-5-3-7 9 1 4-8 6 7 8-4 1 9 8 3-6 7 3 8-9 1-3 7-7-5-8 4-2-8-8-1Z" fill="#65834e"/><path d="M-10 12 7-15m-12 19-9-6m14 0 8 1" fill="none" stroke="#aac08a" strokeWidth="1.2"/><path d="M4 15q-4-8 3-13 3-6 7-1 9 4 9 14Z" fill="#b6c879" stroke="#8fa45b"/><path d="m9 8 5-3m-2 8 5-3" stroke="#dce6a8"/></g>; }

function DonburiIcon() { return <svg viewBox="0 0 110 80" aria-hidden="true"><path d="M10 36q3 30 45 32 42-2 45-32Z" fill="#283e40"/><path d="M39 66v7h32v-7" fill="#b64138"/><ellipse cx="55" cy="35" rx="45" ry="19" fill="#b64138"/><ellipse cx="55" cy="34" rx="40" ry="15" fill="#fff8e5"/><Wasabi x={78} y={24} scale={.6}/><TunaSlice x={34} y={30} scale={.59} rotate={-24}/><TunaSlice x={53} y={28} scale={.59} rotate={-12}/><TunaSlice x={69} y={34} scale={.55} rotate={12}/><path d="M19 49q36 20 73-1" stroke="#d9bb7e" strokeWidth="1.5" fill="none"/><path d="m88 10 18-9m-15 14 17-10" stroke="#987447" strokeWidth="3" strokeLinecap="round"/></svg>; }

function DonburiMapScenery() { return <g className="map-atmosphere-donburi"><path d="M4 24Q8 5 28 5h244q21 0 24 22M4 253q2 22 25 22h243q22 0 24-22" stroke="#d9ba8b" strokeWidth="1.6" fill="none"/><g opacity=".66"><TunaSlice x={34} y={19} scale={.63} rotate={-14}/><TunaSlice x={70} y={16} scale={.53} rotate={-7}/><TunaSlice x={269} y={258} scale={.65} rotate={-20}/></g><Wasabi x={275} y={24} scale={.55}/><GreenGarnish x={18} y={239} scale={.85} rotate={25}/><GreenGarnish x={223} y={269} scale={.65}/><GreenGarnish x={97} y={14} scale={.65}/><g stroke="#687154" strokeWidth="1.8" opacity=".5"><path d="m22 56 5 8m-14-6 7 3m253 168 6 8m-9-1 7-1"/></g></g>; }

function DonburiSurroundings() { return <g className="walk-donburi-scenery"><g opacity=".48"><TunaSlice x={6} y={330} scale={1.25} rotate={-32}/><TunaSlice x={496} y={646} scale={1.25} rotate={26}/><Wasabi x={478} y={260} scale={1.2}/><GreenGarnish x={28} y={644} scale={1.6} rotate={30}/><GreenGarnish x={468} y={790} scale={1.5} rotate={-15}/></g><path d="M-50 865q300-85 600 0v70H-50Z" fill="#b64138" opacity=".15"/><path d="M-50 883q300-85 600 0" stroke="#b99662" strokeWidth="2" fill="none" opacity=".35"/><g stroke="#657150" strokeWidth="3" opacity=".25"><path d="m35 200 5 11m-16-4 13 3m400 277 8 7m-3-12 5 10"/></g></g>; }

function Lighthouse({ x: A, y: g, scale: C = 1 }: {
    x: number;
    y: number;
    scale?: number;
}) { return <g transform={`translate(${A} ${g}) scale(${C})`}><path d="m-15 25 5-48h20l5 48Z" fill="#fffdf0" stroke="#6d8694" strokeWidth="1.5"/><path d="M-11-12h22v8h-22" fill="#d9e4e5"/><path d="M-13-23v-10h26v10M-17-23h34M-16-33 0-43l16 10Z" fill="#f4ca70" stroke="#6d8694" strokeWidth="1.5"/><path d="M-3 25V12h6v13" fill="#2d4c63"/><path d="M-22 25h44" stroke="#6d8694" strokeWidth="3"/></g>; }

function SummerFruit({ x: A, y: g, scale: C = 1 }: {
    x: number;
    y: number;
    scale?: number;
}) { return <g transform={`translate(${A} ${g}) scale(${C})`}><ellipse rx="15" ry="17" fill="#f4d783" stroke="#b8a559"/><path d="m-12-8 22 16m-22-6L7 14M-5-15 19 2M-10 12 13-8M-15 2 5-15" stroke="#fff1bd" fill="none" strokeWidth="1.3"/><path d="M0-17q-3-9 6-8" fill="none" stroke="#668447" strokeWidth="2"/></g>; }

function Crab({ x: A, y: g, scale: C = 1 }: {
    x: number;
    y: number;
    scale?: number;
}) { return <g transform={`translate(${A} ${g}) scale(${C})`}><path d="M-27-10h54a27 27 0 0 1-54 0Z" fill="#3b7b51"/><path d="M-23-10h46a23 23 0 0 1-46 0Z" fill="#e4edb0"/><path d="M-20-10h40a20 20 0 0 1-40 0Z" fill="#ee6d68"/><path d="m-12-5 1 4m11-5v4m11-3-1 4M-5 5l1 4m9-4-1 4" stroke="#553c35" strokeWidth="2" strokeLinecap="round"/></g>; }

function ForestTree({ x: A, y: g, scale: C = 1 }: {
    x: number;
    y: number;
    scale?: number;
}) { return <g transform={`translate(${A} ${g}) scale(${C})`}><path d="m-13 3-10 2-4 7m14-3-9 5m35-11 10 2 4 7m-14-3 9 5M-12-1-23-12m35 11 11-11" stroke="#b54e3a" strokeWidth="2.5" fill="none" strokeLinecap="round"/><path d="M-22-9q-14-3-8-14l7 7 4-9q10 12-3 16m44 0q14-3 8-14l-7 7-4-9q-10 12 3 16" fill="#d56b4b"/><ellipse rx="16" ry="10" fill="#cf6246"/><path d="M-7-6v-7m14 7v-7" stroke="#b54e3a" strokeWidth="2"/><g fill="#233f35"><circle cx="-7" cy="-13" r="2.5"/><circle cx="7" cy="-13" r="2.5"/></g><path d="M-4 2q4 4 8 0" fill="none" stroke="#fff0cf" strokeWidth="1.5"/></g>; }

function IslandRock({ x: A, y: g, scale: C = 1 }: {
    x: number;
    y: number;
    scale?: number;
}) { return <g transform={`translate(${A} ${g}) scale(${C})`}><path d="M0 15Q-27-2-4-22 18-9 0 15Z" fill="#79a788"/><path d="M0 15-4-17m3 17-9-5m9-2 7-8" stroke="#d6e1b9" strokeWidth="1.2" fill="none"/></g>; }

function NatureIcon({ kind: A }: {
    kind: string;
}) { return <svg viewBox="0 0 100 70" aria-hidden="true">{A === "lighthouse" ? <Fragment><path d="M47 12 0 3v32Z" fill="#f4ca70" opacity=".45"/><Lighthouse x={53} y={43} scale={.75}/><path d="m8 65 12-9 12 9m44 0 10-8 12 8" fill="#6d8694"/></Fragment> : A === "watermelon" ? <Fragment><Crab x={35} y={36}/><SummerFruit x={76} y={35} scale={.8}/></Fragment> : <Fragment><IslandRock x={22} y={29} scale={.8}/><ForestTree x={59} y={45} scale={.9}/></Fragment>}</svg>; }

function NatureMapScenery() { return <Fragment><g className="map-atmosphere-lighthouse"><path d="m260 20-80-16v50Z" fill="#f7e4a9" opacity=".3"/><Lighthouse x={273} y={38} scale={.45}/><path d="m0 268 17-12 12 4 14-12 19 20 21-8 20 20H0Zm233 12 10-18 14-8 13 6 9-10 21 17v13Z" fill="#cbd1ce"/><path d="M26 269q0-12 10-12t10 12" stroke="#9babae" strokeWidth="6" fill="none"/><path d="M110 273q15-5 30 0t30 0m35-5h20" stroke="#a8c4c8" fill="none"/></g><g className="map-atmosphere-watermelon"><path d="M0 272q75-13 150 0t150-2v10H0Z" fill="#d5e6b5"/><Crab x={27} y={253} scale={.7}/><SummerFruit x={277} y={28} scale={.65}/><g fill="#a9c48b" opacity=".65"><path d="M15 45q-5-26 13-23 15 18-13 23m254 177q-5-26 13-23 15 18-13 23"/></g><path d="m47 23 2 4m209 229-2 4m-190 7 1 3" stroke="#b5946e" strokeWidth="2" strokeLinecap="round"/></g><g className="map-atmosphere-forest"><path d="M0 0h300v9q-12 26-30 1-17 25-35 0Q211 30 194 8q-28 14-42-3-25 23-45 1Q75 29 55 8 21 30 0 12Z" fill="#d8e5cf"/><g opacity=".65"><IslandRock x={18} y={29} scale={.7}/><IslandRock x={287} y={51} scale={.7}/></g><path d="M0 266q50-9 100 3t95-1 105-4v16H0Z" fill="#d5e4dc"/><path d="M9 275h75m-68-4v8m13-8v8m13-8v8m13-8v8m13-8v8m13-8v8" stroke="#b6b59a" strokeWidth="1.3"/><ForestTree x={269} y={256} scale={.55}/></g></Fragment>; }

function NatureSurroundings() { return <Fragment><g className="walk-lighthouse-scenery"><path d="M475 254 0 110v230Z" fill="#f4d784" opacity=".1"/><Lighthouse x={482} y={305} scale={1.25}/><g fill="#f4d784" opacity=".5"><circle cx="34" cy="200" r="2"/><circle cx="455" cy="120" r="2"/><circle cx="64" cy="590" r="1.5"/></g><path d="M0 850 45 802l30 18 40-43 50 80 62-20 30 63H0Zm315 50 42-44 24 6 46-57 33 21 40-38v112Z" fill="#54717e" opacity=".35"/><path d="M0 875q75-15 150 0t150 0 200 0" fill="none" stroke="#a5c9d0" opacity=".3" strokeWidth="3"/></g><g className="walk-watermelon-scenery"><g opacity=".5"><Crab x={14} y={335} scale={1.3}/><SummerFruit x={484} y={645} scale={1.4}/><Crab x={100} y={858}/></g><path d="M0 879q125-40 250 0t250-4v25H0Z" fill="#5c9464" opacity=".2"/><g stroke="#bd8b58" strokeWidth="3" strokeLinecap="round" opacity=".3"><path d="m40 170 2 6m420 42-2 6m-381 442 2 6m350 123-2 6"/></g></g><g className="walk-forest-scenery"><path d="M0 0h500v95q-35 60-80-6-40 55-75 0-50 45-80-8-40 50-90 1-50 55-80 0-65 65-95 10Z" fill="#719c77" opacity=".2"/><g opacity=".35"><IslandRock x={18} y={330} scale={1.8}/><IslandRock x={488} y={619} scale={2}/><ForestTree x={53} y={843} scale={1.1}/></g><path d="M0 892q230-45 500 0" stroke="#bdad7c" strokeWidth="14" fill="none" opacity=".25"/><path d="m20 888 2 12m25-15 2 15m25-18 2 18m25-21 2 21m25-24 2 24" stroke="#ddcca1" strokeWidth="2" opacity=".25"/></g></Fragment>; }

function Daikon({ x: A, y: g, scale: C = 1 }: {
    x: number;
    y: number;
    scale?: number;
}) { return <g transform={`translate(${A} ${g}) scale(${C})`}><path d="M0 0C-12 0-10 19 0 31 13 19 14 1 0 0Z" fill="#fffdf1" stroke="#749062" strokeWidth="1.3"/><path d="m0 0-12-13q13-3 15 12M2 0l1-20q12 5 2 20M4 1l15-13q5 11-15 16" fill="#65934c"/><path d="m-4 9 5 1m-2 7 4 1M0 31l-1 5" stroke="#b8bb91" strokeWidth="1.2"/></g>; }

function Cabbage({ x: A, y: g, scale: C = 1 }: {
    x: number;
    y: number;
    scale?: number;
}) { return <g transform={`translate(${A} ${g}) scale(${C})`}><circle r="17" fill="#b7ce91" stroke="#78955c"/><path d="M0 14C-24-2-6-21 2-9 17-24 24 7 0 14Z" fill="#d5e2b4" stroke="#78955c"/><path d="M0 14q-5-14 5-23M-12-3Q-1-2 0 14M12 0Q4 4 0 14" fill="none" stroke="#8ba66a"/></g>; }

function RetroHouse({ x: A, y: g, scale: C = 1 }: {
    x: number;
    y: number;
    scale?: number;
}) { return <g transform={`translate(${A} ${g}) scale(${C})`}><path d="M-24 28V-15h48v43Z" fill="var(--retro-wall,#e8d6b6)" stroke="var(--retro-ink,#956d49)" strokeWidth="1.5"/><path d="M-28-15-20-27h40l8 12Z" fill="var(--retro-roof,#9b5746)"/><rect x="-17" y="-9" width="34" height="9" rx="1" fill="var(--retro-sign,#fff4db)" stroke="var(--retro-ink,#956d49)"/><path d="M-10-5h20M-16 28V8H1v20M6 8h12v14H6Z" fill="none" stroke="var(--retro-ink,#956d49)" strokeWidth="1.4"/><path d="M-24 4h48" stroke="var(--retro-roof,#9b5746)" strokeWidth="4"/></g>; }

function FestivalFan({ x: A, y: g, scale: C = 1 }: {
    x: number;
    y: number;
    scale?: number;
}) { return <g transform={`translate(${A} ${g}) scale(${C})`}><path d="M0 17-27-13Q0-40 27-13Z" fill="var(--fan-paper,#d65c46)" stroke="var(--fan-line,#c4a15b)" strokeWidth="1.3"/>{[-22, -11, 0, 11, 22].map(I => <path d={`M0 17 ${I} ${-21 + Math.abs(I) * .28}`} stroke="var(--fan-rib,#edcf8c)" strokeWidth=".9" key={I}/>)}<path d="m-3 20 3-3 3 3" stroke="var(--fan-line,#c4a15b)" fill="none"/><circle cy="17" r="2" fill="var(--fan-line,#c4a15b)"/></g>; }

function LocalIcon({ kind: A }: {
    kind: string;
}) { return <svg viewBox="0 0 100 60" aria-hidden="true" fill="none">{A === "farm" ? <Fragment><Daikon x={32} y={23} scale={.9}/><Cabbage x={69} y={38} scale={.85}/></Fragment> : A === "retro" ? <Fragment><RetroHouse x={28} y={32} scale={.7}/><RetroHouse x={69} y={32} scale={.85}/></Fragment> : <Fragment><FestivalFan x={45} y={34}/><path d="M80 8v31m-4-29h8m-4 29-5 11m5-11 6 11" stroke="#c4a15b" strokeWidth="2"/><path d="m76 13 4 10 4-10M76 24l4 10 4-10" fill="#d65c46"/></Fragment>}</svg>; }

function LocalMapScenery() { return <Fragment><g className="map-atmosphere-farm"><path d="M0 254q65-25 143-5t157-4v40H0Z" fill="#dfebce"/><path d="M0 271q80-23 160-5t140-4M14 281q80-20 160-4" stroke="#b2c59a" fill="none" strokeWidth="2"/><g opacity=".7"><Daikon x={269} y={20} scale={.65}/><Cabbage x={27} y={247} scale={.85}/><Daikon x={47} y={255} scale={.43}/></g><path d="M20 42q15-2 9 14-15 0-9-14M270 212q15-2 9 14-15 0-9-14" fill="#c0d7a5"/></g><g className="map-atmosphere-retro"><path d="M9 20V9h28M263 9h28v11M9 255v15h26M265 270h26v-15" stroke="#c6ab82" strokeWidth="1.2" fill="none"/><path d="M0 258h300v22H0Z" fill="#ede0c7"/><path d="M0 263h300M0 274h300" stroke="#dac6a3" strokeWidth=".6"/><g opacity=".55"><RetroHouse x={270} y={38} scale={.4}/><RetroHouse x={26} y={257} scale={.43}/><RetroHouse x={52} y={257} scale={.3}/></g><circle cx="32" cy="38" r="13" fill="none" stroke="#ccb28f" strokeWidth=".8" strokeDasharray="2 2"/><path d="m18 39 27-5m-25 10 25-5" stroke="#ccb28f" strokeWidth=".8"/></g><g className="map-atmosphere-festival"><path d="M6 7h288v266H6Z" fill="none" stroke="#d6bc82" strokeWidth=".7"/><g opacity=".65"><FestivalFan x={271} y={24} scale={.66}/><FestivalFan x={26} y={255} scale={.65}/></g><path d="M0 274h300" stroke="#d6bc82" strokeWidth="5"/><g opacity=".5"><path d="m24 29 8-2 3 10-8 2m238 179 9 1-1 10-9-1" fill="#ce6452"/><path d="m260 60 5 2-3 8-5-2m-7 185 6-3 4 8-6 3" fill="#c8a650"/><path d="m22 208 7 3-4 9-7-3" fill="#8a9f8e"/></g></g></Fragment>; }

function LocalSurroundings() { return <Fragment><g className="walk-farm-scenery"><path d="M0 775q110-90 240-22t260-8v155H0Z" fill="#a9c883" opacity=".25"/><path d="M0 835q150-65 280-18t220-5v88H0Z" fill="#719657" opacity=".2"/><g opacity=".42"><Daikon x={28} y={315} scale={1.1}/><Cabbage x={483} y={645} scale={1.3}/><Cabbage x={45} y={840}/></g><path d="M0 878q180-54 350-10t150-3" stroke="#fff8df" strokeWidth="4" fill="none"/></g><g className="walk-retro-scenery"><g opacity=".16"><RetroHouse x={30} y={350} scale={1.6}/><RetroHouse x={486} y={665} scale={1.8}/><RetroHouse x={45} y={880} scale={1.3}/><RetroHouse x={105} y={880}/><RetroHouse x={164} y={880} scale={1.3}/><RetroHouse x={436} y={880} scale={1.2}/></g><g fill="none" stroke="#b69a6f" opacity=".23"><circle cx="464" cy="196" r="28" strokeDasharray="3 4"/><path d="m424 198 76-13m-76 25 76-13"/><path d="M0 867h500" strokeWidth="2"/></g></g><g className="walk-festival-scenery"><path d="M0 133q250-55 500 0" stroke="#d6bc82" opacity=".45" fill="none"/><g opacity=".4"><FestivalFan x={20} y={320} scale={1.3}/><FestivalFan x={488} y={665} scale={1.4}/></g><g opacity=".45"><path d="m40 201 14 3-3 18-14-3m396 570 14 3-3 18-14-3" fill="#db6b54"/><path d="m466 231 12-4 5 16-12 4m-420 426 12-4 5 16-12 4" fill="#d9b65c"/><path d="m30 519 13 5-6 15-13-5m413-91 13 5-6 15-13-5" fill="#87a6aa"/></g><path d="M0 875h500" stroke="#c4a15b" strokeWidth="3" opacity=".45"/></g></Fragment>; }

function Fish({ x: A, y: g, scale: C = 1, flip: I = !1 }: {
    x: number;
    y: number;
    scale?: number;
    flip?: boolean;
}) { return <g transform={`translate(${A} ${g}) scale(${I ? -C : C} ${C})`}><path d="M-27 0C-11-17 12-17 26 0L40-12 36 0l4 12-14-11C8 17-12 15-27 0Z" fill="currentColor"/><path d="m-5-10 11-10 3 12M-4 11l11 8 3-10" fill="currentColor"/><circle cx="-16" cy="-2" r="1.7" fill="var(--scene-eye,#fff)"/><path d="M-7-8q-5 8 0 16" stroke="var(--scene-eye,#fff)" strokeWidth="1.2" fill="none"/></g>; }

function Blossom({ x: A, y: g, size: C = 1, rotate: I = 0 }: {
    x: number;
    y: number;
    size?: number;
    rotate?: number;
}) { return <g transform={`translate(${A} ${g}) rotate(${I}) scale(${C})`}>{[0, 72, 144, 216, 288].map(B => <path transform={`rotate(${B})`} d="M0 1C-11-4-12-14-5-18L0-14l5-4C12-14 11-4 0 1Z" fill="currentColor" key={B}/>)}<circle r="3" fill="var(--scene-center,#d69a46)"/>{[0, 72, 144, 216, 288].map(B => <path transform={`rotate(${B})`} d="M0-2v-5" stroke="var(--scene-center,#d69a46)" strokeWidth=".8" key={B}/>)}</g>; }

export function MapAtmosphere({ id: A }: {
    id: string;
}) { return <g className="map-atmosphere" aria-hidden="true" pointerEvents="none"><defs><clipPath id={A}><rect x="2" y="2" width="296" height="276" rx="13"/></clipPath></defs><g clipPath={`url(#${A})`}><LocalMapScenery /><NatureMapScenery /><DonburiMapScenery /><g className="map-atmosphere-ocean"><path d="M0 240Q38 223 76 240t76 0 76 0 76 0V280H0Z" fill="var(--scene-wave-light)"/><path d="M0 257Q38 241 76 257t76 0 76 0 76 0V280H0Z" fill="var(--scene-wave)"/><path d="M9 27q10-8 20 0t20 0M231 23q10-8 20 0t20 0M15 248q11-7 22 0t22 0M194 263q11-7 22 0t22 0" stroke="var(--scene-foam)" strokeWidth="1.4" fill="none"/><g className="map-atmosphere-fish"><g className="map-atmosphere-fish-corner"><Fish x={255} y={49} scale={.48} flip={!0}/></g><Fish x={36} y={215} scale={.42}/><Fish x={257} y={258} scale={.46}/></g><g fill="none" stroke="var(--scene-bubble)" strokeWidth=".9"><circle cx="275" cy="199" r="4"/><circle cx="282" cy="186" r="2.5"/><circle cx="20" cy="69" r="3"/><circle cx="25" cy="59" r="1.5"/></g></g><g className="map-atmosphere-sakura"><path d="M300 0q-30 13-55 6M288 4q-2 17-14 24M0 280q35-9 45-35" fill="none" stroke="var(--scene-branch)" strokeWidth="2"/><g className="map-atmosphere-blossoms"><Blossom x={270} y={18} size={.78}/><Blossom x={245} y={9} size={.48} rotate={20}/><Blossom x={290} y={40} size={.5} rotate={30}/><Blossom x={21} y={252} size={.75} rotate={-15}/><Blossom x={42} y={239} size={.4}/></g><g fill="var(--scene-petal)"><path d="M17 38q16-1 8 16-13-4-8-16M266 218q15 1 7 16-13-5-7-16M73 260q16-3 9 14-13-2-9-14M225 57q11-2 6 10-9-1-6-10"/></g><path d="M0 272q72-18 150 0t150-2v12H0Z" fill="var(--scene-petal-bed)"/></g><TsunaMapScenery /></g></g>; }

export function WalkSurroundings() { return <div className="walk-surroundings" aria-hidden="true"><svg viewBox="0 0 500 900" preserveAspectRatio="xMidYMid slice" focusable="false"><LocalSurroundings /><NatureSurroundings /><DonburiSurroundings /><TsunaSurroundings /><g className="walk-ocean-scenery"><path d="M0 720q60-30 125 0t125 0 125 0 125 0v180H0Z" fill="#5ab3ce" opacity=".16"/><path d="M0 780q60-30 125 0t125 0 125 0 125 0v120H0Z" fill="#227f9b" opacity=".14"/><g fill="none" stroke="#fff" strokeWidth="2" opacity=".5"><path d="M-20 745q30-17 60 0t60 0M350 810q30-17 60 0t60 0"/><circle cx="25" cy="205" r="8"/><circle cx="37" cy="181" r="4"/><circle cx="474" cy="585" r="7"/></g><g color="#367e9e" opacity=".18"><Fish x={25} y={325} scale={.7}/><Fish x={485} y={655} scale={.85} flip={!0}/><Fish x={100} y={850} scale={.6}/></g></g><g className="walk-sakura-scenery"><path d="M500 90q-38 6-60-25t-53-23M452 76q-7-27-24-47" fill="none" stroke="#9d6574" strokeWidth="3" opacity=".22"/><g color="#d96b9c" opacity=".38"><Blossom x={466} y={66} size={1.2}/><Blossom x={426} y={37} size={.85}/><Blossom x={496} y={105} size={1.1}/><Blossom x={12} y={640} size={1.3}/><Blossom x={45} y={663} size={.8}/><Blossom x={478} y={760} size={.75}/></g><g fill="#e78bb1" opacity=".45"><path d="M40 200q20-2 10 20-17-6-10-20M469 290q20-2 10 20-17-6-10-20M37 472q15-1 8 14-13-4-8-14M445 860q15-1 8 14-13-4-8-14"/></g><path d="M0 875q100-35 200-8t300-20v53H0Z" fill="#a8c88b" opacity=".2"/></g></svg></div>; }

export function ThemeIcon({ kind: A }: {
    kind: string;
}) { return A === "donburi" ? <DonburiIcon /> : A === "lighthouse" || A === "watermelon" || A === "forest" ? <NatureIcon kind={A}/> : A === "farm" || A === "retro" || A === "festival" ? <LocalIcon kind={A}/> : A === "tsunosuke" || A === "miuran" ? <Image className="walk-character-art" src={"/characters/" + A + ".jpg"} alt="" width={A === "tsunosuke" ? 230 : 250} height={A === "tsunosuke" ? 275 : 279} decoding="async"/> : <svg viewBox="0 0 100 48" fill="none" aria-hidden="true">{A === "wave" ? <Fragment><circle cx="77" cy="12" r="6" fill="currentColor" opacity=".35"/><path d="M4 28c12-14 20 14 32 0s20 14 32 0 20 14 30 0M4 39c12-14 20 14 32 0s20 14 32 0 20 14 30 0" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/></Fragment> : A === "fish" ? <Fragment><path d="M18 25C34 5 61 5 76 24L94 12l-4 13 4 13-18-12C58 44 34 43 18 25Z" fill="currentColor"/><path d="m46 12 9-9 5 12M44 37l10 8 4-11" fill="currentColor"/><circle cx="31" cy="23" r="2" fill="var(--preview-paper)"/><path d="M42 17q-5 8 0 16" stroke="var(--preview-paper)" strokeWidth="1.5"/></Fragment> : <Fragment><path d="M25 39V23h44V8" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"/><circle cx="25" cy="39" r="4" fill="currentColor"/><path d="m62 14 7-7 7 7" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/><path d="M7 23h10m60 0h16M48 5v10m0 16v11" stroke="currentColor" opacity=".25" strokeWidth="3" strokeLinecap="round"/></Fragment>}</svg>; }

export function ThemeStamp({ design: A }: {
    design: ThemeId;
}) { if (A === "tsunosuke")
    return <TsunaAdventure />; let g = THEMES.find(I => I.id === A)!, C = { donburi: "\u304A\u3044\u3057\u3044\u4E09\u5D0E\u3092\u3001\u3072\u3068\u30B3\u30DE\u305A\u3064\u3002", lighthouse: "\u706F\u53F0\u306E\u3042\u304B\u308A\u3068\u3001\u5CA9\u7901\u306E\u5CF6\u3078\u3002", watermelon: "\u590F\u306E\u5B9F\u308A\u3068\u3001\u306F\u3058\u3051\u308B\u304A\u3055\u3093\u307D\u3002", forest: "\u8D64\u3044\u30AB\u30CB\u3068\u3001\u6728\u6F0F\u308C\u65E5\u306E\u63A2\u691C\u3078\u3002", tsunosuke: "\u6D77\u98A8\u3068\u3001\u307E\u3050\u308D\u306E\u307E\u3061\u3092\u63A2\u691C\u3002", miuran: "\u685C\u306E\u98A8\u306B\u306E\u3063\u3066\u3001\u307E\u3061\u3092\u304A\u3055\u3093\u307D\u3002", farm: "\u8449\u3063\u3071\u306E\u98A8\u3068\u3001\u7551\u306E\u307E\u3061\u3078\u3002", retro: "\u8DEF\u5730\u306E\u5411\u3053\u3046\u306B\u3001\u61D0\u304B\u3057\u3044\u4E09\u5D0E\u3002", festival: "\u6247\u3068\u4E94\u8272\u306B\u8A98\u308F\u308C\u3066\u3001\u307E\u3061\u3081\u3050\u308A\u3002" }; return <div className="walk-design-stamp" aria-hidden="true"><ThemeIcon kind={g.icon}/><span>{A === "miuran" || A === "farm" || A === "retro" || A === "festival" || A === "lighthouse" || A === "watermelon" || A === "forest" || A === "donburi" ? <Fragment><strong>{g.name}</strong><small>{C[A as keyof typeof C]}</small></Fragment> : A === "sea" ? "SEASIDE WALK" : A === "tuna" ? "MISAKI TUNA WALK" : "MIURA WALKING RALLY"}</span></div>; }

export function MapCharacter({ design: A, screen: g }: {
    design: ThemeId;
    screen: ThemeId;
}) { return A !== "miuran" || A === g ? null : <div className="walk-map-character" aria-hidden="true"><ThemeIcon kind={A}/><span>{"\u307F\u3046\u3089\u3093"}</span></div>; }

export function ThemeMapScenery(){const id=useId().replaceAll(":","");return <MapAtmosphere id={"scene-"+id}/>;}
