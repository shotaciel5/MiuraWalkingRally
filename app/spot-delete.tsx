"use client";
import {useEffect,useRef,useState} from "react";
import type {ManagedSpot} from "../lib/spots/editing";
import {parseSpotDeletion,type SpotDeletion} from "../lib/spots/deletion";
import {SPOT_CATEGORIES} from "../lib/spots/initial-catalog";
export default function SpotDelete({spot,refreshing,onCancel,onDeleted,onRefresh}:{spot:ManagedSpot;refreshing:boolean;onCancel:()=>void;onDeleted:(d:SpotDeletion)=>void;onRefresh:()=>Promise<boolean>}){
  const dialog=useRef<HTMLDialogElement>(null),cancel=useRef<HTMLButtonElement>(null),submitting=useRef(false),alive=useRef(true),request=useRef<AbortController|null>(null);
  const [busy,setBusy]=useState(false),[error,setError]=useState(""),[conflict,setConflict]=useState(false);
  useEffect(()=>{
    alive.current=true;const element=dialog.current;
    if(element&&!element.open)element.showModal();cancel.current?.focus();
    return()=>{alive.current=false;request.current?.abort();element?.close()};
  },[]);
  async function remove(){
    if(submitting.current||conflict||refreshing)return;
    submitting.current=true;setBusy(true);setError("");
    const controller=new AbortController();request.current=controller;
    const timer=window.setTimeout(()=>controller.abort(),15000);
    try{
      const response=await fetch("/api/operator/spots",{method:"DELETE",headers:{"Content-Type":"application/json"},body:JSON.stringify({id:spot.id,expectedRevision:spot.revision}),signal:controller.signal});
      const body:unknown=await response.json();
      if(!response.ok){
        if((response.status===409||response.status===404)&&alive.current)setConflict(true);
        throw Error(body&&typeof body==="object"&&"error" in body&&typeof body.error==="string"?body.error:"削除を確認できませんでした。");
      }
      const deleted=parseSpotDeletion(body&&typeof body==="object"&&"deleted" in body?body.deleted:null);
      if(deleted.id!==spot.id||deleted.deletedFromRevision!==spot.revision)throw Error("削除結果を確認できません。同じ対象で再試行してください。");
      if(alive.current)onDeleted(deleted);
    }catch(error){
      if(alive.current)setError(error instanceof Error&&error.name!=="AbortError"?error.message:"削除を確認できません。同じ対象で再試行してください。");
    }finally{
      window.clearTimeout(timer);request.current=null;submitting.current=false;if(alive.current)setBusy(false);
    }
  }
  return <dialog className="spot-delete-dialog" ref={dialog} aria-labelledby="spot-delete-title" aria-describedby="spot-delete-description" data-spot-delete-dialog={spot.id} onCancel={event=>{event.preventDefault();if(!busy&&!refreshing)onCancel()}}>
    <p className="eyebrow">DELETE SPOT</p><h2 id="spot-delete-title">このスポットを削除しますか？</h2>
    <div className="spot-delete-target"><strong data-delete-target-name>{spot.name}</strong><span>{SPOT_CATEGORIES[spot.category]} · {spot.position.lat.toFixed(6)}, {spot.position.lon.toFixed(6)}</span><small>{spot.id}</small></div>
    <p id="spot-delete-description">一覧と地図から外し、今後のコース候補には表示しません。初期データを読み直しても復活しません。</p>
    <p className="spot-detail-note">保存・公開済みコースの内容は保持されます。作業中の下書きで使っている場合は、削除後に地点を選び直してください。</p>
    <p className="spot-detail-note">削除済みとして記録を保持します。この画面からの復元・完全消去には対応していません。</p>
    {error&&<div className="spot-edit-error" role="alert" data-spot-delete-error><strong>{conflict?"削除対象を確認し直してください":"削除を確認できませんでした"}</strong><p>{error}</p>{conflict&&<button type="button" disabled={busy||refreshing} onClick={async()=>{if(!await onRefresh()&&alive.current)setError("最新の台帳を読み込めませんでした。削除せずに再試行してください。")}} data-delete-refresh>{refreshing?"読込み中…":"最新の台帳を読み込む"}</button>}</div>}
    {refreshing&&<p role="status">最新の台帳を読み込んでいます…</p>}
    <div className="spot-delete-actions"><button ref={cancel} type="button" disabled={busy||refreshing} onClick={onCancel} data-spot-delete-cancel>キャンセル</button><button type="button" className="spot-delete-confirm" disabled={busy||conflict||refreshing} onClick={remove} data-spot-delete-confirm>{busy?"削除中…":error&&!conflict?"同じ対象で再試行":"削除する"}</button></div>
  </dialog>;
}
