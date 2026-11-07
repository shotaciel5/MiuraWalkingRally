import type {DemoRally} from "../lib/demo-rally";

export function DemoBadge(){return <span className="demo-badge">開発用・未公開</span>}
export function DemoNotice(){
  return <aside className="demo-notice" aria-label="公開・参加受付の状態"><span aria-hidden="true" className="demo-notice-mark">i</span><div><strong>開発用コースのデモです</strong><p>現地の入口・通行・横断などは未確認です。開発用デモのみ試せます。一般の参加は受け付けていません。</p></div></aside>;
}
export function RallyFacts({rally}:{rally:DemoRally}){
  return <dl className="rally-facts" aria-label="歩行の目安">
    <div><dt>歩行距離の概算</dt><dd data-rally-distance={rally.distanceMeters}>約 <strong>{rally.distanceKm}</strong> km</dd></div>
    <div><dt>歩行のみの目安</dt><dd data-rally-minutes={rally.walkingMinutes}>約 <strong>{rally.walkingMinutes}</strong> 分</dd></div>
  </dl>;
}
export function WalkingEstimateNote(){return <p className="walking-estimate-note">見学・休憩・信号待ちを含まない概算です。坂や階段、歩く速さによって変わります。</p>}
export function ArrowIcon({back=false}:{back?:boolean}){
  return <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true" className={back?"back-arrow":undefined}><path d="M4 12h15m-6-6 6 6-6 6" stroke="currentColor" strokeWidth="1.7" fill="none" strokeLinecap="round" strokeLinejoin="round"/></svg>;
}
// Decorative harbor illustration; it contains no route or real road geometry.
export function RallyArtwork({compact=false}:{compact?:boolean}){
  return <div className={"rally-artwork"+(compact?" compact-artwork":"")} aria-hidden="true">
    <svg viewBox="0 0 560 380" focusable="false">
      <rect width="560" height="380" fill="#e8eee2"/>
      <circle cx="440" cy="80" r="37" fill="#e8c471"/>
      <path d="M0 229C97 205 150 250 243 229S435 208 560 231V380H0Z" fill="#c7d9ce"/>
      <path d="M0 280c94-31 166 21 260 0s197-24 300 3v97H0Z" fill="#8ebbad"/>
      <path d="M0 338c116-29 160 13 274-1s175-19 286 7v36H0Z" fill="#17634f"/>
      <g fill="#f9f8ed" stroke="#6b8c79" strokeWidth="2" strokeLinejoin="round">
        <path d="M81 219h63l-12 15H92Z"/><path d="M113 163v54h30Z"/><path d="M113 177l-22 36h22Z"/>
      </g>
      <path d="M328 225v-44h50v47m-42-48v-24h35v24m-57 2h80M318 198h72" fill="none" stroke="#6b8c79" strokeWidth="3" strokeLinecap="round"/>
      <path d="M40 270c35-8 52-7 83 0m69 36c32-7 52-7 81 0m121-49c32-7 57-7 83 0" fill="none" stroke="#edf4e9" strokeWidth="2" strokeLinecap="round"/>
    </svg>
    <div className="artwork-caption"><span>MIURA / MISAKI</span><strong>港から、<br/>まちの奥へ。</strong></div>
    <span className="artwork-index">01</span>
  </div>;
}
export function RallyFooter(){return <footer className="rally-footer"><span>海とまちを、自分の足で。</span><span>三浦市ウォーキングラリー · 開発用プレビュー</span></footer>}
