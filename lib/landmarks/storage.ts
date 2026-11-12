export * from "./local-storage.ts";
import {createLandmarkStorage,landmarkDirectory} from "./local-storage.ts";
import {getBundledLandmarks,bundledTarget} from "./bundled.ts";
import type {PhotoFailure} from "./model.ts";
export function createBundledLandmarkStorage(directory=landmarkDirectory()){const local=createLandmarkStorage(directory),bundle=getBundledLandmarks();return {...local,bundleId:bundle.id,target:bundledTarget,asset:(id:string)=>structuredClone(bundle.photos.find(p=>p.asset.featureId===id)?.asset??null),image:(id:string)=>{const p=bundle.photos.find(p=>p.asset.featureId===id);return p?{meta:structuredClone(p.asset),path:p.path}:null},photoFailure:(_id:string):PhotoFailure|null=>null}}

export const getLandmarkStorage=()=>createBundledLandmarkStorage();
