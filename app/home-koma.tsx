import KomaFigure from "./koma-figure";
import {createMisakiReviewPoc} from "../lib/misaki-review";

export default function HomeKoma(){
  const card=createMisakiReviewPoc().koma.find(c=>c.map.kind==="junction"&&c.map.state==="ready"&&c.map.branches.length>=3);
  if(!card)return null;
  return <figure className="home-koma" data-home-koma>
    <figcaption><span>コマ地図の表示例</span><strong>曲がり角が、ヒント。</strong></figcaption>
    <KomaFigure map={card.map} name="三崎の実際の道路から生成したコマ地図の例" context={card.context} layers={{buildings:true,landmarks:true,details:true}} minimal/>
    <p className="home-koma-legend"><span>● 入ってくる道</span><span>↗ 進む道</span></p>
    <p className="home-koma-source">© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a> · <a href="https://opendatacommons.org/licenses/odbl/1-0/">ODbL</a></p>
  </figure>;
}
