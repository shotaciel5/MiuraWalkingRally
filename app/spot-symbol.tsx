import {SPOT_SYMBOL_PATHS} from "../lib/spots/symbols";
import type {SpotCategory} from "../lib/spots/initial-catalog";
export default function SpotSymbol({category}:{category:SpotCategory}){
 return <svg className="spot-symbol" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={SPOT_SYMBOL_PATHS[category]}/></svg>;
}
