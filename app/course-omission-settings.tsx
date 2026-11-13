"use client";
import {useRef} from "react";
import type {OmissionMode} from "../lib/route/omission/selection";
export default function CourseOmissionSettings({mode,onChange,total,shown,disabled=false,saved=false,hybridAvailable=false,failureCount=0}:{mode:OmissionMode;onChange:(mode:OmissionMode)=>void;total:number;shown:number;disabled?:boolean;saved?:boolean;hybridAvailable?:boolean;failureCount?:number}){
 const dialog=useRef<HTMLDialogElement>(null);
 const options:OmissionMode[]=hybridAvailable?["hybrid","rule","all"]:["rule","all"];
 const label=(value:OmissionMode)=>value==="hybrid"?"道なりを省略（標準・AI補助）":value==="rule"?hybridAvailable?"ルールのみで比較":"道なりを省略（保存時のルール）":"全交差点を表示";
 return <div className="course-omission-controls" data-omission-mode={mode}><span>{saved?"確認用 · ":""}{shown} / {total}コマを表示{mode==="hybrid"?" · AI補助あり":mode==="rule"?" · ルールによる省略":""}{mode==="hybrid"&&failureCount>0?" · AI判定は確認待ち":""}</span><button type="button" data-omission-open onClick={()=>dialog.current?.showModal()}>{saved?"省略設定を確認":"コマの省略を編集"}</button>
 <dialog className="course-omission-dialog" aria-labelledby="course-omission-title" ref={dialog} onClick={e=>{if(e.target===e.currentTarget)dialog.current?.close()}}><div className="landmark-candidate-heading"><h2 id="course-omission-title">コマの省略設定</h2><button type="button" data-omission-close onClick={()=>dialog.current?.close()}>閉じる</button></div>
 <p>道なりが明確な交差点を省略し、次のコマと紛らわしい交差点は残します。チェックポイント・折り返し・確認待ちの図・目印を編集したコマは省略しません。</p>
 <fieldset disabled={disabled}><legend>表示するコマ</legend>{options.map(value=><label key={value}><input type="radio" name="course-omission-mode" value={value} checked={mode===value} data-omission-option={value} onChange={()=>onChange(value)}/><span><strong>{label(value)}</strong><small>{value==="hybrid"?"学習モデルで省略候補を再確認し、紛らわしい地点を追加で残します。":value==="rule"?"道路形状のルールで残すコマを確認します。":"省略候補も含め、元の全コマを確認します。"}</small></span></label>)}</fieldset>
 {mode==="hybrid"&&failureCount>0&&<p role="status" data-hybrid-unavailable>一部のAI判定を確認できないため、該当するコマは残しています。</p>}
 <p>{saved?"この切替は確認用です。保存済みコース・参加者の表示は変更しません。":"選択した表示方法を「この結果を保存」でコースに固定し、参加者へ公開します。"}</p><p className="preview-caption">実際の入口・通行・道なりの分かりやすさは現地確認が必要です。全交差点表示へいつでも戻せます。</p>
 </dialog></div>;
}
