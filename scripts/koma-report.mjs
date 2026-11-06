import { createMisakiKomaPoc } from "../lib/misaki-koma.ts";
const poc=createMisakiKomaPoc();
const summarize=cards=>({
  count:cards.length,
  ready:cards.filter(c=>c.map.state==="ready").length,
  held:cards.filter(c=>c.map.state==="held").map(c=>({sequence:c.map.sequence,issues:c.map.issues})),
  cards:cards.map(c=>({...c.map,stops:c.stops.map(s=>({id:s.id,name:s.name}))})),
});
console.log(JSON.stringify({
  source:{attribution:poc.source.attribution,copyrightUrl:poc.source.copyrightUrl,license:poc.source.license,licenseUrl:poc.source.licenseUrl,snapshotSha256:poc.source.snapshotSha256},
  conditions:{orientation:"incoming branch below; departure up at start",branches:"source geometry, at most 30 m, stop at next junction/end",distance:"along route to next koma; no occurrence omitted",validation:"local source consistency only; field accuracy and safety unverified"},
  generated:summarize(poc.koma),
  reference:summarize(poc.referenceKoma),
},null,2));
