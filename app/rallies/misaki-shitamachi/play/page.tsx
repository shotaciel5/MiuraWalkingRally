import type {Metadata} from "next";
import Link from "next/link";
import SiteHeader from "../../../site-header";
import ParticipationPanel from "../../../participation-panel";
import {DemoBadge, DemoNotice, RallyFooter} from "../../../rally-ui";
import {getDemoRally} from "../../../../lib/demo-rally";

export const metadata: Metadata = {title: "デモの開始 | 三崎下町さんぽ"};

export default function DemoParticipation() {
  const rally = getDemoRally();
  return <main id="main-content" className="participant-main participation-page" data-participant-page="play">
    <SiteHeader/>
    <nav className="rally-breadcrumb" aria-label="パンくずリスト"><Link href="/">コース一覧</Link><span aria-hidden="true">/</span><Link href={rally.href}>{rally.title}</Link><span aria-hidden="true">/</span><span aria-current="page">デモの開始</span></nav>
    <section id="page-content" tabIndex={-1} className="participation-heading" aria-labelledby="play-title"><p className="eyebrow">MISAKI / DEMO</p><DemoBadge/><h1 id="play-title">{rally.title}</h1><p className="participant-lead">このタブで、デモの開始状態を確かめる。</p></section>
    <DemoNotice/>
    <ParticipationPanel rally={{id:rally.id, revision:rally.revision, title:rally.title, href:rally.href}} view="play"/>
    <Link href={rally.href} className="rally-secondary-link" data-demo-detail>コース詳細へ戻る</Link>
    <RallyFooter/>
  </main>;
}
