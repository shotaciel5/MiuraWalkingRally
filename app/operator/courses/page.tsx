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
 <div className="operator-intro"><div><p className="eyebrow">OPERATOR / SAVED COURSES</p><h1>保存済みコース</h1><p className="participant-lead">保存時のルート・コマ・目印を確認できます。参加者への掲載は詳細画面で操作します。現地未確認です。</p></div></div>
 <div className="preview-actions"><a href="/operator/draft">作業中の下書きへ</a><a href="/operator/preview">現在の下書きから生成する</a></div>
 {courses===null?<section className="preview-panel" role="alert" data-course-list-error><h2>保存済みコースを読み込めませんでした</h2><p>保存ファイルの形式・内容を確認してください。記録を空に置き換えていません。</p><a href="/operator/courses">再試行する</a></section>:courses.length===0?<section className="preview-panel" data-course-list-empty><h2>まだ保存済みコースはありません</h2><p>下書きから生成し、プレビューの「この結果を保存」を選んでください。</p></section>:<ol className="saved-course-list" data-course-list>{courses.map(c=><li key={c.id}><a href={"/operator/courses/"+c.id} data-saved-course-link={c.id}><h2>{c.title}</h2><p><time dateTime={c.createdAt}>{new Date(c.createdAt).toLocaleString("ja-JP",{timeZone:"Asia/Tokyo"})}</time> 保存</p><dl><div><dt>道路上の距離</dt><dd>{Math.round(c.meters).toLocaleString("ja-JP")}m</dd></div><div><dt>コマ数</dt><dd>{c.cards}枚</dd></div></dl><p>近接分岐の拡大対象 {c.nearby}件・その他の図の保留 {c.held}件</p><small>保存済み・現地未確認</small></a></li>)}</ol>}
 </section><RallyFooter/></main>;
}
