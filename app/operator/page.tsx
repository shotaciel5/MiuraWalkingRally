import type {Metadata} from "next";
import Image from "next/image";
import Link from "next/link";
import SiteHeader from "../site-header";
import ExperienceIcon from "../experience-icon";
import {ArrowIcon,RallyFooter} from "../rally-ui";
export const metadata:Metadata={title:"コースをつくる"};

export default function OperatorHome(){
  return <main className="participant-main operator-main operator-home" data-operator-page="home">
    <SiteHeader view="operator"/>
    <section id="page-content" tabIndex={-1}>
      <div className="operator-welcome"><div><p className="eyebrow">CREATE YOUR MIURA</p><h1>まちの魅力を、<br/>歩くコースに。</h1><p className="participant-lead">おすすめの場所をつないで、あなただけの三浦を。<br/>ルートとコマ地図づくりを、お手伝いします。</p><Link className="experience-button dark" href="/operator/draft" data-operator-start>コースづくりをはじめる<ArrowIcon/></Link></div><div className="operator-welcome-photo"><Image src="/mainphotos/shitamati.jpg" alt="三崎の路地と店の風景" fill priority sizes="(max-width: 700px) 90vw, 40vw"/></div></div>
      <div className="operator-start-heading"><p className="eyebrow">YOUR WORKSPACE</p><h2>やりたいことから、はじめよう。</h2></div>
      <div className="operator-entry-grid">
        <Link href="/operator/spots"><ExperienceIcon className="operator-entry-icon" kind="pin"/><span className="operator-entry-number">01 / SPOTS</span><h3>スポットを探す・整える</h3><p>地図と一覧から候補を見つける。新しいスポットの追加や編集もここから。</p><span className="operator-entry-link">スポット台帳へ<ArrowIcon/></span></Link>
        <Link href="/operator/draft"><ExperienceIcon className="operator-entry-icon" kind="route"/><span className="operator-entry-number">02 / COURSE</span><h3>コースを組み立てる</h3><p>開始・終了と立ち寄り先を選び、訪問順を決めて、ルートとコマ地図を生成。</p><span className="operator-entry-link">下書きを開く<ArrowIcon/></span></Link>
        <Link href="/operator/courses"><ExperienceIcon className="operator-entry-icon" kind="publish"/><span className="operator-entry-number">03 / PUBLISH</span><h3>保存したコースを届ける</h3><p>生成した内容を確認して参加者に公開。公開停止・再公開も操作できます。</p><span className="operator-entry-link">保存済みコースへ<ArrowIcon/></span></Link>
      </div>
      <aside className="operator-workflow"><h2>コースができるまで</h2><ol><li>スポットを選ぶ</li><li>ルート・コマを生成</li><li>確認して保存</li><li>参加者に公開</li></ol><p>公開前に、入口・通行・横断など現地の状況を確認してください。画面を切り替えるだけで利用でき、ログインによるアクセス制限はありません。</p></aside>
      <p className="operator-lab-link"><Link prefetch={false} href="/operator/landmarks">目印の表示を検証する →</Link><small>建物や名称を省いたコマ図と、写真の切り出しを比べる検証ページです。</small></p>
    </section><RallyFooter/>
  </main>;
}
