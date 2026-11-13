export const WALKING_SPEED_KMH=3;
export function walkingMinutes(meters:number){
 if(!Number.isFinite(meters)||meters<0)throw new Error("Walking distance must be finite and nonnegative");
 return meters/(WALKING_SPEED_KMH*1000/60);
}
