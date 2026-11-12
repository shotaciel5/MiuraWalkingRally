"use client";
import LandmarkIcon from "./landmark-icon";
import LandmarkPhotoPreview from "./landmark-photo-preview";
import {accepted,initialAccepted,type Candidate,type PhotoAsset,type Review} from "../lib/landmarks/model";
const noop=()=>{};
export default function CourseLandmarkPanel({items,photos,review,sequence,onToggle,onReset,onSave,dirty=false,busy=false,error="",notice="",readOnly=false}:{items:Candidate[];photos:Record<string,PhotoAsset>;review:Review;sequence:number;onToggle?:(c:Candidate,value:boolean)=>void;onReset?:()=>void;onSave?:()=>void;dirty?:boolean;busy?:boolean;error?:string;notice?:string;readOnly?:boolean}){
 return <section className="course-landmark-panel" data-course-landmark-panel data-landmark-dirty={dirty}><div className="landmark-candidate-heading"><h3>{readOnly?"保存した目印":"このコマの目印"}</h3>{!readOnly&&<button type="button" disabled={busy} data-course-landmark-reset onClick={onReset}>このコマを初期状態へ</button>}</div>
 <p className="preview-caption">{readOnly?"保存時の採用内容です。下書きや地域データの更新で変わりません。":"一時停止・横断箇所は初期採用。写真と信号等は初期不採用です。階段は必ず表示します。図の目印を押しても採否を切り替えられます（薄い表示は不採用）。写真のない看板は候補に出しません。"}</p>
 <div className="course-landmark-candidates" key={sequence} role="region" aria-label={readOnly?"保存した目印の一覧":"このコマの目印候補"} tabIndex={0} data-course-landmark-scroll>
 {items.length?items.map(c=>{const asset=c.kind==="unique"?photos[c.id.slice(10)]:undefined,checked=readOnly||accepted(review,sequence,c);return <article className={"landmark-candidate "+(checked?"is-accepted":"is-rejected")} key={c.id} data-course-candidate={c.id} data-candidate-kind={c.kind}><div className="landmark-candidate-top"><label>{!readOnly&&<input type="checkbox" data-course-candidate-choice={c.id} checked={checked} disabled={busy} onChange={e=>onToggle?.(c,e.target.checked)}/>}<LandmarkIcon symbol={c.symbol}/><span>{c.label}<small>{c.provider==="osm"?"OSM":"Mapillary"} · {readOnly?"採用済み":"初期"+(initialAccepted(c)?"採用":"不採用")}</small></span></label></div>{asset&&<LandmarkPhotoPreview asset={asset} onReady={noop}/>}<details><summary>出典と確認事項</summary><p>{c.note}</p><a href={c.sourceUrl} target="_blank" rel="noopener noreferrer">地物の出典</a></details></article>}):<p className="preview-caption">{readOnly?"このコマに採用した目印はありません。":"この位置に表示できる候補はありません。"}</p>}
 </div>
 {!readOnly&&<div className="course-landmark-actions"><button type="button" data-course-landmarks-save disabled={busy||!dirty} onClick={onSave}>{busy?"保存しています…":"目印の採用を保存"}{dirty?" *":""}</button><p className="preview-caption">採用を保存した後、上の「この結果を保存」でコースを固定します。</p></div>}
 <div aria-live="polite">{error&&<p role="alert" data-course-landmark-error>{error}</p>}{notice&&<p role="status" data-course-landmark-notice>{notice}</p>}</div></section>;
}
