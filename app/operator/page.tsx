import type {Metadata} from "next";
import Image from "next/image";
import Link from "next/link";
import SiteHeader from "../site-header";
import OperatorNav from "../operator-nav";
import ExperienceIcon from "../experience-icon";
import {ArrowIcon,RallyFooter} from "../rally-ui";
import {getDraftRepository} from "../../lib/operator/draft-repository";
import type {RallyDraft} from "../../lib/operator/rally-draft";
export const runtime="nodejs";
export const dynamic="force-dynamic";
export const metadata:Metadata={title:"コースをつくる"};

export default function OperatorHome(){
 let draft:RallyDraft|null=null,unavailable=false;
 try{draft=getDraftRepository().load().draft}catch{unavailable=true}
 return <main className="participant-main operator-main operator-home" data-operator-page="home">
  <SiteHeader view="operator"/><section id="page-content" tabIndex={-1}>
   <OperatorNav view="home"/>
   <div className="operator-welcome operator-task-welcome"><div><p className="eyebrow">YOUR WORKSPACE</p><h1>コースをつくって、<br/>参加者に届けよう。</h1><p className="participant-lead">登録済みのスポットから、行きたい場所を選べます。<br/>まずはスタートとゴールを決めて、道順を見てみましょう。</p>
    {draft&&<div className="operator-resume" data-operator-resume><span>作成中のコース</span><strong>{draft.title}</strong><small>保存した地点から再開できます</small></div>}
    <Link prefetch={false} className="experience-button dark" href="/operator/draft" data-operator-start>{draft?"作成中のコースを続ける":unavailable?"コースの作成画面を開く":"最初のコースをつくる"}<ArrowIcon/></Link>
    <p className="operator-start-note">スポットの登録から始める必要はありません。保存しただけでは公開されません。最後に内容を確認して公開します。</p>
   </div><div className="operator-welcome-photo"><Image src="/mainphotos/shitamati.jpg" alt="コースに組み込める三崎の路地の風景" fill priority sizes="(max-width: 700px) 90vw, 32vw"/></div></div>
   {unavailable&&<p className="operator-status-error" role="alert" data-operator-home-error>作成中のコースの状態を読み込めませんでした。作成画面で保存内容を確認してください。</p>}
   <div className="operator-start-heading"><h2>ほかの作業はこちら</h2></div>
   <div className="operator-task-grid">
    <Link prefetch={false} href="/operator/courses"><ExperienceIcon kind="publish"/><div><h3>保存したコースを公開する</h3><p>内容を開いて確認し、参加者に届ける。公開停止・再公開もここから。</p><span>コースを確認する<ArrowIcon/></span></div></Link>
    <Link prefetch={false} href="/operator/spots"><ExperienceIcon kind="pin"/><div><h3>スポットを追加・編集する</h3><p>使いたい場所が見つからないときや、名称・位置を整えたいときに。</p><span>スポットを管理する<ArrowIcon/></span></div></Link>
   </div>
   <aside className="operator-workflow"><h2>コースづくりは、3ステップ</h2><ol><li>地図から地点を選ぶ</li><li>コマを確認して保存</li><li>参加者向けに公開</li></ol><p>ルートとコマ地図は自動生成します。公開前に、現地の入口・通行・横断などを確認してください。</p></aside>
  </section><RallyFooter/>
 </main>;
}
