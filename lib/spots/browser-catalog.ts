import data from "../../data/spots/initial-spots.json" with {type:"json"};
import {decodeBrowserSpots,DEMO_SPOT_IDS} from "./browser-view.ts";
export function getBrowserSpots(){
  const spots=decodeBrowserSpots(data);
  return spots&&DEMO_SPOT_IDS.every(id=>spots.some(s=>s.id===id))?spots:null;
}
