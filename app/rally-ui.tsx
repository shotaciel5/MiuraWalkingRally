import Link from "next/link";
import {WALKING_SPEED_KMH} from "../lib/walking-estimate";
export function WalkingEstimateNote(){return <p className="walking-estimate-note">時速{WALKING_SPEED_KMH}kmでの概算です。見学・休憩・信号待ちは含みません。坂や階段、歩く速さによって変わります。</p>}
export function ArrowIcon({back=false}:{back?:boolean}){
  return <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true" className={back?"back-arrow":undefined}><path d="M4 12h15m-6-6 6 6-6 6" stroke="currentColor" strokeWidth="1.7" fill="none" strokeLinecap="round" strokeLinejoin="round"/></svg>;
}
// Decorative harbor illustration; it contains no route or real road geometry.
export function RallyArtwork({compact=false}:{compact?:boolean}){
  return <div className={"rally-artwork"+(compact?" compact-artwork":"")} aria-hidden="true">
    <svg viewBox="0 0 560 380" focusable="false">
      <rect width="560" height="380" fill="#e2eaee"/>
      <circle cx="440" cy="80" r="37" fill="#e8c471"/>
      <path d="M0 229C97 205 150 250 243 229S435 208 560 231V380H0Z" fill="#c7d3d9"/>
      <path d="M0 280c94-31 166 21 260 0s197-24 300 3v97H0Z" fill="#8eabbb"/>
      <path d="M0 338c116-29 160 13 274-1s175-19 286 7v36H0Z" fill="#174b66"/>
      <g fill="#f9f8ed" stroke="#6b808c" strokeWidth="2" strokeLinejoin="round">
        <path d="M81 219h63l-12 15H92Z"/><path d="M113 163v54h30Z"/><path d="M113 177l-22 36h22Z"/>
      </g>
      <path d="M328 225v-44h50v47m-42-48v-24h35v24m-57 2h80M318 198h72" fill="none" stroke="#6b808c" strokeWidth="3" strokeLinecap="round"/>
      <path d="M40 270c35-8 52-7 83 0m69 36c32-7 52-7 81 0m121-49c32-7 57-7 83 0" fill="none" stroke="#e9f0f4" strokeWidth="2" strokeLinecap="round"/>
    </svg>
    <div className="artwork-caption"><span>MIURA / MISAKI</span><strong>港から、<br/>まちの奥へ。</strong></div>
    <span className="artwork-index">01</span>
  </div>;
}
export function RallyFooter(){return <footer className="rally-footer"><div><strong className="footer-brand">MIURA WALKING RALLY</strong><p>海とまちを、自分の足で。</p></div><nav className="footer-links" aria-label="フッターナビゲーション"><Link href="/">トップ</Link><Link href="/courses">コースを探す</Link><Link href="/operator">コースをつくる</Link></nav></footer>}
