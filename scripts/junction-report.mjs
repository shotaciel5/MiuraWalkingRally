import { createMisakiJunctionPoc } from "../lib/misaki-junctions.ts";
const { junctions, referenceJunctions, source } = createMisakiJunctionPoc();
const summarize = analysis => ({
  pathNodeCount: analysis.pathNodeCount, candidateCount: analysis.candidates.length,
  uniqueCandidateNodes: new Set(analysis.candidates.map(c => c.nodeId)).size,
  totalMeters: analysis.totalMeters,
  candidates: analysis.candidates,
});
console.log(JSON.stringify({
  source: {
    attribution: source.attribution, copyrightUrl: source.copyrightUrl,
    license: source.license, licenseUrl: source.licenseUrl,
    snapshotSha256: source.snapshotSha256, osmBaseTimestamp: source.osmBaseTimestamp,
  },
  conditions: {
    bearing: "North=0, clockwise; branch/departure outward, arrival reversed from incoming arm",
    relative: "Arrival travel direction=0; clockwise positive; [-180,180)",
    distance: "Along route from this occurrence to next candidate/arrival; no rounding",
    fieldValidation: "Unverified; source topology is not proof of physical access",
  },
  generated: summarize(junctions),
  reference: summarize(referenceJunctions),
}, null, 2));
