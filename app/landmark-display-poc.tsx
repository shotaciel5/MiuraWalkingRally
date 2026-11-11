"use client";
import {useState} from "react";
import type {ReviewCard} from "../lib/misaki-review";
import OperatorKomaDisplay from "./operator-koma-display";
import {isVisualLandmark,visualLandmarks,type SymbolLimit} from "../lib/route/visual-landmarks";
import {planLandmarkCache} from "../lib/landmark-cache-plan";
import LandmarkCropPoc from "./landmark-crop-poc";

export default function LandmarkDisplayPoc({cards}:{cards:ReviewCard[]}){
 const [index,setIndex]=useState(()=>Math.max(0,cards.findIndex(c=>c.map.state==="ready"&&c.context.landmarks.some(isVisualLandmark)))),[limit,setLimit]=useState<SymbolLimit>(2),[cacheLimit,setCacheLimit]=useState(5);
 const card=cards[index],selection=visualLandmarks(card.context,card.map.branches,limit),plan=planLandmarkCache(cards,cacheLimit);
 return <div data-landmark-poc data-poc-sequence={card.map.sequence} data-poc-symbol-limit={limit}>
  <section className="landmark-poc-controls">
   <label>比較するコマ<select data-landmark-poc-select value={index} onChange={e=>setIndex(Number(e.target.value))}>{cards.map((c,i)=><option key={i} value={i}>コマ {c.map.sequence}{c.map.state==="held"?"（図は確認待ち）":""}</option>)}</select></label>
   <fieldset><legend>記号の上限（仮）</legend>{([1,2,3] as const).map(n=><button type="button" key={n} data-symbol-limit={n} aria-pressed={limit===n} onClick={()=>setLimit(n)}>{n}個</button>)}</fieldset>
   <div className="landmark-poc-next"><button type="button" disabled={!index} data-poc-prev onClick={()=>setIndex(i=>i-1)}>← 前</button><span>{index+1} / {cards.length}</span><button type="button" disabled={index===cards.length-1} data-poc-next onClick={()=>setIndex(i=>i+1)}>次 →</button></div>
  </section>
  <div className="landmark-compare-grid">{([{mode:"source",title:"現在の表示",text:"建物形状・名称を含む比較用の表示。",badge:"比較元"},{mode:"symbols",title:"認識できる記号だけ",text:"建物形状と名称を省き、信号・明示された止まれ標識・バス停から少数を選択。",badge:"検証案"},{mode:"roads",title:"道と進行方向のみ",text:"目印がない場合の読みやすさを比べる。",badge:"最小表示"}] as const).map(({mode,title,text,badge})=><section className="landmark-compare-card" key={mode} data-compare-mode={mode}><div className="landmark-compare-heading"><span>{badge}</span><h2>{title}</h2></div><div className="landmark-compare-figure"><OperatorKomaDisplay map={card.map} context={card.context} referenceContext={null} name="目印の表示比較" layers={{buildings:true,landmarks:true,details:true}} presentation={mode} symbolLimit={limit} minimal/></div><p>{text}</p></section>)}</div>
  <div className="landmark-poc-summary" data-poc-summary><p>元の記録 {card.context.landmarks.length}件 → 種類/位置の条件に合う候補 {selection.eligibleCount}件 → 通常図で置ける記号 {card.map.state==="held"?0:selection.placements.length}件。元の角度・枝・進行方向は3案共通です。</p><p>階段は記号案に道路上の情報として残します。制御点だけの「一時停止」や施設分類から、現物の標識・鳥居・看板を推測しません。OSMの記録であり、現地の見え方は未確認です。</p><details><summary>省いた理由を確認する</summary><ul>{selection.omitted.map((item,i)=><li key={i}>{item.id}：{{"not-physical-evidence":"この案の現物記号の対象外","invalid-position":"位置の表示条件外","near-duplicate":"近接する候補と重複","no-clear-space":"道を隠さずに置ける余白なし",limit:"表示数の上限"}[item.reason]}</li>)}</ul></details></div>

  <section className="landmark-cache-plan" data-cache-plan>
   <div className="landmark-poc-section-heading"><div><p className="eyebrow">PREPARE ONCE, REUSE</p><h2>重要な交差点から、事前に準備する。</h2></div><span className="landmark-poc-badge">取得計画の試算 · 実取得0件</span></div>
   <p>同じ地点の再訪をまとめ、枝の多さ・近い角度・近接分岐を目安に優先順位を付けます。画像の有無や有効性を確認した順位ではありません。</p>
   <label className="landmark-plan-limit">今回準備する交差点の上限<select data-cache-limit value={cacheLimit} onChange={e=>setCacheLimit(Number(e.target.value))}>{[3,5,10,20].map(n=><option key={n} value={n}>{n}地点</option>)}</select></label>
   <dl className="landmark-plan-facts"><div><dt>比較元のコマ</dt><dd>{plan.courseCards}枚</dd></div><div><dt>重要交差点候補</dt><dd>{plan.candidates.length}地点</dd></div><div><dt>今回の選択</dt><dd data-cache-selected>{plan.selected.length}地点</dd></div><div><dt>進入方向の枠</dt><dd data-cache-views>{plan.viewSlots}方向</dd></div></dl>
   <p className="participant-note">1方向あたり最大2枚の閲覧候補を探すと仮定した例では、上限{plan.exampleImageCeiling}枚。保存するのは採用した小さい切り出し画像と出典等で、全画像を集める想定ではありません。この枚数は3D測位に十分な撮影条件を意味しません。</p>
   <div className="landmark-plan-table-wrap"><table className="landmark-plan-table"><thead><tr><th>交差点</th><th>対応コマ</th><th>優先理由</th><th>進入方向</th></tr></thead><tbody>{plan.selected.map(j=><tr key={j.nodeId} data-cache-target={j.nodeId}><td>OSM {j.nodeId}</td><td>{j.sequences.join("・")}</td><td>{j.reasons.join(" / ")}</td><td>{j.approaches.length||1}方向</td></tr>)}</tbody></table></div>
   <div className="landmark-offline-flow"><span>事前：取得候補を絞る</span><b aria-hidden="true">→</b><span>画像処理・位置/見え方の確認</span><b aria-hidden="true">→</b><span>採用した目印を保存</span><b aria-hidden="true">→</b><span>コマ生成：保存済みを参照</span></div>
   <p className="participant-note">撮影カメラの座標を、看板やモニュメントの座標として扱いません。同じ交差点でも進入方向で見える面が違うため、方向別の候補と出典を保持する案です。今回は取得・保存機能を実装せず、既存コース/DBも変更しません。</p>
  </section>

  <LandmarkCropPoc/>
  <section className="landmark-poc-next-step"><h2>Mapillary・画像認識の次の検証</h2><p>まず数交差点で画像の有無・撮影日・進入方向を確認し、検出された対象が現地で役立つかを確かめます。看板の固有性、モニュメントの検出、対象物の位置、切り出し後の読みやすさは別の評価項目です。</p><p>この画面にMapillary画像/認識結果は含まれていません。参加者向け表示への採用、画像/メタデータの保存条件、認識モデルと保存量は、比較結果と利用条件を確認してから決めます。</p></section>
 </div>;
}
