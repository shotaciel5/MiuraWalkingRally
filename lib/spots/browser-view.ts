import {INITIAL_SPOT_BOUNDS,SPOT_CATEGORIES,within,type InitialSpot,type SpotCategory} from "./initial-catalog.ts";
export const SPOT_GROUPS = {
  food:{label:"市場・飲食",glyph:"食",color:"#ad612d",categories:["market","food"]},
  cafe:{label:"カフェ・菓子",glyph:"茶",color:"#98526e",categories:["cafe","sweets"]},
  shopping:{label:"土産・買物",glyph:"買",color:"#5867a1",categories:["souvenir","shopping"]},
  nature:{label:"景観・公園",glyph:"景",color:"#2f7e59",categories:["scenery","park"]},
  heritage:{label:"名所・歴史",glyph:"史",color:"#8a703a",categories:["attraction","history","religious"]},
  other:{label:"体験・宿泊",glyph:"遊",color:"#427e8b",categories:["activity","stay","information"]},
} as const;
export type SpotGroup = keyof typeof SPOT_GROUPS;
export const AREA_LABELS = {"misaki-vicinity":"三崎周辺","jogashima-vicinity":"城ヶ島周辺"} as const;
export const ROUTING_LABELS = {"poc-reference":"既存コースの仮到達点","entrance-unverified":"入口・接続の確認待ち","outside-road-snapshot":"道路データの範囲外"} as const;
// A development display sample, not a recommendation or field approval. IDs/coordinates stay unchanged.
export const DEMO_SPOT_IDS = [
  "osm-way-384676338","osm-way-394752554","osm-way-394752558",
  "osm-node-2046962408","osm-node-9653105765","osm-node-4394291555",
  "osm-node-3880329702","osm-node-4200247042","osm-node-3880329336",
  "osm-node-3880329337","osm-node-3988005814","osm-node-3988005815",
  "osm-node-1211621029","osm-node-4200311204","osm-node-12364319660",
  "osm-way-395998646","osm-node-4200311006","osm-node-10230120491",
  "osm-way-384827683","osm-way-384827687","osm-node-3988006050",
  "osm-node-4200311002","osm-way-420045013","osm-node-4200311003",
] as const;
const object=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==="object"&&!Array.isArray(v);
export function decodeBrowserSpots(value:unknown):InitialSpot[]|null {
  if(!object(value)||value.schemaVersion!==1||!Array.isArray(value.spots)) return null;
  const seen=new Set<string>(),spots:InitialSpot[]=[];
  for(const raw of value.spots){
    if(!object(raw)||typeof raw.id!=="string"||seen.has(raw.id)||typeof raw.name!=="string"||!raw.name.trim()||raw.name.length>300
      ||typeof raw.category!=="string"||!Object.hasOwn(SPOT_CATEGORIES,raw.category)
      ||typeof raw.area!=="string"||!Object.hasOwn(AREA_LABELS,raw.area)
      ||!object(raw.position)||typeof raw.position.lat!=="number"||!Number.isFinite(raw.position.lat)
      ||typeof raw.position.lon!=="number"||!Number.isFinite(raw.position.lon)
      ||!within({lat:raw.position.lat,lon:raw.position.lon},INITIAL_SPOT_BOUNDS)
      ||!object(raw.source)||typeof raw.source.type!=="string"||!["node","way","relation"].includes(raw.source.type)
      ||!Number.isSafeInteger(raw.source.id)||Number(raw.source.id)<=0
      ||raw.id!=="osm-"+raw.source.type+"-"+raw.source.id
      ||raw.source.url!=="https://www.openstreetmap.org/"+raw.source.type+"/"+raw.source.id
      ||raw.position.kind!==(raw.source.type==="node"?"node":"bounding-box-center")
      ||raw.reviewStatus!=="unverified"||!object(raw.routing)
      ||typeof raw.routing.state!=="string"||!Object.hasOwn(ROUTING_LABELS,raw.routing.state)
      ||(raw.routing.state==="poc-reference"&&(!Number.isSafeInteger(raw.routing.nodeId)||Number(raw.routing.nodeId)<=0))) return null;
    seen.add(raw.id);
    spots.push({id:raw.id,name:raw.name,category:raw.category as SpotCategory,area:raw.area as InitialSpot["area"],
      position:{lat:raw.position.lat,lon:raw.position.lon,kind:raw.position.kind as InitialSpot["position"]["kind"]},
      source:{type:raw.source.type as InitialSpot["source"]["type"],id:Number(raw.source.id),url:String(raw.source.url)},reviewStatus:"unverified",
      routing:raw.routing.state==="poc-reference"?{state:"poc-reference",nodeId:Number(raw.routing.nodeId)}:{state:raw.routing.state as "entrance-unverified"|"outside-road-snapshot"}});
  }
  return spots;
}
export function groupFor(category:SpotCategory):SpotGroup {
  return (Object.keys(SPOT_GROUPS) as SpotGroup[]).find(k=>(SPOT_GROUPS[k].categories as readonly string[]).includes(category))!;
}
export type SpotFilters={mode:"demo"|"all";group:"all"|SpotGroup;area:"all"|InitialSpot["area"];query:string};
export const DEFAULT_FILTERS:SpotFilters={mode:"demo",group:"all",area:"all",query:""};
const searchable=(s:string)=>s.normalize("NFKC").replace(/\s/g,"").toLocaleLowerCase("ja-JP");
export function filterSpots(spots:readonly InitialSpot[],filters:SpotFilters) {
  const demo=new Set<string>(DEMO_SPOT_IDS),query=searchable(filters.query);
  return spots.filter(s=>(filters.mode==="all"||demo.has(s.id))&&(filters.group==="all"||groupFor(s.category)===filters.group)
    &&(filters.area==="all"||s.area===filters.area)&&searchable(s.name).includes(query));
}
export function visibleSelection(spots:readonly InitialSpot[],id:string|null){return spots.find(s=>s.id===id)??null}
