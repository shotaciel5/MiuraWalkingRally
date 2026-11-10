import Image from "next/image";
import type {Metadata} from "next";
import CourseStartLink from "../course-start-link";
import SiteHeader from "../site-header";
import {RallyFooter,WalkingEstimateNote} from "../rally-ui";
import {PublishedBadge,PublishedFacts,PublishedNotice,PublishedUnavailable,PublishedAttribution} from "../published-ui";
import {getPublicationRepository} from "../../lib/operator/publication-repository";
export const runtime="nodejs";export const dynamic="force-dynamic";
export const metadata:Metadata={title:"コースを探す"};
export default function RallyList(){
 let courses;try{courses=getPublicationRepository().list()}catch{courses=null}
 return <main id="main-content" className="participant-main course-catalog-main" data-participant-page="list">
  <SiteHeader/><section className="catalog-intro" id="page-content" tabIndex={-1} aria-labelledby="list-title"><div><p className="eyebrow">FIND YOUR NEXT WALK</p><h1 id="list-title">今日の冒険を、<br/>選ぼう。</h1><p className="participant-lead">歩く時間と距離から、気分に合うコースを。<br/>道と目印をたどって、まだ知らない三浦へ。</p></div><div className="catalog-intro-photo"><Image src="/mainphotos/hantoupic.jpg" alt="三崎・城ヶ島を囲む海の風景" fill priority sizes="(max-width: 700px) 90vw, 45vw"/></div></section>
  <PublishedNotice/><section className="rally-catalog" aria-labelledby="catalog-title"><div className="catalog-heading"><div><p className="eyebrow">COURSES</p><h2 id="catalog-title">公開コース</h2></div>{courses&&<span data-published-course-count={courses.length}>{courses.length}コース</span>}</div>
   {courses===null?<PublishedUnavailable/>:courses.length===0?<section className="participant-panel" data-published-empty><h3>公開されているコースはまだありません</h3><p>公開後に、この一覧からコースを選べます。</p></section>:<div className="published-catalog" data-published-catalog>{courses.map(rally=><article className="published-card" key={rally.id} data-published-card={rally.id}><div className="catalog-photo"><Image src={rally.area==="城ヶ島周辺"?"/mainphotos/hantoupic.jpg":"/mainphotos/shitamati.jpg"} alt="エリアの風景（コースの訪問地点を示す写真ではありません）" fill sizes="(max-width: 700px) 90vw, 40vw"/><span>エリアの風景</span></div><div className="published-card-content"><div className="rally-card-topline"><span className="rally-area">{rally.area}</span><PublishedBadge/></div><h3>{rally.title}</h3><PublishedFacts rally={rally}/><dl className="published-endpoints"><div><dt>スタート</dt><dd>{rally.startName}</dd></div><div><dt>終了地点</dt><dd>{rally.finishName}</dd></div></dl><p className="participant-note">チェックポイント {rally.checkpointIds.length}地点{rally.isLoop?" · 周回コース":""}</p><CourseStartLink rally={rally}/><WalkingEstimateNote/></div></article>)}</div>}
  </section><PublishedAttribution/><RallyFooter/>
 </main>;
}
