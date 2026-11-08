"use client";
import {useEffect,useRef,useState} from "react";
import {SPOT_CATEGORIES} from "../lib/spots/initial-catalog";
import {decodeManagedSpot,parseSpotInput,type ManagedSpot} from "../lib/spots/editing";
export type SpotDraft={id:string;expectedRevision:number;name:string;category:string;lat:string;lon:string;description:string;creating:boolean};
export function draftFor(spot?:ManagedSpot):SpotDraft {
  return spot?{id:spot.id,expectedRevision:spot.revision,name:spot.name,category:spot.category,lat:String(spot.position.lat),lon:String(spot.position.lon),description:spot.description,creating:false}
    :{id:"local-"+crypto.randomUUID(),expectedRevision:0,name:"",category:"",lat:"",lon:"",description:"",creating:true};
}
export default function SpotEditor({draft,onChange,onCancel,onSaved,onBusy,refreshing}:{draft:SpotDraft;onChange:(d:SpotDraft)=>void;onCancel:()=>void;onSaved:(s:ManagedSpot)=>void;onBusy:(busy:boolean)=>void;refreshing:boolean}){
  const [busy,setBusy]=useState(false),[error,setError]=useState(""),[conflict,setConflict]=useState(false);
  const first=useRef<HTMLInputElement>(null),submitting=useRef(false),alive=useRef(true),request=useRef<AbortController|null>(null);
  useEffect(()=>{alive.current=true;first.current?.focus({preventScroll:true});return()=>{alive.current=false;request.current?.abort()}},[]);
  useEffect(()=>{const before=(e:BeforeUnloadEvent)=>{e.preventDefault()};window.addEventListener("beforeunload",before);return()=>window.removeEventListener("beforeunload",before)},[]);
  async function save(e:React.FormEvent){
    e.preventDefault();if(submitting.current||conflict||refreshing)return;
    setError("");
    let input;
    try{input=parseSpotInput({id:draft.id,expectedRevision:draft.expectedRevision,name:draft.name,category:draft.category,description:draft.description,
      position:{lat:draft.lat.trim()?Number(draft.lat):NaN,lon:draft.lon.trim()?Number(draft.lon):NaN}})}
    catch(error){setError(error instanceof Error?error.message:"入力を確認してください。");return}
    submitting.current=true;setBusy(true);onBusy(true);
    const controller=new AbortController();request.current=controller;
    const timer=window.setTimeout(()=>controller.abort(),15000);
    try{
      const response=await fetch("/api/operator/spots",{method:"PUT",headers:{"Content-Type":"application/json"},body:JSON.stringify(input),signal:controller.signal});
      const body:unknown=await response.json();
      if(!response.ok){
        if(response.status===409&&alive.current)setConflict(true);
        const message=body&&typeof body==="object"&&"error" in body&&typeof body.error==="string"?body.error:"保存を確認できませんでした。";
        throw Error(message);
      }
      const saved=decodeManagedSpot(body&&typeof body==="object"&&"spot" in body?body.spot:null);
      if(!saved||saved.id!==draft.id)throw Error("保存結果を確認できませんでした。入力を残したまま再試行してください。");
      if(alive.current)onSaved(saved);
    }catch(error){
      if(alive.current)setError(error instanceof Error&&error.name!=="AbortError"?error.message:"保存を確認できませんでした。同じ内容で再試行できます。");
    }finally{
      window.clearTimeout(timer);request.current=null;submitting.current=false;
      if(alive.current){setBusy(false);onBusy(false)}
    }
  }
  return <section className="spot-editor" data-spot-editor={draft.creating?"new":draft.id} aria-labelledby="spot-editor-title">
    <p className="eyebrow">EDIT SPOT</p><h2 id="spot-editor-title">{draft.creating?"新しいスポットを追加":"スポットを編集"}</h2>
    <p className="spot-detail-note">名称・カテゴリ・施設位置は必須です。地図をクリックすると施設位置を指定できます。</p>
    <form onSubmit={save}>
      <fieldset disabled={busy||conflict||refreshing}>
        <label>名称 <span>必須</span><input ref={first} required maxLength={300} value={draft.name} data-spot-name onChange={e=>onChange({...draft,name:e.target.value})}/></label>
        <label>カテゴリ <span>必須</span><select required value={draft.category} data-spot-category onChange={e=>onChange({...draft,category:e.target.value})}><option value="">選択してください</option>{Object.entries(SPOT_CATEGORIES).map(([id,label])=><option key={id} value={id}>{label}</option>)}</select></label>
        <div className="spot-coordinate-inputs">
          <label>緯度 <span>必須</span><input type="number" step="any" min="35.125" max="35.157" required value={draft.lat} data-spot-lat onChange={e=>onChange({...draft,lat:e.target.value})}/></label>
          <label>経度 <span>必須</span><input type="number" step="any" min="139.608" max="139.638" required value={draft.lon} data-spot-lon onChange={e=>onChange({...draft,lon:e.target.value})}/></label>
        </div>
        <p className="spot-detail-note">三崎・城ヶ島の対象範囲内で指定してください。オレンジ色の丸が保存予定の位置です。入口・道路への接続は別途確認が必要です。</p>
        <label>説明 <span>任意</span><textarea rows={4} maxLength={2000} value={draft.description} data-spot-description onChange={e=>onChange({...draft,description:e.target.value})}/></label>
      </fieldset>
      {error&&<div className="spot-edit-error" role="alert" data-spot-save-error><strong>{conflict?"更新が競合しました":"保存できませんでした"}</strong><p>{error}</p>{conflict&&<p>入力はこの画面に残っています。必要な内容を控え、「編集をやめる」から最新情報を読み直してください。</p>}</div>}
      <div className="spot-edit-actions"><button className="rally-primary-link" type="submit" disabled={busy||conflict||refreshing} data-spot-save>{busy?"保存中…":error&&!conflict?"同じ内容で再試行":draft.creating?"追加して保存":"変更を保存"}</button><button type="button" disabled={busy||refreshing} onClick={onCancel} data-spot-cancel>編集をやめる</button></div>
      <p className="spot-detail-note">保存した変更は、このPCの同じ保存先を使う画面で共有されます。</p>
    </form>
  </section>;
}
