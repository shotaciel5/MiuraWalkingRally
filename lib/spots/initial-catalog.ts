import type {Point, Tags} from "../route/types.ts";

export type Bounds = {south:number; west:number; north:number; east:number};
export const INITIAL_SPOT_BOUNDS: Bounds = {south:35.125, west:139.608, north:35.157, east:139.638};
export const SPOT_QUERY_KEYS = ["amenity","shop","tourism","historic","natural","leisure","man_made"] as const;
export const SPOT_TAG_KEYS = [
  "name","name:ja","amenity","shop","tourism","information","historic","natural","leisure","man_made",
  "religion","access","disused","abandoned","demolished","razed","construction",
  "disused:amenity","disused:shop","disused:tourism","abandoned:amenity","abandoned:shop","abandoned:tourism",
] as const;
export const SPOT_CATEGORIES = {
  market:"市場・鮮魚・産直", cafe:"カフェ", food:"飲食店", sweets:"菓子・パン",
  souvenir:"土産店", shopping:"買物・店舗", scenery:"景観・自然", park:"公園",
  history:"史跡・碑", religious:"神社・寺院など", attraction:"観光施設・名所",
  activity:"体験・休憩施設", stay:"宿泊施設", information:"観光案内所",
} as const;
export type SpotCategory = keyof typeof SPOT_CATEGORIES;
export type SpotElement = Point & {type:"node"|"way"|"relation"; id:number; positionKind:"node"|"bounding-box-center"; tags:Tags};
export type SpotSnapshot = {schemaVersion:1; bounds:Bounds; elements:SpotElement[]};
export type Anchor = {spotId:string; nodeId:number};
export type Hold = {spotId:string; reason:string};
export type RoutingStatus =
  | {state:"poc-reference"; nodeId:number}
  | {state:"entrance-unverified"|"outside-road-snapshot"};
export type InitialSpot = {
  id:string; name:string; category:SpotCategory; area:"misaki-vicinity"|"jogashima-vicinity";
  position:Point & {kind:SpotElement["positionKind"]};
  source:{type:SpotElement["type"]; id:number; url:string};
  reviewStatus:"unverified"; routing:RoutingStatus;
};

function object(value:unknown): value is Record<string,unknown> {
  return !!value && typeof value==="object" && !Array.isArray(value);
}
function point(value:unknown): value is Point {
  return object(value) && typeof value.lat==="number" && Number.isFinite(value.lat) && Math.abs(value.lat)<=90
    && typeof value.lon==="number" && Number.isFinite(value.lon) && Math.abs(value.lon)<=180;
}
function validBounds(bounds:Bounds) {
  if (!point({lat:bounds.south,lon:bounds.west}) || !point({lat:bounds.north,lon:bounds.east})
    || bounds.south>=bounds.north || bounds.west>=bounds.east) throw new Error("Invalid spot bounds");
}
export function within(point:Point, bounds:Bounds) {
  return point.lat>=bounds.south && point.lat<=bounds.north && point.lon>=bounds.west && point.lon<=bounds.east;
}
export function spotId(element:Pick<SpotElement,"type"|"id">) { return "osm-"+element.type+"-"+element.id; }
export function initialSpotQuery(bounds:Bounds=INITIAL_SPOT_BOUNDS) {
  validBounds(bounds);
  const bbox=[bounds.south,bounds.west,bounds.north,bounds.east].join(",");
  return '[out:json][timeout:45];\n(\n'+SPOT_QUERY_KEYS.map(key=>'  nwr[~"^name(:ja)?$"~"."]["'+key+'"]('+bbox+');').join("\n")+'\n);\nout center;\n';
}

// Whitelist before writing public fixture data. Editor/contact/address metadata is not retained.
export function normalizeSpotSnapshot(payload:unknown, bounds:Bounds=INITIAL_SPOT_BOUNDS): SpotSnapshot {
  validBounds(bounds);
  if (!object(payload) || payload.remark || !Array.isArray(payload.elements)) throw new Error("Incomplete spot response");
  const entries=new Map<string,SpotElement>();
  for(const raw of payload.elements) {
    if (!object(raw) || typeof raw.type!=="string" || !["node","way","relation"].includes(raw.type)
      || typeof raw.id!=="number" || !Number.isSafeInteger(raw.id) || raw.id<=0) throw new Error("Invalid OSM identity");
    const position=raw.type==="node" ? raw : raw.center;
    if (!point(position)) throw new Error("Missing or invalid spot position");
    if (raw.tags!==undefined && !object(raw.tags)) throw new Error("Invalid OSM tags");
    const tags:Tags={};
    for(const key of SPOT_TAG_KEYS) {
      const value=(raw.tags as Record<string,unknown>|undefined)?.[key];
      if (typeof value==="string" && value.trim()) tags[key]=value.trim();
    }
    const entry:SpotElement={type:raw.type as SpotElement["type"],id:raw.id,lat:position.lat,lon:position.lon,
      positionKind:raw.type==="node"?"node":"bounding-box-center",tags};
    const id=spotId(entry), previous=entries.get(id);
    if (previous && JSON.stringify(previous)!==JSON.stringify(entry)) throw new Error("Conflicting OSM identity: "+id);
    entries.set(id,entry);
  }
  const rank={node:0,way:1,relation:2};
  return {schemaVersion:1,bounds:{...bounds},elements:[...entries.values()].sort((a,b)=>rank[a.type]-rank[b.type]||a.id-b.id)};
}

export function categoryFor(tags:Tags): SpotCategory|null {
  if (tags.amenity==="marketplace" || ["seafood","greengrocer","farm"].includes(tags.shop)) return "market";
  if (tags.amenity==="cafe") return "cafe";
  if (tags.amenity==="ice_cream" || ["bakery","confectionery","pastry","chocolate","ice_cream"].includes(tags.shop)) return "sweets";
  if (["restaurant","fast_food","food_court","bar","pub"].includes(tags.amenity)) return "food";
  if (["gift","souvenir"].includes(tags.shop)) return "souvenir";
  if (tags.amenity==="place_of_worship" || ["wayside_shrine","wayside_cross"].includes(tags.historic)) return "religious";
  if (tags.historic) return "history";
  if (["viewpoint"].includes(tags.tourism) || ["cape","beach","cliff","bird_nest","tree"].includes(tags.natural)) return "scenery";
  if (["park","garden","nature_reserve"].includes(tags.leisure)) return "park";
  if (["attraction","museum","gallery","artwork","theme_park","zoo","aquarium"].includes(tags.tourism)
    || ["lighthouse","bridge"].includes(tags.man_made)) return "attraction";
  if (tags.amenity==="public_bath" || ["fishing","sports_centre","swimming_pool"].includes(tags.leisure)) return "activity";
  if (["hotel","guest_house","hostel","motel","camp_site","chalet"].includes(tags.tourism)) return "stay";
  if (tags.tourism==="information" && ["office","visitor_centre"].includes(tags.information)) return "information";
  if (tags.amenity==="pharmacy" || (tags.shop && !["yes","no","vacant","car","car_repair","motorcycle","hairdresser","beauty","laundry"].includes(tags.shop))) return "shopping";
  return null;
}

function inactive(tags:Tags) {
  return ["disused","abandoned","demolished","razed","construction"].some(k=>tags[k] && tags[k]!=="no")
    || Object.entries(tags).some(([k,v])=>/^(disused|abandoned):/.test(k) && v && v!=="no");
}

// The source position is a landmark point/area centre, never an inferred entrance.
export function createInitialSpotCatalog(snapshot:SpotSnapshot, options:{roadBounds:Bounds; anchors:readonly Anchor[]; holds:readonly Hold[]}) {
  validBounds(snapshot.bounds); validBounds(options.roadBounds);
  const allIds=new Set(snapshot.elements.map(spotId));
  if (allIds.size!==snapshot.elements.length) throw new Error("Duplicate source ID");
  const anchors=new Map<string,number>(),holds=new Map<string,string>();
  for(const anchor of options.anchors) {
    if(!allIds.has(anchor.spotId) || anchors.has(anchor.spotId) || !Number.isSafeInteger(anchor.nodeId) || anchor.nodeId<=0) throw new Error("Invalid anchor reference");
    anchors.set(anchor.spotId,anchor.nodeId);
  }
  for(const hold of options.holds) {
    if(!allIds.has(hold.spotId) || holds.has(hold.spotId) || !hold.reason.trim() || anchors.has(hold.spotId)) throw new Error("Invalid manual hold");
    holds.set(hold.spotId,hold.reason);
  }
  const spots:InitialSpot[]=[],held:{id:string; name:string; reason:string}[]=[],excluded:{id:string; name:string; reason:string}[]=[];
  for(const element of snapshot.elements) {
    if (!point(element)) throw new Error("Invalid source position");
    const id=spotId(element),name=(element.tags["name:ja"]||element.tags.name||"").trim();
    if(!name) {excluded.push({id,name,reason:"missing-name"});continue}
    if(!within(element,snapshot.bounds)) {excluded.push({id,name,reason:"representative-point-outside-collection"});continue}
    if(inactive(element.tags)) {excluded.push({id,name,reason:"inactive"});continue}
    if(["private","no","customers","permit","members"].includes(element.tags.access)) {held.push({id,name,reason:"restricted-access"});continue}
    if(holds.has(id)) {held.push({id,name,reason:holds.get(id)!});continue}
    const category=categoryFor(element.tags);
    if(!category) {excluded.push({id,name,reason:element.tags.tourism==="information"?"information-sign":"outside-initial-categories"});continue}
    const nodeId=anchors.get(id);
    spots.push({id,name,category,area:element.lat<35.1376?"jogashima-vicinity":"misaki-vicinity",
      position:{lat:element.lat,lon:element.lon,kind:element.positionKind},source:{type:element.type,id:element.id,url:"https://www.openstreetmap.org/"+element.type+"/"+element.id},
      reviewStatus:"unverified",routing:nodeId?{state:"poc-reference",nodeId}:{state:within(element,options.roadBounds)?"entrance-unverified":"outside-road-snapshot"}});
  }
  for(const id of anchors.keys()) if(!spots.some(s=>s.id===id)) throw new Error("Anchor is not an admitted spot: "+id);
  // IDs remain independent: equal/near names are review candidates, not merge instructions.
  const duplicateNames:{name:string; ids:string[]}[]=[],byName=new Map<string,InitialSpot[]>();
  for(const spot of spots) {
    const key=spot.name.normalize("NFKC").replace(/\s/g,"").toLowerCase();
    const group=byName.get(key)??[];group.push(spot);byName.set(key,group);
  }
  for(const group of byName.values()) if(group.length>1) duplicateNames.push({name:group[0].name,ids:group.map(s=>s.id)});
  const count=(values:string[])=>Object.fromEntries([...new Set(values)].sort().map(k=>[k,values.filter(v=>v===k).length]));
  return {spots,held,excluded,duplicateNames,summary:{source:snapshot.elements.length,admitted:spots.length,held:held.length,excluded:excluded.length,
    byCategory:count(spots.map(s=>s.category)),byArea:count(spots.map(s=>s.area)),byRoutingState:count(spots.map(s=>s.routing.state))}};
}
