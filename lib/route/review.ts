export type ReviewSelection={source:"generated"|"reference";index:number};
// Pins retain exact OSM coordinates. Repeated visits at one node cycle in route order.
export function nextOccurrenceIndex(candidates:{nodeId:number}[],currentIndex:number,nodeId:number){
  const matches=candidates.flatMap((candidate,index)=>candidate.nodeId===nodeId?[index]:[]);
  if(!matches.length)throw new Error("Unknown map pin");
  const current=matches.indexOf(currentIndex);
  return matches[(current+1)%matches.length];
}
