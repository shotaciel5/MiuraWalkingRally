export const HYBRID_VERSION="kyoto-hybrid-geometry-guard:miura-v1" as const;
export const HYBRID_MODEL=Object.freeze({sha256:"14cdee63223ecd402627d65e414c5c811051af91381b88855f14db333ecab9f6",featureVersion:"junction-correspondence-entry-curve-v1:D",keepThreshold:.2,maxAngleDegrees:30} as const);
export type HybridReason="current-rule-keep"|"ai-geometry-guard"|"omit-candidate"|"invalid-geometry"|"incoming-branch-unknown"|"inference-unavailable";
export type HybridPrediction={decision:"keep"|"omit";reason:HybridReason;keepScore:number|null;maxAngleDegrees:number|null;counts:[number,number]|null};
export type HybridEvidence=HybridPrediction&{targetSequence:number};
