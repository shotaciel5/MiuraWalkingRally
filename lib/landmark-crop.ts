export type CropPercent={left:number;top:number;width:number;height:number};
export function cropPixels(crop:CropPercent,imageWidth:number,imageHeight:number){
 if(!Number.isInteger(imageWidth)||!Number.isInteger(imageHeight)||imageWidth<1||imageHeight<1||!Object.values(crop).every(Number.isFinite))throw new RangeError("Invalid image dimensions or crop");
 const left=Math.max(0,Math.min(imageWidth-1,Math.round(crop.left/100*imageWidth))),top=Math.max(0,Math.min(imageHeight-1,Math.round(crop.top/100*imageHeight)));
 return {left,top,width:Math.max(1,Math.min(imageWidth-left,Math.round(crop.width/100*imageWidth))),height:Math.max(1,Math.min(imageHeight-top,Math.round(crop.height/100*imageHeight)))};
}
export function containCrop(width:number,height:number,size:number){
 if(![width,height,size].every(n=>Number.isFinite(n)&&n>0))throw new RangeError("Invalid crop size");
 const scale=Math.min(size/width,size/height),w=width*scale,h=height*scale;
 return {left:(size-w)/2,top:(size-h)/2,width:w,height:h};
}
