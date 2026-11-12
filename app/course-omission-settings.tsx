"use client";
import {useRef} from "react";
import type {OmissionMode} from "../lib/route/omission/selection";
export default function CourseOmissionSettings({mode,onChange,total,shown,disabled=false,saved=false}:{mode:OmissionMode;onChange:(mode:OmissionMode)=>void;total:number;shown:number;disabled?:boolean;saved?:boolean}){
 const dialog=useRef<HTMLDialogElement>(null);
 return <div className="course-omission-controls" data-omission-mode={mode}><span>{shown} / {total}コマを表示{mode==="rule"?" · 道なりを省略":""}</span><button type="button" data-omission-open onClick={()=>dialog.current?.showModal()}>{saved?"省略設定を確認":"コマの省略を編集"}</button>
 <dialog className="course-omission-dialog" ref={dialog} onClick={e=>{if(e.target===e.currentTarget)dialog.current?.close()}}><div className="landmark-candidate-heading"><h2>コマの省略設定</h2><button type="button" data-omission-close onClick={()=>dialog.current?.close()}>閉じる</button></div>
 <p>道なりが明確な交差点を省略し、次のコマと紛らわしい交差点は残します。チェックポイント・折り返し・確認待ちの図・目印を編集したコマは省略しません。</p>
 <fieldset disabled={disabled}><legend>表示するコマ</legend>{(["rule","all"] as const).map(value=><label key={value}><input type="radio" name="course-omission-mode" value={value} checked={mode===value} data-omission-option={value} onChange={()=>onChange(value)}/><span><strong>{value==="rule"?"道なりを省略（標準）":"全交差点を表示"}</strong><small>{value==="rule"?"移動に必要なコマへ絞って確認します。":"省略候補も含め、元の全コマを確認します。"}</small></span></label>)}</fieldset>
 <p>{saved?"この切替は確認用です。保存済みコース・参加者の表示は変更しません。":"選択した表示方法を「この結果を保存」でコースに固定し、参加者へ公開します。"}</p><p className="preview-caption">実際の入口・通行・道なりの分かりやすさは現地確認が必要です。全交差点表示へいつでも戻せます。</p>
 </dialog></div>;
}
