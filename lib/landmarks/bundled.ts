import manifest from "../../public/demo-landmarks/v1/manifest.json" with {type:"json"};
import type {TargetCache,PhotoAsset} from "./model.ts";
export type LandmarkBundle={version:1;id:string;targets:TargetCache[];photos:{asset:PhotoAsset;path:string;sha256:string;bytes:number}[]};
// Versioned, read-only seed; fresh API results remain in the separate writable cache.
export function getBundledLandmarks():LandmarkBundle{return manifest as unknown as LandmarkBundle}
