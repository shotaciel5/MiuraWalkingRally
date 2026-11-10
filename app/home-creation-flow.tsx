import Link from "next/link";
import type {HomeDemoCard} from "../lib/home-demo";
import ExperienceIcon from "./experience-icon";
import KomaFigure from "./koma-figure";
import {ArrowIcon} from "./rally-ui";

export default function HomeCreationFlow({card,route}:{card:HomeDemoCard;route:{points:{x:number;y:number}[];stops:{x:number;y:number}[]}}){
 return <section className="home-creation experience-section" aria-labelledby="creation-title">
  <div className="home-section-top"><div><p className="eyebrow">CREATE A WALK</p><h2 id="creation-title">好きな場所から、<br/>コースが生まれる。</h2></div><p>スポットを選ぶと、ルートとコマ地図を生成。<br/>道順を確かめて、参加者へ届けよう。</p></div>
  <ol className="home-creation-grid" data-home-creation>
   <li><div className="creation-visual creation-spots" aria-label="開始・立ち寄り先・ゴールを選ぶイメージ"><span><ExperienceIcon kind="pin"/>スタート</span><span><ExperienceIcon kind="camera"/>立ち寄り先</span><span><ExperienceIcon kind="publish"/>ゴール</span></div><div className="creation-step-copy"><span>01 / SELECT</span><h3>立ち寄り先を選ぶ</h3><p>地図からスポットを選び、巡る順番を決める。</p></div></li>
   <li><div className="creation-visual"><svg viewBox="0 0 300 180" role="img" aria-label="三崎の道路から生成したルートの表示例" data-home-route><polyline points={route.points.map(p=>p.x+","+p.y).join(" ")} fill="none" stroke="var(--brand)" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"/>{route.stops.map((p,i)=><circle key={i} cx={p.x} cy={p.y} r={i===0||i===route.stops.length-1?5:4} fill={i===0||i===route.stops.length-1?"var(--accent)":"var(--paper)"} stroke="var(--brand)" strokeWidth="2"/>)}</svg><span className="creation-example-label">実際の道路から生成した例</span></div><div className="creation-step-copy"><span>02 / GENERATE</span><h3>道順を自動生成</h3><p>選んだ地点を、道路に沿ったルートでつなぐ。</p></div></li>
   <li><div className="creation-visual creation-koma"><KomaFigure map={card.map} name="運営者が確認するコマ地図の表示例" context={card.context} layers={{buildings:true,landmarks:true,details:true}} compact minimal/></div><div className="creation-step-copy"><span>03 / REVIEW & PUBLISH</span><h3>コマを確かめて、公開</h3><p>生成された地図と現地の状況を確認し、保存・公開。</p></div></li>
  </ol>
  <div className="home-creation-bottom"><p>図は表示例です。公開前に、入口・通行・横断などを現地で確認してください。<br/>道路・目印 © <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a> · <a href="https://opendatacommons.org/licenses/odbl/1-0/">ODbL</a></p><Link href="/operator" className="experience-text-link">コースをつくってみる<ArrowIcon/></Link></div>
 </section>;
}
