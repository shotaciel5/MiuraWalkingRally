// Port of junction_experiment_features.py + local_ai.features/distance.
// Shape inputs only; labels, IDs, rule decisions and absolute positions are excluded.
import {linearAssignment} from "./assignment.ts";
export const FEATURE_VERSION="junction-correspondence-entry-curve-v1:D" as const;
export type FeaturePoint={lat:number;lon:number};
export type FeatureFrame={center:FeaturePoint;heading:number;branches:FeaturePoint[][];routeIn?:FeaturePoint[];incomingBranchIndex?:number|null};
export type FeatureRow={pair:{modelInput:{candidate:FeatureFrame;target:FeatureFrame}};signatures:number[][][];entryIndex?:number|null;targetEntryIndex?:number|null};
const RAD=Math.PI/180,DEG=180/Math.PI,TAU=2*Math.PI,DEPTHS=[2,5,8,12,20];
export const wrap=(x:number)=>Math.atan2(Math.sin(x),Math.cos(x));
const mod=(x:number,m:number)=>{const r=x%m;return r<0?r+m:r===0?0:r};
const sum=(a:number[])=>a.reduce((n,x)=>n+x,0);
function summary(a:number[]){if(!a.length)return [0,0,0,0];const mean=sum(a)/a.length;return [Math.min(...a),mean,Math.max(...a),Math.sqrt(sum(a.map(x=>(x-mean)**2))/a.length)]}
export function featureDistance(a:FeaturePoint,b:FeaturePoint){const lat1=a.lat*RAD,lat2=b.lat*RAD,h=Math.sin((lat2-lat1)/2)**2+Math.cos(lat1)*Math.cos(lat2)*Math.sin((b.lon-a.lon)*RAD/2)**2;return 12742000*Math.asin(Math.min(1,Math.sqrt(h)))}
export function matchBranches(a:number[][],b:number[][]){
 if(!a.length||!b.length)throw Error("Missing signature");
 const cost=a.map(u=>b.map(v=>Math.max(...u.map((x,k)=>Math.abs(wrap(x-v[k])))))),limits=[...new Set(cost.flat())].sort((x,y)=>x-y);
 function assignment(limit:number){return linearAssignment(cost.map(r=>r.map(x=>x<=limit+1e-12?x:1e6)))}
 let lo=0,hi=limits.length-1;
 while(lo<hi){const mid=Math.floor((lo+hi)/2),pairs=assignment(limits[mid]);if(pairs.every(([i,j])=>cost[i][j]<=limits[mid]+1e-12))hi=mid;else lo=mid+1}
 return {pairs:assignment(limits[lo]),bottleneck:limits[lo]};
}
// Python round(x, 10), including binary half-even cases used by branch sort ties.
const roundBuffer=new DataView(new ArrayBuffer(8));
function round10(x:number){
 if(x===0)return x;
 roundBuffer.setFloat64(0,Math.abs(x));const bits=roundBuffer.getBigUint64(0),exponent=Number(bits>>52n)-1023-52;
 let numerator=((bits&((1n<<52n)-1n))+(1n<<52n))*10000000000n,denominator=1n;
 if(exponent>=0)numerator<<=BigInt(exponent);else denominator<<=BigInt(-exponent);
 let q=numerator/denominator;const twice=2n*(numerator%denominator);if(twice>denominator||twice===denominator&&q%2n===1n)q++;
 return (x<0?-1:1)*Number(q)/1e10;
}
function compare(a:number[],b:number[]){for(let i=0;i<Math.min(a.length,b.length);i++){if(a[i]<b[i])return -1;if(a[i]>b[i])return 1}return a.length-b.length}
function canonicalBranches(frame:FeatureFrame,signature:number[][],entry:number|null|undefined){
 const keys=frame.branches.map((branch,i)=>[...signature[i],...branch.flatMap(p=>[round10(p.lat-frame.center.lat),round10(p.lon-frame.center.lon)])]);
 const order=signature.map((_,i)=>i).sort((a,b)=>compare(keys[a],keys[b])),e=entry==null?-1:order.indexOf(entry);
 return {signature:order.map(i=>signature[i]),paths:order.map(i=>frame.branches[i]),entry:e<0?null:e};
}
function geometry(frame:FeatureFrame,paths:FeaturePoint[][]){
 return paths.map(path=>{
  const lengths=path.slice(1).map((b,i)=>featureDistance(path[i],b)),length=sum(lengths),angles:number[]=[],radii:number[]=[];
  for(const depth of DEPTHS){
   let remaining=Math.min(depth,length),point=path.at(-1)!;
   for(let i=0;i<lengths.length;i++){const a=path[i],b=path[i+1],meters=lengths[i];if(meters&&remaining<=meters){const fraction=remaining/meters;point={lat:a.lat+(b.lat-a.lat)*fraction,lon:a.lon+(b.lon-a.lon)*fraction};break}remaining-=meters}
   const east=(point.lon-frame.center.lon)*Math.cos((point.lat+frame.center.lat)/2*RAD),north=point.lat-frame.center.lat;
   angles.push(wrap(Math.atan2(east,north)-frame.heading));radii.push(Math.hypot((point.lon-frame.center.lon)*111320*Math.cos(frame.center.lat*RAD),north*111320));
  }
  return {length,angles,radii};
 });
}
function baseFeatures(signatures:number[][][]){
 const histograms=signatures.map(signature=>[0,1].flatMap(depth=>{
  const bins=Array(24).fill(0);for(const branch of signature){const position=mod(branch[depth]+Math.PI,TAU)/TAU*24,index=Math.floor(position),fraction=position-index;bins[index%24]+=1-fraction;bins[(index+1)%24]+=fraction}return bins;
 }));
 const [a,b]=histograms;return [signatures[0].length,signatures[1].length,Math.abs(signatures[0].length-signatures[1].length),...a,...b,...a.map((x,i)=>Math.abs(x-b[i]))];
}
function quadrants(sign:number[][],depth:number){const counts=Array(4).fill(0);for(const v of sign){const i=Math.trunc(mod(v[depth]+Math.PI/4,TAU)/(Math.PI/2));counts[i]=(counts[i]??0)+1}return counts}
export function featureVector(row:FeatureRow):number[]{
 const frames=[row.pair.modelInput.candidate,row.pair.modelInput.target],entries=[row.entryIndex,row.targetEntryIndex];
 const canonical=frames.map((frame,i)=>canonicalBranches(frame,row.signatures[i],entries[i])),[a,b]=canonical.map(c=>c.signature),{pairs,bottleneck}=matchBranches(a,b);
 const pairFeatures=[Number(a.length===b.length),Math.abs(a.length-b.length),bottleneck*DEG];
 for(let depth=0;depth<2;depth++){
  const delta=pairs.map(([i,j])=>wrap(a[i][depth]-b[j][depth]));
  pairFeatures.push(...summary(delta.map(x=>Math.abs(x)*DEG)),sum(delta.map(Math.sin))/delta.length,sum(delta.map(Math.cos))/delta.length);
  for(const sign of [a,b]){const angles=sign.map(s=>s[depth]).sort((x,y)=>x-y),gaps=angles.map((v,i)=>mod(angles[(i+1)%angles.length]-v,TAU));pairFeatures.push(...summary(gaps.map(x=>x*DEG)))}
  const qa=quadrants(a,depth),qb=quadrants(b,depth);if(qa.length!==qb.length)throw Error("Quadrant shape mismatch");pairFeatures.push(...qa.map((n,i)=>Math.abs(n-qb[i])));
 }
 const geos=frames.map((frame,i)=>geometry(frame,canonical[i].paths)),[ga,gb]=geos,detail:number[]=[];
 for(let f=0;f<2;f++){
  const signature=canonical[f].signature,geo=geos[f],entry=canonical[f].entry;
  detail.push(...summary(geo.map(g=>g.length)),...DEPTHS.map(depth=>geo.filter(g=>g.length>=depth).length/geo.length));
  for(let k=0;k<DEPTHS.length-1;k++){const bends=geo.map(g=>wrap(g.angles[k+1]-g.angles[k])*DEG);detail.push(...summary(bends),...summary(bends.map(Math.abs)))}
  const incoming=entry===null?null:geo[entry];detail.push(Number(entry===null),...(incoming?.angles??[0,0,0,0,0]).flatMap(angle=>[Math.sin(angle),Math.cos(angle)]),incoming?.length??0);
  for(let depth=0;depth<2;depth++){const gaps=entry===null?[]:signature.flatMap((s,i)=>i===entry?[]:[wrap(s[depth]-signature[entry][depth])]);detail.push(...summary(gaps.map(x=>x*DEG)))}
 }
 for(let k=0;k<DEPTHS.length;k++){
  const delta=pairs.map(([i,j])=>Math.abs(wrap(ga[i].angles[k]-gb[j].angles[k])));
  detail.push(...summary(delta.map(x=>x*DEG)),...summary(pairs.map(([i,j],p)=>2*Math.min(ga[i].radii[k],gb[j].radii[k])*Math.sin(delta[p]/2)*2.6)));
 }
 const [ea,eb]=canonical.map(c=>c.entry);
 if(ea!==null&&eb!==null){const restA=a.filter((_,i)=>i!==ea),restB=b.filter((_,i)=>i!==eb),remaining=matchBranches(restA,restB).bottleneck,anchored=Math.max(remaining,...a[ea].map((x,k)=>Math.abs(wrap(x-b[eb][k]))));detail.push(0,anchored*DEG)}else detail.push(1,0);
 const vector=[...baseFeatures(row.signatures),...pairFeatures,...detail];
 if(vector.length!==350||vector.some(x=>!Number.isFinite(x)))throw Error("Invalid 350-feature vector");
 return vector;
}
