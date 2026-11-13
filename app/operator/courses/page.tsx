import type {Metadata} from "next";
import SiteHeader from "../../site-header";
import OperatorNav from "../../operator-nav";
import {RallyFooter} from "../../rally-ui";
import {getCourseRepository} from "../../../lib/operator/course-repository";
export const runtime="nodejs";export const dynamic="force-dynamic";
export const metadata:Metadata={title:"保存済みコース（運営者向け）"};
export default function CoursesPage(){
 let courses;try{courses=getCourseRepository().list()}catch{courses=null}
 return <main className="participant-main operator-main" data-operator-page="courses"><SiteHeader view="operator"/><section id="page-content" tabIndex={-1}><OperatorNav view="courses"/>
 <div className="operator-intro"><div><p className="eyebrow">SAVED COURSES</p><h1>保存したコースを確認・公開する</h1><p className="participant-lead">公開したいコースを開き、内容と現地の状況を確認して参加者へ届けましょう。</p></div></div>
 {courses!==null&&courses.length>0&&<div className="preview-actions"><a className="operator-task-secondary" href="/operator/draft">次のコースをつくる</a><a className="operator-task-secondary" href="/operator/preview">保存した地点からルートをつくる</a></div>}
 {courses===null?<section className="preview-panel" role="alert" data-course-list-error><h2>保存済みコースを読み込めませんでした</h2><p>保存ファイルの形式・内容を確認してください。記録を空に置き換えていません。</p><a className="operator-task-secondary" href="/operator/courses">再試行する</a></section>:courses.length===0?<section className="preview-panel operator-empty-state" data-course-list-empty><p className="eyebrow">YOUR FIRST COURSE</p><h2>まだ保存済みコースはありません</h2><p>登録済みスポットを選んで、最初のコースをつくりましょう。ルートとコマを確認して保存すると、ここから公開できます。</p><a className="operator-task-primary" href="/operator/draft">最初のコースをつくる →</a><p className="preview-caption">地点を選ぶ → ルート・コマを確認 → 保存して公開</p></section>:<><p className="operator-action-hint">コースを選ぶと、コマの確認と公開設定を開けます。保存と公開は別の操作です。現在の公開状態はコースを開いて確認できます。</p><ol className="saved-course-list" data-course-list>{courses.map(c=><li key={c.id}><a href={"/operator/courses/"+c.id} data-saved-course-link={c.id}><h2>{c.title}</h2><p><time dateTime={c.createdAt}>{new Date(c.createdAt).toLocaleString("ja-JP",{timeZone:"Asia/Tokyo"})}</time> 保存</p><dl><div><dt>道路上の距離</dt><dd>{Math.round(c.meters).toLocaleString("ja-JP")}m</dd></div><div><dt>コマ数</dt><dd>{c.cards}枚</dd></div></dl><p className="preview-caption">近接分岐の拡大対象 {c.nearby}件・その他の図の保留 {c.held}件</p><small>保存済み・現地未確認</small><span className="operator-course-open">コマを確認・公開する →</span></a></li>)}</ol></>}
 </section><RallyFooter/></main>;
}
