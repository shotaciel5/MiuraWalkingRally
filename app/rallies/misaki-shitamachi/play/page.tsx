import type {Metadata} from "next";
import Link from "next/link";
import SiteHeader from "../../../site-header";
import ParticipationPanel from "../../../participation-panel";
import {DemoBadge, DemoNotice, RallyFooter} from "../../../rally-ui";
import {getParticipantCourse} from "../../../../lib/participant-course";

export const metadata: Metadata = {title: "コマ地図デモ | 三崎下町さんぽ"};

export default function DemoParticipation() {
  const course = getParticipantCourse(), rally = course.rally;
  return <main id="main-content" className="participant-main participation-page participant-navigation-page" data-participant-page="play">
    <SiteHeader/>
    <nav className="rally-breadcrumb" aria-label="パンくずリスト"><Link href="/">コース一覧</Link><span aria-hidden="true">/</span><Link href={rally.href}>{rally.title}</Link><span aria-hidden="true">/</span><span aria-current="page">コマ地図デモ</span></nav>
    <section id="page-content" tabIndex={-1} className="participation-heading" aria-labelledby="play-title"><p className="eyebrow">MISAKI / DEMO</p><DemoBadge/><h1 id="play-title">{rally.title}</h1><p className="participant-lead">ひとコマずつ、道と目印を読み解く。</p></section>
    <DemoNotice/>
    <ParticipationPanel rally={rally} view="play" course={course}/>
    <Link href={rally.href} className="rally-secondary-link" data-demo-detail>コース詳細へ戻る</Link>
    <RallyFooter/>
  </main>;
}
