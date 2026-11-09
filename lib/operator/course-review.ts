type Branch={entry:"candidate"|"excluded"|"review";exit:"candidate"|"excluded"|"review"};
type ReviewSource={
 visits:readonly {spotId:string}[];
 cards:readonly {
  map:{sequence:number;state:"ready"|"held";shortGeometry?:unknown;issues:readonly string[]};
  candidate:{branches:readonly Branch[];issues:readonly string[]};
 }[];
};
export type ReviewReason="held"|"short"|"review-branch"|"excluded-branch"|"source";
export const REVIEW_REASON_LABELS:Record<ReviewReason,string>={
 held:"図の確認待ち",short:"近接分岐・拡大確認","review-branch":"保留の枝あり","excluded-branch":"対象外の枝あり",source:"元データ・図の注意"
};
// Read only saved observations. A missing flag is never evidence of field safety.
export function summarizeCourseReview(course:ReviewSource){
 const items=course.cards.flatMap((card,index)=>{
  const reasons:ReviewReason[]=[];
  if(card.map.shortGeometry)reasons.push("short");
  else if(card.map.state==="held")reasons.push("held");
  if(card.candidate.branches.some(b=>b.entry==="review"||b.exit==="review"))reasons.push("review-branch");
  if(card.candidate.branches.some(b=>b.entry==="excluded"||b.exit==="excluded"))reasons.push("excluded-branch");
  if(card.candidate.issues.length||(card.map.state==="ready"&&card.map.issues.length))reasons.push("source");
  return reasons.length?[{index,sequence:card.map.sequence,reasons}]:[];
 });
 return {
  visits:course.visits.length,spots:new Set(course.visits.map(v=>v.spotId)).size,total:course.cards.length,items,
  held:items.filter(x=>x.reasons.includes("held")).length,
  short:items.filter(x=>x.reasons.includes("short")).length,
  branches:items.filter(x=>x.reasons.includes("review-branch")||x.reasons.includes("excluded-branch")).length
 };
}
