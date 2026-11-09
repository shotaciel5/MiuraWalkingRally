import { createMisakiJunctionPoc } from "./misaki-junctions.ts";
import { createKomaMaps } from "./route/koma.ts";
import {bindKomaCards} from "./route/koma-cards.ts";

export {bindKomaCards} from "./route/koma-cards.ts";
export type {KomaCardData} from "./route/koma-cards.ts";

export function createMisakiKomaPoc() {
  const poc=createMisakiJunctionPoc();
  return {
    ...poc,
    koma:bindKomaCards(poc.route,poc.junctions,createKomaMaps(poc.graph,poc.junctions)),
    referenceKoma:bindKomaCards(poc.route,poc.referenceJunctions,createKomaMaps(poc.graph,poc.referenceJunctions)),
  };
}
