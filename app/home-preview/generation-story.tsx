import Link from "next/link";
import stops from "../../data/misaki/stops.json";
import type {createHomeDemo} from "../../lib/home-demo";
import OperatorKomaDisplay from "../operator-koma-display";
import ExperienceIcon from "../experience-icon";
import {ArrowIcon} from "../rally-ui";

export default function GenerationStory({demo}:{demo:ReturnType<typeof createHomeDemo>}){
 return <section className="hp-generation" id="auto-generation" aria-labelledby="hp-generation-title" data-proposal-section="generation">
  <div className="experience-section">
   <div className="hp-generation-heading"><div><p className="eyebrow">AUTO GENERATION</p><h2 id="hp-generation-title">行きたい場所から、<br/>コマ地図まで。</h2></div><p>運営者が選ぶのは、場所と巡る順番。<br/>道路情報から道順とコマをつくり、<br/>確認して、ひとつの街歩きへ。</p></div>
   <ol className="hp-generation-grid" data-proposal-generation>
    <li><div className="hp-generation-label"><span>01</span><p>INPUT<strong>スポットを選ぶ</strong></p><ExperienceIcon kind="pin"/></div>
     <div className="hp-stop-list" aria-label="固定ルートの地点順">{stops.map((stop,i)=><div key={stop.id}><span>{String(i+1).padStart(2,"0")}</span><strong>{stop.name}</strong><small>{i===0?"開始":i===stops.length-1?"ゴール":"立ち寄り"}</small></div>)}</div>
     <p className="hp-card-copy">お店も、神社も、見せたい景色も。<br/>登録スポットから場所と順番を選ぶ。</p>
    </li>
    <li><div className="hp-generation-label"><span>02</span><p>PROCESS<strong>道順を自動生成</strong></p><ExperienceIcon kind="route"/></div>
     <div className="hp-route-visual"><svg viewBox="0 0 300 180" role="img" aria-label="三崎の道路に沿って生成した固定ルートの表示例" data-proposal-route>
      <polyline points={demo.route.points.map(p=>p.x+","+p.y).join(" ")} fill="none" stroke="var(--brand)" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"/>
      {demo.route.stops.map((p,i)=><g key={i}><circle cx={p.x} cy={p.y} r={i===0||i===demo.route.stops.length-1?5:4} fill={i===0||i===demo.route.stops.length-1?"var(--accent)":"var(--paper)"} stroke="var(--brand)" strokeWidth="2"/></g>)}
     </svg><span>三崎の実際の道路から生成した例</span></div>
     <p className="hp-card-copy">選んだ訪問順を保ちながら、<br/>地点と地点を道路沿いにつなぐ。</p>
    </li>
    <li><div className="hp-generation-label"><span>03</span><p>OUTPUT<strong>コマ地図ができる</strong></p><ExperienceIcon kind="map"/></div>
     <div className="hp-output-visual" aria-label="生成したコマ地図の抜粋">{demo.cards.map((card,i)=><figure key={card.map.sequence} data-proposal-output={i}><OperatorKomaDisplay map={card.map} name={"生成したコマ地図の抜粋 "+(i+1)} context={card.context} referenceContext={null} layers={{buildings:false,landmarks:true,details:false}} reviewed={{center:card.center,candidates:card.candidates,photos:{}}} minimal/><figcaption>コマの抜粋 {i+1}</figcaption></figure>)}</div>
     <p className="hp-card-copy">曲がり角の形と進む方向をコマに。<br/>現地と照らし合わせ、確認・保存して公開。</p>
    </li>
   </ol>
   <div className="hp-generation-bottom"><p><strong>固定データの生成結果を使った表示例です。</strong>この画面からコースの生成・保存は行いません。<br/>道路・目印 © <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a> · <a href="https://opendatacommons.org/licenses/odbl/1-0/">ODbL</a></p><Link href="/operator" className="experience-button dark" data-proposal-create>コースづくりを試す<ArrowIcon/></Link></div>
  </div>
 </section>;
}
