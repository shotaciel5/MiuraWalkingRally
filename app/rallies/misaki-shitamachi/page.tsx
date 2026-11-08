import type {Metadata} from "next";
import Link from "next/link";
import SiteHeader from "../../site-header";
import ParticipationPanel from "../../participation-panel";
import {ArrowIcon,DemoBadge,DemoNotice,RallyArtwork,RallyFacts,RallyFooter,WalkingEstimateNote} from "../../rally-ui";
import {getDemoRally} from "../../../lib/demo-rally";

export const metadata:Metadata={title:"三崎下町さんぽ（開発用）",description:"三崎港周辺から海南神社・光念寺・本瑞寺をめぐる固定コースの概要と地点順を確認できます。開発用・未公開のデモです。"};

export default function RallyDetail(){
  const rally=getDemoRally();
  return <main id="main-content" className="participant-main" data-participant-page="detail" data-rally-id={rally.id}>
    <SiteHeader/>
    <nav className="rally-breadcrumb" aria-label="パンくずリスト"><Link href="/">コース一覧</Link><span aria-hidden="true">/</span><span aria-current="page">{rally.title}</span></nav>
    <section className="rally-detail-hero" id="page-content" tabIndex={-1} aria-labelledby="rally-title">
      <div><p className="eyebrow">MISAKI / COURSE 01</p><DemoBadge/><h1 id="rally-title">{rally.title}</h1><p className="rally-detail-subtitle">{rally.subtitle}</p><p className="rally-detail-description">{rally.description}</p></div>
      <RallyArtwork compact/>
    </section>
    <DemoNotice/>
    <div className="rally-detail-layout">
      <div>
        <ParticipationPanel rally={{id:rally.id, revision:rally.revision, checkpointIds:rally.checkpointIds, title:rally.title, href:rally.href}}/>
        <section className="participant-panel" aria-labelledby="course-stops-title" id="course-stops">
          <p className="eyebrow">COURSE PREVIEW</p><h2 id="course-stops-title">地点順のプレビュー</h2><p className="participant-note">地点と順番は開発用の想定です。施設の入口や、立ち止まれる場所は確認待ちです。</p>
          <ol className="participant-stop-list">{rally.stops.map((stop,i)=><li key={stop.id} data-rally-stop={stop.id}><span className="participant-stop-marker" aria-hidden="true">{i===0?"S":i===rally.stops.length-1?"G":String(i)}</span><div><span className="participant-stop-role">{stop.role}</span><h3>{stop.name}</h3><p>{stop.description}</p></div></li>)}</ol>
        </section>
        <section className="participant-panel participation-panel" aria-labelledby="participation-title">
          <p className="eyebrow">BEFORE YOU JOIN</p><h2 id="participation-title">参加条件と確認中の内容</h2>
          <dl className="participation-conditions"><div><dt>参加受付</dt><dd>開発用デモの開始を試せます。一般向けの参加受付は行っていません。</dd></div><div><dt>チェックポイントの判定</dt><dd>デモ用ボタンで達成記録を試せます。実際の到着判定は未対応です。</dd></div><div><dt>ゴール・特典</dt><dd>達成条件と特典の内容は未定です。</dd></div><div><dt>道順の確認</dt><dd>入口・横断・階段や通路の利用条件を確認する必要があります。</dd></div></dl>
        </section>
      </div>
      <aside className="participant-panel rally-summary" aria-labelledby="summary-title">
        <p className="eyebrow">AT A GLANCE</p><h2 id="summary-title">コースの目安</h2><RallyFacts rally={rally}/><WalkingEstimateNote/>
        <dl className="rally-summary-list"><div><dt>エリア</dt><dd>{rally.area}</dd></div><div><dt>スタート・ゴール</dt><dd>{rally.stops[0].name}</dd></div><div><dt>道順の特徴</dt><dd>港に戻る周回の想定です。{rally.hasSteps?"階段区間の候補を含みます。":""}</dd></div></dl>
        <Link href="/" className="rally-secondary-link" data-rally-back-link><ArrowIcon back/>コース一覧へ戻る</Link>
      </aside>
    </div>
    <Link href="/" className="rally-secondary-link rally-bottom-back" data-rally-bottom-back><ArrowIcon back/>コース一覧へ戻る</Link>
    <RallyFooter/>
  </main>;
}
