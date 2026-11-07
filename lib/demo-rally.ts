import {createHash} from "node:crypto";
import {createMisakiPoc} from "./misaki.ts";
import photos from "../data/misaki/spot-photos.json" with {type:"json"};
import contextSource from "../data/misaki/context-source.json" with {type:"json"};
import signsSource from "../data/misaki/signs-source.json" with {type:"json"};

export const DEMO_RALLY_ID="misaki-shitamachi";
export const DEMO_RALLY_HREF="/rallies/"+DEMO_RALLY_ID;
const stopCopy:Record<string,{kind:"start"|"checkpoint"|"waypoint"|"finish";role:string;description:string}>={
  S:{kind:"start",role:"スタート",description:"三崎港周辺から出発する想定です。安全に立ち止まれる開始場所は確認待ちです。"},
  C1:{kind:"checkpoint",role:"チェックポイント候補",description:"最初のチェックポイント候補です。入口と境内の利用条件は確認待ちです。"},
  W1:{kind:"waypoint",role:"経由地候補",description:"途中に立ち寄る経由地候補です。入口や通行できる道は確認待ちです。"},
  C2:{kind:"checkpoint",role:"チェックポイント候補",description:"2か所目のチェックポイント候補です。入口・階段や通路の利用条件は確認待ちです。"},
  G:{kind:"finish",role:"ゴール",description:"三崎港周辺に戻る周回を想定しています。終了場所とゴール条件は未確定です。"},
};

// This participant view uses the same fixed route as the PoC; no copied distance/time.
export function getDemoRally(){
  const {route,graph,source}=createMisakiPoc();
  const rally = {
    id:DEMO_RALLY_ID,href:DEMO_RALLY_HREF,title:"三崎下町さんぽ",area:"三崎下町",
    subtitle:"港から、神社とお寺へ。",
    description:"三崎港周辺を起点に、海南神社・光念寺・本瑞寺をたどり、港に戻る周回コースの開発用デモです。",
    status:"development" as const,
    distanceMeters:route.meters,distanceKm:(route.meters/1000).toFixed(2),
    walkingMinutes:Math.ceil(route.minutes),walkingSpeedKmh:route.speedKmh,
    hasSteps:route.legs.some(leg=>leg.edges.some(edge=>graph.ways.get(edge.wayId)?.tags?.highway==="steps")),
    stops:route.stops.map(stop=>{
      const copy=stopCopy[stop.id];
      if(!copy)throw new Error("Unknown demo rally stop: "+stop.id);
      return {id:stop.id,name:stop.name,...copy,photo:photos.find(p=>p.spotId===stop.id)??null};
    }),
  };
  const revision = "demo-v1-" + createHash("sha256").update(JSON.stringify({
    rally, roadSnapshot:source.snapshotSha256, legs:route.legs,
    navigationPresentation:"participant-koma-v1", contextSnapshot:contextSource.snapshotSha256, signsSnapshot:signsSource.snapshotSha256,
  })).digest("hex");
  return {...rally, revision};
}
export type DemoRally=ReturnType<typeof getDemoRally>;
