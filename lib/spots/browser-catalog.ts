import data from "../../data/spots/initial-spots.json" with {type:"json"};
import {decodeBrowserSpots} from "./browser-view.ts";
export function getBrowserSpots(){
  const spots=decodeBrowserSpots(data);
  return spots;
}
