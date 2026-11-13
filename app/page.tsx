import Image from "next/image";
import Link from "next/link";
import SiteHeader from "./site-header";
import {ArrowIcon,RallyFooter} from "./rally-ui";
import HomeKoma from "./home-koma";
import HomeDemo from "./home-demo";
import ExperienceIcon from "./experience-icon";
import GenerationStory from "./home-generation-story";
import {createHomeDemo} from "../lib/home-demo";

export default function HomePage(){
 const demo=createHomeDemo();
 return <main className="home-page home-designed" data-home-page data-home-designed>
  <div className="home-header-wrap"><SiteHeader view="home"/></div>
  <div id="page-content" tabIndex={-1}>
   <section className="home-hero" aria-labelledby="home-title" data-home-section="hero">
    <Image className="home-hero-photo" src="/mainphotos/hantoupic.jpg" alt="海に囲まれた三崎・城ヶ島の風景" fill priority sizes="100vw"/>
    <div className="home-hero-shade"/>
    <div className="home-hero-content">
     <div className="home-hero-copy"><p className="home-kicker">MIURA WALKING RALLY</p><h1 id="home-title">ひとコマ先に、<br/>知らない三浦。</h1>
      <p className="home-hero-lead">道を読み解き、まちの魅力を発見する。<br/>スマホひとつで楽しむ、コマ地図ウォーキングラリー。</p>
      <p className="hp-hero-unique"><ExperienceIcon kind="route"/><span>スポットから、ルートとコマ地図を自動生成。</span></p>
      <div className="home-actions"><Link className="experience-button coral" href="/courses" data-home-participant>コースを探す<ArrowIcon/></Link><Link className="hp-hero-operator" href="/operator" data-home-operator>コースをつくる<ArrowIcon/></Link></div>
      <a className="hp-generation-jump" href="#auto-generation">どうやってつくる？<span aria-hidden="true"> ↓</span></a>
     </div>
     <div className="home-hero-demo"><HomeDemo cards={demo.cards}/></div>
    </div>
    <a className="home-scroll" href="#how-it-works">楽しみ方を見る<span aria-hidden="true">↓</span></a><span className="home-photo-caption">MIURA, KANAGAWA</span>
   </section>

   <section className="home-introduction experience-section hp-how" id="how-it-works" aria-labelledby="hp-how-title" data-home-section="how">
    <div className="home-section-heading"><p className="eyebrow">HOW IT WORKS</p><h2 id="hp-how-title">いつもの散歩が、<br/>ちいさな冒険に。</h2><p>「次は、どっちだろう？」<br/>道のかたちと目印を頼りに、ひとコマずつ。</p>
     <ol className="hp-play-steps">
      <li><span>01</span><div><h3>コースを選ぶ</h3><p>距離や歩く時間を見て、今日の気分で。</p></div><ExperienceIcon kind="map"/></li>
      <li><span>02</span><div><h3>ひとコマずつ、歩く</h3><p>黒点から入り、青い矢印へ。道と見比べよう。</p></div><ExperienceIcon kind="walk"/></li>
      <li><span>03</span><div><h3>見つけたら、写真を</h3><p>チェックポイントでスマホのカメラを使って撮影。ゴールで写真を見せよう。</p></div><ExperienceIcon kind="camera"/></li>
     </ol>
     <p className="hp-play-note">インストール・ログイン不要。地点名は到着コマでのお楽しみ。</p>
    </div>
    <div className="home-koma-scene"><div className="home-scene-photo"><Image src="/mainphotos/shitamati.jpg" alt="昔ながらの店が並ぶ三崎の路地" fill sizes="(max-width: 700px) 90vw, 45vw"/></div><figure className="home-playing-photo" data-home-playing-photo><div className="home-playing-photo-image"><Image src="/mainphotos/walking-together.png" alt="スマホを手に道を見比べる二人の体験イメージ" fill sizes="(max-width: 700px) 45vw, 280px"/></div><figcaption>体験イメージ</figcaption></figure><HomeKoma card={demo.introduction}/><span className="home-scene-caption">地図を見て、まちを見て。自分で見つける道。</span></div>
   </section>

   <GenerationStory demo={demo}/>

   <section className="hp-value" aria-labelledby="hp-value-title" data-home-section="value">
    <div className="hp-value-photo"><Image src="/mainphotos/kainanshrine.jpg" alt="提灯のある神社と、周囲に広がる三浦のまちの風景" fill sizes="(max-width: 700px) 100vw, 45vw"/><span>道の先に、その土地らしい出会いを。</span></div>
    <div className="hp-value-copy"><p className="eyebrow">WHY IT MATTERS</p><h2 id="hp-value-title">いつもの道を、<br/>地域に出会う道へ。</h2><p>訪れてほしいお店や、まだ知られていない景色をコースにつなぐ。目的地だけでなく、その道のりにも寄り道のきっかけを。</p>
     <ul><li><ExperienceIcon kind="pin"/><div><strong>お店も、景色も、ひとつのコースに。</strong><span>点在する地域の魅力を、歩いて巡れる体験へ。</span></div></li><li><ExperienceIcon kind="route"/><div><strong>地域らしい街歩きを、つくりやすく。</strong><span>ルートとコマづくりを支え、コースの企画を身近に。</span></div></li></ul>
    </div>
   </section>

   <section className="home-entry experience-section hp-entry" aria-labelledby="hp-entry-title" data-home-section="entry">
    <div className="home-section-top"><div><p className="eyebrow">GET STARTED</p><h2 id="hp-entry-title">さあ、三浦のまちへ。</h2></div><p>歩いて楽しむ。つくって届ける。</p></div>
    <div className="hp-entry-grid">
     <article><ExperienceIcon kind="walk"/><div><span>参加者の方へ</span><h3>次の角を、楽しみに。</h3><p>公開コースから、今日の冒険を選ぼう。</p><Link href="/courses" className="experience-button coral">コースを探す<ArrowIcon/></Link></div></article>
     <article><ExperienceIcon kind="map"/><div><span>運営者の方へ</span><h3>まちの魅力を、コースに。</h3><p>スポット選びから、確認・保存・公開まで。</p><Link href="/operator" className="experience-text-link">コースづくりをはじめる<ArrowIcon/></Link></div></article>
    </div>
    <p className="home-safety">現在は試用版です。公開前に入口・通行・安全性の現地確認が必要です。画面の操作は安全な場所で立ち止まって行ってください。</p>
   </section>
  </div>
  <div className="home-footer-wrap"><RallyFooter/></div>
 </main>;
}
