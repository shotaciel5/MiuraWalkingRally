import selection from "../../data/spots/curation.json" with {type:"json"};
import type {ManagedSpot} from "./editing.ts";
import type {InitialSpot} from "./initial-catalog.ts";
export function curatedSpotIds(source:readonly InitialSpot[]):ReadonlySet<string>{
 const ids=new Set(selection.selectedIds),available=new Set(source.map(s=>s.id));
 if(selection.schemaVersion!==1||ids.size!==selection.selectedIds.length||ids.size!==selection.selectedCount||selection.sourceCount!==source.length||![...ids].every(id=>available.has(id)))throw Error("Invalid curated spot catalog");
 return ids;
}
// Previously edited/added records remain operator-owned; curation never erases them.
export function curateManagedSpots(spots:readonly ManagedSpot[],source:readonly InitialSpot[]):ManagedSpot[]{
 const ids=curatedSpotIds(source);
 return spots.filter(s=>ids.has(s.id)||s.revision>0||s.id.startsWith("local-"));
}
