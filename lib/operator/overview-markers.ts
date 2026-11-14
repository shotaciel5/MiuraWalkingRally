import type {RallyPreview} from "./rally-preview.ts";
export type OverviewStop={key:string;point:{lat:number;lon:number};visits:Array<RallyPreview["visits"][number]&{badge:string;kind:"start"|"finish"|"checkpoint"|"waypoint"}>;badge:string;name:string};
export function overviewStops(visits:RallyPreview["visits"]):OverviewStop[]{
 const groups=new Map<string,OverviewStop>();let checkpoint=0,waypoint=0;
 for(const v of visits){
  const kind=v.id==="start"?"start":v.id==="finish"?"finish":v.label.includes("チェックポイント")?"checkpoint":"waypoint";
  const number=v.label.match(/(\d+)\s*$/)?.[1];
  const badge=kind==="start"?"S":kind==="finish"?"G":kind==="checkpoint"?"CP"+(number??String(checkpoint+1)):"経"+(number??String(waypoint+1));
  if(kind==="checkpoint")checkpoint++;if(kind==="waypoint")waypoint++;
  const key=v.point.lat+":"+v.point.lon,group=groups.get(key)??{key,point:v.point,visits:[],badge:"",name:""};
  group.visits.push({...v,badge,kind});groups.set(key,group);
 }
 return [...groups.values()].map(g=>({...g,badge:g.visits.map(v=>v.badge).join("/"),name:[...new Set(g.visits.map(v=>v.name))].join(" / ")}));
}
export function nextStopIndex(stop:OverviewStop,current:number){
 return stop.visits.find(v=>v.komaIndex>current)?.komaIndex??stop.visits[0].komaIndex;
}
