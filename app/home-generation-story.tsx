import Link from "next/link";
import type {CSSProperties} from "react";
import HomeGenerationMotion from "./home-generation-motion";
import stops from "../data/misaki/stops.json";
import type {createHomeDemo} from "../lib/home-demo";
import OperatorKomaDisplay from "./operator-koma-display";
import ExperienceIcon from "./experience-icon";
import {ArrowIcon} from "./rally-ui";

export default function GenerationStory({demo}:{demo:ReturnType<typeof createHomeDemo>}){
 return <section className="hp-generation" id="auto-generation" aria-labelledby="hp-generation-title" data-home-section="generation">
  <div className="experience-section">
   <div className="hp-generation-heading"><div><p className="eyebrow">AI ASSISTED · AUTO GENERATION</p><span className="hp-ai-badge"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><path d="m12 2 2.5 7.5L22 12l-7.5 2.5L12 22l-2.5-7.5L2 12l7.5-2.5Z"/><path d="m20 2 .6 1.4L22 4l-1.4.6L20 6l-.6-1.4L18 4l1.4-.6Z"/></svg>AIで、コマの選別をサポート</span><h2 id="hp-generation-title">行きたい場所から、<br/>コマ地図まで。</h2></div><p>道路情報から、道順とコマをつくる。<br/>さらにルールと機械学習で、<br/>残すコマの判断をサポート。</p></div>
   <HomeGenerationMotion><ol className="hp-generation-grid" data-home-creation>
    <li style={{"--panel-index":0} as CSSProperties}><div className="hp-generation-label"><span>01</span><p>INPUT<strong>スポットを選ぶ</strong></p><ExperienceIcon kind="pin"/></div>
     <div className="hp-stop-list" aria-label="固定ルートの地点順">{stops.map((stop,i)=><div key={stop.id} style={{"--spot-index":i} as CSSProperties}><span>{String(i+1).padStart(2,"0")}</span><strong>{stop.name}</strong><small>{i===0?"開始":i===stops.length-1?"ゴール":"立ち寄り"}</small><svg className="hp-stop-selected" viewBox="0 0 12 12" aria-hidden="true"><path d="m2 6 3 3 5-6" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/></svg><span className="hp-stop-tap" aria-hidden="true"><svg viewBox="0 0 24 28"><path d="M9 25 5 17c-1-2 1-4 3-2l2 2V4a2 2 0 0 1 4 0v8c1-1 3-1 4 1 2-1 4 0 4 2v7l-3 4Z" fill="#fffefb" stroke="#174b66" strokeWidth="1.5" strokeLinejoin="round"/></svg></span></div>)}</div>
     <p className="hp-card-copy">お店も、神社も、見せたい景色も。<br/>登録スポットから場所と順番を選ぶ。</p>
    </li>
    <li style={{"--panel-index":1} as CSSProperties}><div className="hp-generation-label"><span>02</span><p>PROCESS<strong>道順を自動生成</strong></p><ExperienceIcon kind="route"/></div>
     <div className="hp-route-visual"><svg viewBox="0 0 300 180" role="img" aria-label="三崎の道路に沿って生成した固定ルートの表示例" data-home-route>
      <polyline points={demo.route.points.map(p=>p.x+","+p.y).join(" ")} fill="none" stroke="#ccdde1" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"/><polyline className="hp-route-ink" pathLength={1} points={demo.route.points.map(p=>p.x+","+p.y).join(" ")} fill="none" stroke="var(--brand)" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"/>
      {demo.route.stops.map((p,i)=><g key={i} className="hp-route-pins"><circle cx={p.x} cy={p.y} r={i===0||i===demo.route.stops.length-1?5:4} fill={i===0||i===demo.route.stops.length-1?"var(--accent)":"var(--paper)"} stroke="var(--brand)" strokeWidth="2"/></g>)}
     </svg><span>三崎の実際の道路から生成した例</span></div>
     <p className="hp-card-copy">選んだ訪問順を保ちながら、<br/>地点と地点を道路沿いにつなぐ。</p>
    </li>
    <li style={{"--panel-index":2} as CSSProperties}><div className="hp-generation-label"><span>03</span><p>OUTPUT<strong>コマ地図ができる</strong></p><ExperienceIcon kind="map"/></div>
     <div className="hp-output-stage"><div className="hp-output-visual" aria-label="生成したコマ地図の抜粋">{demo.cards.map((card,i)=><figure key={card.map.sequence} data-home-output={i} style={{"--koma-index":i} as CSSProperties}><OperatorKomaDisplay map={card.map} name={"生成したコマ地図の抜粋 "+(i+1)} context={card.context} referenceContext={null} layers={{buildings:false,landmarks:true,details:false}} reviewed={{center:card.center,candidates:card.candidates,photos:{}}} minimal/><figcaption>コマの抜粋 {i+1}</figcaption></figure>)}</div><div className="hp-ai-progress" aria-hidden="true"><span>AI補助</span>{[0,1,2].map(i=><i key={i} style={{"--dot-index":i} as CSSProperties}/>)}</div></div>
     <p className="hp-card-copy">道なりの省略を、ルールとAIで補助。<br/>運営者が確かめて、保存・公開。</p>
    </li>
   </ol></HomeGenerationMotion>
   <div className="hp-generation-bottom"><p><strong>固定データによる表示例です。</strong>実際の生成・確認は運営画面で行えます。<br/>道路・目印 © <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a> · <a href="https://opendatacommons.org/licenses/odbl/1-0/">ODbL</a></p><Link href="/operator" className="experience-button dark" data-home-create>コースづくりを試す<ArrowIcon/></Link></div>
  </div>
 </section>;
}
