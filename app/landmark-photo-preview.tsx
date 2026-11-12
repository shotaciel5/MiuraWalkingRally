"use client";
import {useEffect,useRef,useState} from "react";
import type {PhotoAsset} from "../lib/landmarks/model";
export default function LandmarkPhotoPreview({asset,onReady}:{asset:PhotoAsset;onReady:(id:string,url:string)=>void}){
 const [failed,setFailed]=useState(false),crop=asset.crop,source=useRef<HTMLImageElement>(null);
 useEffect(()=>{if(crop&&source.current?.complete&&source.current.naturalWidth)onReady(asset.featureId,crop.path)},[asset.featureId,crop?.path,onReady]);
 return <div className="landmark-real-photo" data-real-photo={asset.featureId}>
 {crop?<img ref={source} data-prepared-crop width={128} height={128} src={crop.path} alt="Mapillaryの検出領域から事前生成した128×128の切り抜き。現地未確認" onLoad={()=>onReady(asset.featureId,crop.path)} onError={()=>setFailed(true)}/>:<p>切り抜き画像は未収録です。</p>}
 <div><p>事前生成した切り抜き · 128×128</p><small>{asset.capturedAt?new Date(asset.capturedAt).toLocaleDateString("ja-JP",{timeZone:"Asia/Tokyo"}):"撮影日不明"} · {asset.creator}</small>
 <p className="landmark-photo-credit"><a href={"https://www.mapillary.com/app/?pKey="+asset.imageId} target="_blank" rel="noopener noreferrer">元画像 / Mapillary</a> · <a href={"https://www.mapillary.com/app/user/"+encodeURIComponent(asset.creator)} target="_blank" rel="noopener noreferrer">撮影者：{asset.creator}</a> · <a href="https://creativecommons.org/licenses/by-sa/4.0/" target="_blank" rel="noopener noreferrer">CC BY-SA 4.0（切り抜き・縮小）</a></p>
 <details><summary>切り抜きの根拠</summary><p>元画像ID：{asset.imageId}<br/>検出領域：左 {asset.roi.left.toFixed(2)}%・上 {asset.roi.top.toFixed(2)}%・幅 {asset.roi.width.toFixed(2)}%・高さ {asset.roi.height.toFixed(2)}%。縦横比を保ち、余白を付けて128×128へ変換しています。元の写真は出典リンクから確認できます。</p></details>
 {failed&&<p role="alert">同梱の切り抜き画像を読めませんでした。</p>}</div></div>;
}
