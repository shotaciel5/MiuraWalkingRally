import Image from "next/image";
import Link from "next/link";
import SiteHeader from "./site-header";
import {ArrowIcon,RallyFooter} from "./rally-ui";
import HomeKoma from "./home-koma";
import HomeDemo from "./home-demo";
import HomeCreationFlow from "./home-creation-flow";
import ExperienceIcon from "./experience-icon";
import {createHomeDemo} from "../lib/home-demo";

export default function HomePage(){
  const demo=createHomeDemo();
  return <main className="home-page" data-home-page>
    <div className="home-header-wrap"><SiteHeader view="home"/></div>
    <div id="page-content" tabIndex={-1}>
      <section className="home-hero" aria-labelledby="home-title">
        <Image className="home-hero-photo" src="/mainphotos/hantoupic.jpg" alt="海に囲まれた三崎・城ヶ島の風景" fill priority sizes="100vw"/>
        <div className="home-hero-shade"/>
        <div className="home-hero-content"><div className="home-hero-copy">
          <p className="home-kicker">MIURA WALKING RALLY</p>
          <h1 id="home-title">ひとコマ先に、<br/>知らない三浦。</h1>
          <p className="home-hero-lead">道のかたちと目印を頼りに、海辺のまちを探検。<br className="desktop-break"/>スマホひとつで楽しむ、コマ地図ウォーキングラリー。</p>
          <div className="home-actions">
            <Link className="experience-button coral" href="/courses" data-home-participant>参加する<ArrowIcon/></Link>
            <Link className="experience-button outline-light" href="/operator" data-home-operator>コースをつくる<ArrowIcon/></Link>
          </div>
          <p className="home-hero-note">三崎・城ヶ島から、まちの奥へ。</p></div><div className="home-hero-demo"><HomeDemo cards={demo.cards}/></div>
        </div>
        <a className="home-scroll" href="#how-it-works">楽しみ方を見る<span aria-hidden="true">↓</span></a>
        <span className="home-photo-caption">MIURA, KANAGAWA</span>
      </section>

      <section className="home-introduction experience-section" id="how-it-works" aria-labelledby="introduction-title">
        <div className="home-section-heading"><p className="eyebrow">A LITTLE ADVENTURE</p><h2 id="introduction-title">いつもの散歩が、<br/>ちいさな冒険に。</h2><p>「次は、どっちだろう？」<br/>曲がり角のかたち、まちの目印。<br/>ひとコマずつ読み解けば、見慣れない路地も旅のつづきに。</p></div>
        <div className="home-koma-scene"><div className="home-scene-photo"><Image src="/mainphotos/shitamati.jpg" alt="昔ながらの店が並ぶ三崎の路地" fill sizes="(max-width: 700px) 90vw, 45vw"/></div><figure className="home-playing-photo" data-home-playing-photo><div className="home-playing-photo-image"><Image src="/mainphotos/walking-together.png" alt="スマホを手に海辺の道を見比べる二人の体験イメージ" fill sizes="(max-width: 700px) 45vw, 280px"/></div><figcaption>体験イメージ</figcaption></figure><HomeKoma card={demo.introduction}/><span className="home-scene-caption">地図を見て、まちを見て。自分で見つける道。</span></div>
      </section>

      <section className="home-how experience-section" aria-labelledby="how-title">
        <div className="home-section-top"><div><p className="eyebrow">HOW TO PLAY</p><h2 id="how-title">楽しみ方は、3ステップ。</h2></div><p>アプリのインストールも、ログインも不要。<br/>スマートフォンのブラウザから出かけよう。</p></div>
        <ol className="home-steps">
          <li><div className="home-step-top"><span className="home-step-number">01</span><ExperienceIcon kind="map"/></div><h3>コースを選ぶ</h3><p>距離や歩く時間を見て、今日の気分に合うコースを。チェックポイントの名前は、着いてからのお楽しみ。</p></li>
          <li><div className="home-step-top"><span className="home-step-number">02</span><ExperienceIcon kind="walk"/></div><h3>ひとコマずつ、歩く</h3><p>黒点から入り、青い矢印の道へ。道と目印を見比べながら、スワイプで次のコマへ進もう。</p></li>
          <li><div className="home-step-top"><span className="home-step-number">03</span><ExperienceIcon kind="camera"/></div><h3>見つけたら、写真を</h3><p>チェックポイントで撮影の合図。スマホのカメラで思い出を残し、ゴールで写真を見せよう。</p></li>
        </ol>
      </section>

      <section className="home-discovery" aria-labelledby="discovery-title">
        <div className="home-discovery-photo"><Image src="/mainphotos/kainanshrine.jpg" alt="赤い提灯と緑の屋根が印象的な三浦の神社の風景" fill sizes="(max-width: 700px) 100vw, 55vw"/></div>
        <div className="home-discovery-copy"><p className="eyebrow">LOOK UP. LOOK AROUND.</p><h2 id="discovery-title">寄り道したくなる、<br/>三浦に出会おう。</h2><p>港の風、路地の一軒、ふと見上げた景色。<br/>目的地までの道のりにも、三浦らしさがある。</p><p>地図の先にあるまちを、自分の足で。<br/>いつもより少しゆっくり、歩いてみませんか。</p><Link href="/courses" className="experience-text-link">今日のコースを探す<ArrowIcon/></Link></div>
      </section>

      <HomeCreationFlow card={demo.cards[0]} route={demo.route}/>

      <section className="home-entry experience-section" aria-labelledby="entry-title">
        <div className="home-section-top"><div><p className="eyebrow">LET'S GET STARTED</p><h2 id="entry-title">歩く人も、つくる人も。</h2></div><p>あなたは、どちらから楽しみますか？</p></div>
        <div className="home-role-grid">
          <article className="home-role participant-role"><span className="home-role-label">参加者の方へ</span><h3>次の角を、<br/>楽しみにしよう。</h3><p>公開されたコースから選んで、<br/>コマ地図を頼りに三浦を探検。</p><Link className="experience-button light" href="/courses">コースを探す<ArrowIcon/></Link></article>
          <article className="home-role operator-role"><span className="home-role-label">運営者の方へ</span><h3>まちの魅力を、<br/>ひとつのコースに。</h3><p>スポットを選んで、ルートとコマ地図を生成。<br/>確認・保存して、参加者に届けよう。</p><Link className="experience-button dark" href="/operator">コースづくりをはじめる<ArrowIcon/></Link></article>
        </div>
        <p className="home-safety">現在は試用版です。現地の入口・通行・安全性は確認待ちです。歩くときは周囲を確かめ、画面の操作は安全な場所で立ち止まって行ってください。</p>
      </section>
    </div>
    <div className="home-footer-wrap"><RallyFooter/></div>
  </main>;
}
