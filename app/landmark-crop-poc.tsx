"use client";
import {useEffect,useRef,useState} from "react";
import {cropPixels,containCrop,type CropPercent} from "../lib/landmark-crop";
const sizes=[32,48,64];
export default function LandmarkCropPoc(){
 const [crop,setCrop]=useState<CropPercent>({left:62,top:2,width:35,height:29}),[dimensions,setDimensions]=useState({width:0,height:0}),[failed,setFailed]=useState(false);
 const image=useRef<HTMLImageElement>(null),canvases=useRef<(HTMLCanvasElement|null)[]>([]);
 // A cached image can finish loading before React attaches its load handler.
 useEffect(()=>{const loaded=image.current;if(loaded?.complete){if(loaded.naturalWidth>0)setDimensions({width:loaded.naturalWidth,height:loaded.naturalHeight});else setFailed(true)}},[]);
 const box=dimensions.width?cropPixels(crop,dimensions.width,dimensions.height):null;
 useEffect(()=>{
  if(!image.current||!box)return;
  for(const [i,size]of sizes.entries()){const canvas=canvases.current[i],context=canvas?.getContext("2d");if(!canvas||!context)continue;context.clearRect(0,0,size,size);context.imageSmoothingEnabled=true;context.imageSmoothingQuality="high";const fit=containCrop(box.width,box.height,size);context.drawImage(image.current,box.left,box.top,box.width,box.height,fit.left,fit.top,fit.width,fit.height)}
 },[box?.left,box?.top,box?.width,box?.height]);
 return <section className="landmark-crop-poc" data-crop-poc>
  <div className="landmark-poc-section-heading"><div><p className="eyebrow">LOCAL IMAGE EXPERIMENT</p><h2>看板を小さくすると、見分けられるか。</h2></div><span className="landmark-poc-badge">手動領域 → 自動切り出し</span></div>
  <p>提供済みの写真で、領域を指定した後の切り出しと縮小を試します。物体認識やMapillary取得は行っていません。地図上の位置が分からないため、コマ図へは配置しません。</p>
  <div className="landmark-crop-grid"><div className="landmark-crop-photo"><img ref={image} src="/mainphotos/shitamati.jpg" alt="提供済みの三崎の街路写真。上部の看板を切り出す手動サンプル" onLoad={e=>setDimensions({width:e.currentTarget.naturalWidth,height:e.currentTarget.naturalHeight})} onError={()=>setFailed(true)}/>{box&&<div className="landmark-crop-box" style={{left:box.left/dimensions.width*100+"%",top:box.top/dimensions.height*100+"%",width:box.width/dimensions.width*100+"%",height:box.height/dimensions.height*100+"%"}} aria-hidden="true"/>}</div>
   <div>{failed?<p role="alert">参考写真を読み込めませんでした。</p>:<><fieldset className="landmark-crop-inputs"><legend>手動で選ぶ領域（%）</legend>{(["left","top","width","height"] as const).map(key=><label key={key}>{{left:"左",top:"上",width:"幅",height:"高さ"}[key]}<input type="number" min={0} max={100} step={1} value={crop[key]} data-crop-input={key} onChange={e=>setCrop(s=>({...s,[key]:Math.max(0,Math.min(100,Number(e.target.value)))}))}/></label>)}</fieldset><div className="landmark-crop-results">{sizes.map((size,i)=><figure key={size}><div className="landmark-crop-icon"><canvas ref={element=>{canvases.current[i]=element}} width={size} height={size} role="img" aria-label={size+"pxの看板候補。手動領域からの切り出しで、位置未確認"} data-crop-size={size}/></div><figcaption>{size}px</figcaption></figure>)}</div><p className="participant-note">写真の縦横比を保って縮小します。色や輪郭が目印になるかを比べる段階で、看板の文字を読めることや現地での見分けやすさは未検証です。</p></>}</div>
  </div><p className="landmark-poc-source">素材：ユーザー提供の public/mainphotos/shitamati.jpg。処理はブラウザ内のみで、アップロード・保存や外部API呼出しは行いません。</p>
 </section>;
}
