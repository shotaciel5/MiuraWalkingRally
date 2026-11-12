import {createHash} from "node:crypto";
import expanded from "../../data/miura-expanded/osm.json" with {type:"json"};
import roads from "../../data/miura-expanded/roads.json" with {type:"json"};
import {buildWalkingGraph,distanceMeters} from "../route/graph.ts";
import {extractContext,type Landmark} from "../route/context.ts";
import {createMisakiReviewPoc} from "../misaki-review.ts";
import {createRallyPreview,type RallyPreview} from "../operator/rally-preview.ts";
import {getDraftRepository} from "../operator/draft-repository.ts";
import {osmCandidate,type Dataset,type WorkCard,type Target} from "./model.ts";
import type {Snapshot} from "../route/types.ts";
let sample:Dataset|undefined,expandedLandmarks:Landmark[]|undefined;
function finish(source:"sample"|"draft",title:string,cards:WorkCard[]):Dataset{
 const grouped=new Map<string,Target>();for(const card of cards){
  const key=createHash("sha256").update(card.center.lat.toFixed(6)+","+card.center.lon.toFixed(6)).digest("hex");
  const target=grouped.get(key)??{key,point:{...card.center},sequences:[],approaches:[]};target.sequences.push(card.map.sequence);
  const incoming=(card.map.shortGeometry?.branches??card.map.branches).find(b=>b.arrival)?.neighborNodeId;
  if(incoming!==undefined&&!target.approaches.includes(incoming))target.approaches.push(incoming);grouped.set(key,target);
 }
 const id=createHash("sha256").update(JSON.stringify({source,cards})).digest("hex");
 return {id,source,title,cards,targets:[...grouped.values()]};
}
export function loadLandmarkDataset(source:"sample"|"draft"):Dataset{
 if(source==="sample"){if(!sample){const p=createMisakiReviewPoc();sample=finish(source,"三崎下町の表示サンプル",p.koma.map(c=>({map:c.map,center:c.candidate.point,context:c.context,referenceContext:null,osm:p.context.landmarks.filter(l=>distanceMeters(c.candidate.point,l.point)<=30).flatMap(l=>{const candidate=osmCandidate(l);return candidate?[candidate]:[]})})))}return sample}
 const current=getDraftRepository().load(),preview=createRallyPreview(current.draft,current.spots,current.corrections);if(preview.state!=="ready")throw new Error("draft-unavailable");
 return landmarkDatasetFromPreview(preview);
}
export function landmarkDatasetFromPreview(preview:RallyPreview):Dataset{
 expandedLandmarks??=extractContext(expanded as Snapshot,buildWalkingGraph(roads as Snapshot)).landmarks;
 return finish("draft",preview.title,preview.cards.map(c=>({map:c.map,center:c.candidate.point,context:c.context,referenceContext:c.referenceContext,osm:expandedLandmarks!.filter(l=>distanceMeters(c.candidate.point,l.point)<=30).flatMap(l=>{const candidate=osmCandidate(l);return candidate?[candidate]:[]})})));
}
