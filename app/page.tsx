import Link from "next/link";
import SiteHeader from "./site-header";
import {ArrowIcon,DemoBadge,DemoNotice,RallyArtwork,RallyFacts,RallyFooter,WalkingEstimateNote} from "./rally-ui";
import {getDemoRally} from "../lib/demo-rally";

export default function RallyList(){
  const rally=getDemoRally();
  return <main id="main-content" className="participant-main" data-participant-page="list">
    <SiteHeader/>
    <section className="participant-intro" id="page-content" tabIndex={-1} aria-labelledby="list-title">
      <div><p className="eyebrow">MIURA WALKING RALLY</p><h1 id="list-title">三浦のまちを、<br/>ひとコマずつ。</h1><p className="participant-lead">港とまちを、コマ地図でたどるウォーキングラリー。<br className="desktop-break"/>まずは開発中のコースをご覧ください。</p></div>
      <div className="intro-stamp" aria-hidden="true"><span>海 と ま ち</span><strong>歩</strong><span>MIURA</span></div>
    </section>
    <DemoNotice/>
    <section className="rally-catalog" aria-labelledby="catalog-title">
      <div className="catalog-heading"><div><p className="eyebrow">COURSE</p><h2 id="catalog-title">コース一覧</h2></div><span>1コース · 開発用</span></div>
      <article className="rally-list-card" aria-labelledby="demo-rally-title" data-rally-card={rally.id}>
        <RallyArtwork/>
        <div className="rally-list-content">
          <div className="rally-card-topline"><span className="rally-area">{rally.area}</span><DemoBadge/></div>
          <h3 id="demo-rally-title">{rally.title}</h3><p className="rally-subtitle">{rally.subtitle}</p>
          <p className="rally-description">{rally.description}</p>
          <RallyFacts rally={rally}/>
          <p className="rally-origin"><span>スタート・ゴール</span><strong>{rally.stops[0].name}</strong></p>
          <div className="rally-tags"><span>周回コース</span>{rally.hasSteps&&<span>階段区間の候補あり</span>}</div>
          <Link className="rally-primary-link" href={rally.href} data-rally-detail-link={rally.id}>コースの詳細を見る<ArrowIcon/></Link>
          <WalkingEstimateNote/>
        </div>
      </article>
    </section>
    <section className="koma-explainer" aria-labelledby="about-koma-title"><span className="explainer-mark" aria-hidden="true">歩</span><div><h2 id="about-koma-title">ひとコマずつ、道を読み解く。</h2><p>交差点や分岐を切り出した「コマ地図」を手がかりに進むラリーです。コースの公開に向けて、道順や目印を確認しています。</p></div></section>
    <RallyFooter/>
  </main>;
}
