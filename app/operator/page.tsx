import type {Metadata} from "next";
import Link from "next/link";
import SiteHeader from "../site-header";
import OperatorNav from "../operator-nav";
import {RallyFooter} from "../rally-ui";
import {getDraftRepository} from "../../lib/operator/draft-repository";
import {getCourseRepository} from "../../lib/operator/course-repository";
export const runtime="nodejs";export const dynamic="force-dynamic";
export const metadata:Metadata={title:"運営ダッシュボード"};
export default function OperatorHome(){
 let context;let courses;try{context=getDraftRepository().load()}catch{context=null}try{courses=getCourseRepository().list()}catch{courses=null}
 const draft=context?.draft;
 return <main className="participant-main operator-main operator-home" data-operator-page="home">
  <SiteHeader view="operator"/><section id="page-content" tabIndex={-1}>
   <OperatorNav view="home"/>
   <div className="operator-intro"><div><p className="eyebrow">OPERATOR DASHBOARD</p><h1>運営ダッシュボード</h1><p className="participant-lead">地点を選び、道順を確認して、参加者に届ける。</p></div></div>
   <dl className="operator-dashboard-metrics"><div><dt>登録スポット</dt><dd>{context?context.spots.length+"件":"確認待ち"}</dd></div><div><dt>保存したコース</dt><dd>{courses?courses.length+"件":"確認待ち"}</dd></div><div><dt>作成中の下書き</dt><dd>{context?draft?"あり":"未作成":"確認待ち"}</dd></div></dl>
   <div className="operator-dashboard-home">
    <section><p className="eyebrow">CREATE A COURSE</p><h2>{draft?"作成中のコースを続ける":"新しいコースをつくる"}</h2><p>登録済みのスポットから、スタート・ゴール・立ち寄り先を選びます。訪問順を決めたら、ルートとコマを生成できます。</p>
     {draft&&<div className="operator-resume" data-operator-resume><span>作成中のコース</span><strong>{draft.title}</strong><small>保存した地点から再開できます</small></div>}
     {!context&&<p className="operator-status-error" role="alert" data-operator-home-error>下書きとスポット情報を確認できませんでした。作成画面で保存先を確認してください。</p>}
     <Link prefetch={false} className="operator-task-primary operator-dashboard-primary" href="/operator/draft" data-operator-start>{draft?"地点を選ぶ画面へ戻る":"地図から地点を選ぶ →"}</Link>
     <ol className="operator-dashboard-path"><li><b>1 地点を選ぶ</b>地図と一覧から選び、訪問順を決める</li><li><b>2 コマを確認・保存</b>全体地図とコマを見比べて仕上げる</li><li><b>3 参加者へ公開</b>保存版を確認し、公開を設定する</li></ol>
     <p className="operator-start-note">保存しただけでは公開されません。入口・通行・安全性は公開前に現地で確認してください。</p>
    </section>
    <section><div className="operator-recent-heading"><h2>保存したコース</h2><Link prefetch={false} href="/operator/courses">すべて見る →</Link></div>
     {courses===null?<p role="alert">保存済みコースを読み込めませんでした。<a href="/operator/courses">一覧で確認する</a></p>:courses.length?<ul className="operator-recent-courses">{courses.slice(0,4).map(c=><li key={c.id}><Link prefetch={false} href={"/operator/courses/"+c.id}><span><strong>{c.title}</strong><small>{(c.meters/1000).toFixed(2)}km · {c.cards}コマ</small></span><span aria-hidden="true">→</span></Link></li>)}</ul>:<p>コースを確認して保存すると、ここから公開設定へ進めます。</p>}
     <Link prefetch={false} className="operator-dashboard-maintenance" href="/operator/spots"><b>スポットを追加・編集する →</b><span>使いたい場所がないときや、名称・位置を整えたいときに。</span></Link>
     <p>公開停止・再公開・削除は、保存したコースを開いて操作できます。</p>
    </section>
   </div>
  </section><RallyFooter/>
 </main>;
}
