import sharp from "sharp";
import {cropPixels} from "../../lib/landmark-crop.ts";
export const CROP_SIZE=128,CROP_VERSION=1;
export async function prepareCrop(bytes,roi){
 const source=sharp(bytes,{limitInputPixels:4000000,failOn:"error"}),meta=await source.metadata();
 if(!meta.width||!meta.height)throw Error("invalid-image");
 const box=cropPixels(roi,meta.width,meta.height);
 return source.extract(box).resize(CROP_SIZE,CROP_SIZE,{fit:"contain",background:{r:0,g:0,b:0,alpha:0},kernel:"lanczos3"}).png({compressionLevel:9,adaptiveFiltering:true}).toBuffer();
}
