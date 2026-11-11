// A bounded reader for the polygon subset of the Mapbox Vector Tile 2.x format.
// Coordinates stay top-down, as used by the source image; no geographic conversion.
type Field={id:number;value:number|Uint8Array};
function integer(bytes:Uint8Array,cursor:{i:number}){let value=0,factor=1;for(let n=0;n<8;n++){if(cursor.i>=bytes.length)throw Error("Truncated vector geometry");const b=bytes[cursor.i++];value+=(b&127)*factor;if(b<128){if(!Number.isSafeInteger(value))throw Error("Geometry overflow");return value}factor*=128}throw Error("Invalid geometry integer")}
function fields(bytes:Uint8Array){const result:Field[]=[],c={i:0};while(c.i<bytes.length){const tag=integer(bytes,c),wire=tag&7,id=Math.floor(tag/8);if(!id)throw Error("Invalid geometry field");if(wire===0)result.push({id,value:integer(bytes,c)});else if(wire===2){const size=integer(bytes,c);if(size>bytes.length-c.i)throw Error("Truncated geometry field");result.push({id,value:bytes.slice(c.i,c.i+size)});c.i+=size}else if(wire===1||wire===5){c.i+=wire===1?8:4;if(c.i>bytes.length)throw Error("Truncated geometry value")}else throw Error("Unsupported geometry field")}return result}
export function detectionCrop(base64:string){
 if(typeof base64!=="string"||base64.length>50000||!base64.length||!/^[A-Za-z0-9+/]*={0,2}$/.test(base64))throw Error("Invalid detection geometry");
 const bytes=Uint8Array.from(Buffer.from(base64,"base64")),polygons:{x:number;y:number}[]=[];
 for(const layer of fields(bytes).filter(f=>f.id===3&&f.value instanceof Uint8Array)){
  const ls=fields(layer.value as Uint8Array),extent=ls.find(f=>f.id===5)?.value??4096,version=ls.find(f=>f.id===15)?.value??1;
  if(typeof extent!=="number"||extent<1||extent>65536||version!==2)throw Error("Unsupported detection extent/version");
  for(const feature of ls.filter(f=>f.id===2&&f.value instanceof Uint8Array)){
   const fs=fields(feature.value as Uint8Array);if(fs.find(f=>f.id===3)?.value!==3)continue;
   for(const geometry of fs.filter(f=>f.id===4&&f.value instanceof Uint8Array)){
    const g=geometry.value as Uint8Array,c={i:0};let x=0,y=0;
    while(c.i<g.length){const command=integer(g,c),kind=command&7,count=Math.floor(command/8);if(!count||count>10000)throw Error("Invalid geometry command");if(kind===7)continue;if(kind!==1&&kind!==2)throw Error("Unsupported polygon command");for(let i=0;i<count;i++){const dx=integer(g,c),dy=integer(g,c);x+=(dx%2?-(dx+1)/2:dx/2);y+=(dy%2?-(dy+1)/2:dy/2);if(x<0||y<0||x>extent||y>extent)throw Error("Detection outside image");polygons.push({x:x/extent,y:y/extent});if(polygons.length>10000)throw Error("Detection too complex")}}
   }
  }
 }
 if(polygons.length<3)throw Error("Missing polygon");
 const left=Math.min(...polygons.map(p=>p.x)),right=Math.max(...polygons.map(p=>p.x)),top=Math.min(...polygons.map(p=>p.y)),bottom=Math.max(...polygons.map(p=>p.y));
 if(right-left<.002||bottom-top<.002||right-left>.8||bottom-top>.8)throw Error("Detection crop not useful");
 return {left:left*100,top:top*100,width:(right-left)*100,height:(bottom-top)*100};
}
