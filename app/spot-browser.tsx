"use client";
import {useCallback,useEffect,useMemo,useRef,useState} from "react";
import {decodeManagedSpot,type ManagedSpot} from "../lib/spots/editing";
import SpotDelete from "./spot-delete";
import type {SpotDeletion} from "../lib/spots/deletion";
import type {FixedCourseUse} from "../lib/spots/fixed-course-usage";
import SpotEditor,{draftFor,type SpotDraft} from "./spot-editor";
import {SPOT_CATEGORIES} from "../lib/spots/initial-catalog";
import {AREA_LABELS,DEFAULT_FILTERS,ROUTING_LABELS,SPOT_GROUPS,filterSpots,groupFor,visibleSelection,type SpotFilters,type SpotGroup} from "../lib/spots/browser-view";
import SpotMap from "./spot-map";
export default function SpotBrowser({spots:initialSpots,courseUses}:{spots:ManagedSpot[];courseUses:FixedCourseUse[]}){
  const [spots,setSpots]=useState(initialSpots),[draft,setDraft]=useState<SpotDraft|null>(null),[busy,setBusy]=useState(false),[notice,setNotice]=useState("");
  const [refreshing,setRefreshing]=useState(false),[deleteTarget,setDeleteTarget]=useState<ManagedSpot|null>(null);
  const locked=!!draft||!!deleteTarget;
  async function cancel(){
    if(busy||refreshing)return false;setRefreshing(true);setNotice("");
    try{
      const response=await fetch("/api/operator/spots",{cache:"no-store",signal:AbortSignal.timeout(15000)});
      const body:unknown=await response.json();
      const values=body&&typeof body==="object"&&"spots" in body&&Array.isArray(body.spots)?body.spots:null;
      const decoded=values?.map(decodeManagedSpot);
      if(!response.ok||!decoded||decoded.some(s=>!s)||new Set(decoded.map(s=>s!.id)).size!==decoded.length)throw Error();
      setSpots(decoded as ManagedSpot[]);setDraft(null);setDeleteTarget(null);setBusy(false);setNotice("最新の情報を読み込みました。");return true;
    }catch{setNotice("最新情報を読み込めませんでした。入力は残っています。再試行してください。");return false}finally{setRefreshing(false)}
  }
  function saved(spot:ManagedSpot){
    setSpots(before=>before.some(s=>s.id===spot.id)?before.map(s=>s.id===spot.id?spot:s):[...before,spot]);
    setFilters({...DEFAULT_FILTERS,mode:"all"});setSelectedId(spot.id);setDraft(null);setBusy(false);setNotice("スポットを保存しました。");
  }
  const [filters,setFilters]=useState<SpotFilters>(DEFAULT_FILTERS),[selectedId,setSelectedId]=useState<string|null>(null);
  const visible=useMemo(()=>filterSpots(spots,filters),[spots,filters]),selected=visibleSelection(visible,selectedId);
  const list=useRef<HTMLUListElement>(null);
  useEffect(()=>{
    const parent=list.current;if(!parent)return;
    const button=[...parent.querySelectorAll<HTMLElement>("[data-spot-list-id]")].find(e=>e.dataset.spotListId===selected?.id);
    if(!button)return;const p=parent.getBoundingClientRect(),b=button.getBoundingClientRect();
    if(b.top<p.top)parent.scrollTop-=p.top-b.top;else if(b.bottom>p.bottom)parent.scrollTop+=b.bottom-p.bottom;
  },[selected?.id]);
  const select=useCallback((id:string)=>{if(!locked)setSelectedId(id)},[locked]);
  useEffect(()=>{if(selectedId&&!visible.some(s=>s.id===selectedId))setSelectedId(null)},[visible,selectedId]);
  const groups=Object.keys(SPOT_GROUPS) as SpotGroup[];
  const modeSpots=useMemo(()=>filterSpots(spots,{...DEFAULT_FILTERS,mode:filters.mode}),[spots,filters.mode]);
  return <div data-spot-browser data-visible-count={visible.length} data-selected-spot={selected?.id??""}>
    <div className="spot-catalog-actions"><p>まちの立ち寄り先を、少しずつ育てる。</p><button type="button" className="rally-primary-link" disabled={locked} data-spot-add onClick={()=>{setDraft(draftFor());setNotice("")}}>＋ スポットを追加</button></div>
    {deleteTarget&&<SpotDelete key={deleteTarget.id} spot={deleteTarget} uses={courseUses.filter(use=>use.spotId===deleteTarget.id)} refreshing={refreshing} onCancel={()=>setDeleteTarget(null)} onRefresh={cancel} onDeleted={(deleted:SpotDeletion)=>{setSpots(before=>before.filter(s=>s.id!==deleted.id));setSelectedId(null);setDeleteTarget(null);setNotice(deleted.name+"を削除しました。")}}/>}
    {notice&&<p className="spot-save-notice" role="status" data-spot-notice>{notice}</p>}
    {refreshing&&<p role="status">最新のスポット情報を読み込んでいます…</p>}
    <fieldset disabled={locked} className="spot-filter-lock"><div className="spot-filters">
      <div className="spot-filter-top">
        <div className="spot-display-modes" aria-label="表示する候補">
          <button type="button" aria-pressed={filters.mode==="demo"} data-spot-mode="demo" onClick={()=>setFilters(f=>({...f,mode:"demo"}))}>デモ表示 <span>{filterSpots(spots,DEFAULT_FILTERS).length}</span></button>
          <button type="button" aria-pressed={filters.mode==="all"} data-spot-mode="all" onClick={()=>setFilters(f=>({...f,mode:"all"}))}>全候補 <span>{spots.length}</span></button>
        </div>
        <label className="spot-search"><span>スポット名</span><input type="search" placeholder="名前で探す" value={filters.query} data-spot-search onChange={e=>setFilters(f=>({...f,query:e.target.value}))}/></label>
        <label className="spot-area"><span>エリア</span><select value={filters.area} data-spot-area onChange={e=>setFilters(f=>({...f,area:e.target.value as SpotFilters["area"]}))}><option value="all">すべてのエリア</option>{Object.entries(AREA_LABELS).map(([id,label])=><option key={id} value={id}>{label}</option>)}</select></label>
      </div>
      <div className="spot-group-filters" aria-label="ジャンルで絞り込む">
        <button type="button" aria-pressed={filters.group==="all"} data-spot-group="all" onClick={()=>setFilters(f=>({...f,group:"all"}))}>すべて <small>{modeSpots.length}</small></button>
        {groups.map(id=><button key={id} type="button" aria-pressed={filters.group===id} data-spot-group={id} onClick={()=>setFilters(f=>({...f,group:id}))}><span className="spot-group-glyph" style={{color:SPOT_GROUPS[id].color}} aria-hidden="true">{SPOT_GROUPS[id].glyph}</span>{SPOT_GROUPS[id].label}<small>{modeSpots.filter(s=>groupFor(s.category)===id).length}</small></button>)}
      </div>
    </div>
    </fieldset><div className="spot-result-heading"><p aria-live="polite"><strong data-spot-count>{visible.length}</strong> 件を表示 <span>／ 登録済み {spots.length} 件（初期データ178件）</span></p><button type="button" disabled={locked} onClick={()=>{setFilters(DEFAULT_FILTERS);setSelectedId(null)}} data-spot-reset>表示条件をリセット</button></div>
    <div className="spot-workspace">
      <div className="spot-map-column">
        <SpotMap spots={visible} selectedId={selected?.id??null} onSelect={select} draftPosition={draft?{lat:draft.lat.trim()?Number(draft.lat):NaN,lon:draft.lon.trim()?Number(draft.lon):NaN}:null} onPosition={draft&&!busy&&!refreshing?point=>setDraft({...draft,lat:point.lat.toFixed(7),lon:point.lon.toFixed(7)}):null}/>
        {draft?<SpotEditor key={draft.id} draft={draft} onChange={setDraft} onCancel={cancel} onSaved={saved} onBusy={setBusy} refreshing={refreshing}/>:
        <section className="spot-detail-panel" aria-labelledby="spot-detail-title" data-spot-detail={selected?.id??""}>
          <p className="eyebrow">SPOT DETAILS</p>
          {selected?<><div className="spot-detail-heading"><h2 id="spot-detail-title" aria-live="polite">{selected.name}</h2><button type="button" onClick={()=>setSelectedId(null)} data-clear-spot>選択を解除</button></div>
            <p className="spot-detail-category">{SPOT_CATEGORIES[selected.category]} <span>· {AREA_LABELS[selected.area]}</span></p>
            <p className="spot-routing-state" data-routing-state={selected.routing.state}>{ROUTING_LABELS[selected.routing.state]}</p>
            <p className="spot-detail-note">{selected.routing.state==="poc-reference"?"既存コースで使う仮の到達点に対応しています。入口・通行・現地の安全性は未確認です。":selected.routing.state==="outside-road-snapshot"?"周辺の道路データと、徒歩で到達する位置の確認が必要です。":"施設の代表点は道路データの範囲内です。入口や道路への接続は確認待ちです。"}</p>
            <dl className="spot-location-facts"><div><dt>施設の代表位置</dt><dd>{selected.position.lat.toFixed(6)}, {selected.position.lon.toFixed(6)}</dd></div><div><dt>位置の種類</dt><dd>{selected.position.kind==="operator"?"運営者が指定した位置":selected.position.kind==="node"?"OSMの地点座標":"地物の範囲の中心（概算）"}</dd></div></dl>
            <p className="spot-detail-note">営業状況・営業時間・立入り条件は確認待ちです。この位置は入口や安全な待機場所を示しません。</p>
            {selected.description&&<p className="spot-description" data-spot-detail-description>{selected.description}</p>}
            {selected.revision>0&&<p className="spot-detail-note">運営者による{selected.source?"編集":"追加"}あり · <time dateTime={selected.updatedAt!}>{new Date(selected.updatedAt!).toLocaleString("ja-JP",{timeZone:"Asia/Tokyo"})}</time></p>}
            {selected.source?<a className="spot-source-link" href={selected.source.url} target="_blank" rel="noopener noreferrer">OSMの元データを見る <span aria-hidden="true">↗</span></a>:<p className="spot-detail-note">運営者が追加したスポットです。</p>}
            <button type="button" className="spot-edit-open" data-spot-edit onClick={()=>{setDraft(draftFor(selected));setNotice("")}}>このスポットを編集</button>
            <button type="button" className="spot-delete-open" data-spot-delete-open onClick={()=>{setDeleteTarget(selected);setNotice("")}}>このスポットを削除</button>
          </>:<><h2 id="spot-detail-title">気になるスポットを選択</h2><p className="spot-detail-note">地図のピンや右の一覧を選ぶと、ジャンル・代表位置・到達点の確認状態を表示します。</p></>}
        </section>}
      </div>
      <section className="spot-list-panel" aria-labelledby="spot-list-title"><div className="spot-list-heading"><h2 id="spot-list-title">スポット一覧</h2><span>{visible.length} 件</span></div>
        {visible.length?<ul className="spot-result-list" ref={list}>{visible.map(spot=>{const g=SPOT_GROUPS[groupFor(spot.category)];return <li key={spot.id}><button type="button" className={selected?.id===spot.id?"is-selected":""} aria-pressed={selected?.id===spot.id} data-spot-list-id={spot.id} disabled={locked} onClick={()=>select(spot.id)}><span className="spot-list-glyph" style={{color:g.color}} aria-hidden="true">{g.glyph}</span><span className="spot-list-copy"><strong>{spot.name}</strong><small>{SPOT_CATEGORIES[spot.category]} · {AREA_LABELS[spot.area]}</small><span className="spot-list-state">{ROUTING_LABELS[spot.routing.state]}</span></span><span aria-hidden="true" className="spot-list-arrow">↗</span></button></li>})}</ul>:<div className="spot-empty" role="status" data-spot-empty><strong>条件に合う候補がありません</strong><p>ジャンルやエリアを変えるか、「全候補」でも探してみてください。</p></div>}
        <p className="spot-list-note">選択は位置・情報の閲覧です。コースへの追加は後続の機能です。</p>
      </section>
    </div>
    <details className="spot-data-notes"><summary>データと表示について</summary><p>デモ表示は初期候補から選んだ24件のうち、削除済みを除いたものです。地域・ジャンルを分けた開発用の表示例です。観光の推奨や安全確認の完了を示しません。全候補へ切り替えると初期178件と追加したスポットのうち、削除済みを除いた候補から探せます。</p><p>初期候補は2026年11月8日取得の固定データです。運営者の編集・追加はPC上のSQLiteへ保存します。エリアは便宜上の区分で、行政境界ではありません。営業・入口・通行の確認は全件未実施です。</p><p>背景地図はOpenStreetMapの現在の配信画像を使うためネット接続が必要です。固定候補や既存道路データとは更新時点が異なります。コマ地図やルート生成の道路データは変更していません。</p></details>
  </div>;
}
