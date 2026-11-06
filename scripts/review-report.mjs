import { createMisakiReviewPoc } from "../lib/misaki-review.ts";
const p=createMisakiReviewPoc();
console.log(JSON.stringify({
  algorithm:"Dijkstra on fixed walking graph; fixed stop order; junction extraction; local projection and rotation; no generative AI",
  source:p.source,contextSource:p.contextSource,signsSource:p.signsSource,
  route:{meters:p.route.meters,minutes:p.route.minutes,stops:p.route.stops,legs:p.route.legs},
  generated:p.koma,reference:p.referenceKoma,
},null,2));
