import Link from "next/link";
import SiteHeader from "./site-header";
import {RallyFooter,WalkingEstimateNote} from "./rally-ui";
import {PublishedBadge,PublishedFacts,PublishedNotice,PublishedUnavailable,PublishedAttribution,LegacyDemoLink} from "./published-ui";
import {getPublicationRepository} from "../lib/operator/publication-repository";
export const runtime="nodejs";export const dynamic="force-dynamic";
export default function RallyList(){
 let courses;try{courses=getPublicationRepository().list()}catch{courses=null}
 return <main id="main-content" className="participant-main" data-participant-page="list">
  <SiteHeader/><section className="participant-intro" id="page-content" tabIndex={-1} aria-labelledby="list-title"><div><p className="eyebrow">MIURA WALKING RALLY</p><h1 id="list-title">三浦のまちを、<br/>ひとコマずつ。</h1><p className="participant-lead">公開されたコースを選び、道と目印をたどりましょう。</p></div><div className="intro-stamp" aria-hidden="true"><span>海 と ま ち</span><strong>歩</strong><span>MIURA</span></div></section>
  <PublishedNotice/><section className="rally-catalog" aria-labelledby="catalog-title"><div className="catalog-heading"><div><p className="eyebrow">COURSES</p><h2 id="catalog-title">公開コース</h2></div>{courses&&<span data-published-course-count={courses.length}>{courses.length}コース</span>}</div>
   {courses===null?<PublishedUnavailable/>:courses.length===0?<section className="participant-panel" data-published-empty><h3>公開されているコースはまだありません</h3><p>公開後に、この一覧からコースを選べます。</p></section>:<div className="published-catalog" data-published-catalog>{courses.map(rally=><article className="published-card" key={rally.id} data-published-card={rally.id}><div className="rally-card-topline"><span className="rally-area">{rally.area}</span><PublishedBadge/></div><h3>{rally.title}</h3><PublishedFacts rally={rally}/><dl className="published-endpoints"><div><dt>スタート</dt><dd>{rally.startName}</dd></div><div><dt>終了地点</dt><dd>{rally.finishName}</dd></div></dl><p className="participant-note">チェックポイント {rally.checkpointIds.length}地点{rally.isLoop?" · 周回コース":""}</p><Link className="rally-primary-link" href={rally.href} data-published-detail-link={rally.id}>コースの詳細を見る →</Link><WalkingEstimateNote/></article>)}</div>}
  </section><LegacyDemoLink/><PublishedAttribution/><RallyFooter/>
 </main>;
}
