"use client";
import {useMemo} from "react";
import {summarizeCourseReview,REVIEW_REASON_LABELS} from "../lib/operator/course-review";
type Props={data:Parameters<typeof summarizeCourseReview>[0];selected:number;onSelect:(index:number)=>void};
export default function CourseReviewPanel({data,selected,onSelect}:Props){
 const review=useMemo(()=>summarizeCourseReview(data),[data]);
 return <section className="preview-panel course-review" aria-labelledby="course-review-title" data-course-review>
  <h2 id="course-review-title">確認する箇所</h2>
  <p>保存時の情報から確認箇所をまとめています。現地の入口・通行・安全性と、全{review.total}コマの読みやすさを確認してください。</p>
  <dl className="course-review-counts">
   <div><dt>施設と道路上の到達点</dt><dd data-review-count="spots">{review.spots}施設・{review.visits}訪問</dd><a href="#preview-order-title">訪問順と候補を見る</a></div>
   <div><dt>図の確認待ち</dt><dd data-review-count="held">{review.held}コマ</dd></div>
   <div><dt>近接分岐・拡大確認</dt><dd data-review-count="short">{review.short}コマ</dd></div>
   <div><dt>保留・対象外の枝を含む</dt><dd data-review-count="branches">{review.branches}コマ</dd></div>
  </dl>
  <p className="preview-caption">枝の判定は交差点ごとの情報です。近接分岐は拡大図と30m参照図を確認してください。件数が0でも現地確認は必要です。</p>
  {review.items.length?<details data-review-details><summary>該当コマを見る（{review.items.length} / {review.total}コマ）</summary><p className="preview-caption">複数の注意があるコマは1行にまとめています。再訪するコマは通過順に残します。</p>
   <ol className="course-review-items">{review.items.map(item=><li key={item.index}><button type="button" data-review-card={item.index} aria-pressed={selected===item.index} onClick={()=>onSelect(item.index)}><strong>コマ #{item.sequence}</strong><span>{item.reasons.map(r=>REVIEW_REASON_LABELS[r]).join(" ／ ")}</span></button></li>)}</ol>
  </details>:<p data-review-empty>保存データに上記の注意を持つコマはありません。全コマと到達点の確認を続けてください。</p>}
  <p className="preview-caption">この一覧は確認箇所の案内です。確認結果の記録や公開可否の判定は行っていません。</p>
 </section>;
}
