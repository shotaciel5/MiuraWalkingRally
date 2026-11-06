import snapshot from "../data/misaki/context.json" with {type:"json"};
import contextSource from "../data/misaki/context-source.json" with {type:"json"};
import { createMisakiKomaPoc } from "./misaki-koma.ts";
import { createKomaContext, extractContext } from "./route/context.ts";
import type { Snapshot } from "./route/types.ts";

export function createMisakiReviewPoc(){
  const poc=createMisakiKomaPoc();
  const context=extractContext(snapshot as Snapshot,poc.graph);
  const enrich=(cards:typeof poc.koma)=>cards.map(card=>({...card,context:createKomaContext(poc.graph,card.map,context)}));
  return {...poc,context,contextSource,koma:enrich(poc.koma),referenceKoma:enrich(poc.referenceKoma)};
}
export type ReviewCard=ReturnType<typeof createMisakiReviewPoc>["koma"][number];
