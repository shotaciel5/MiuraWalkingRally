import OperatorKomaDisplay from "./operator-koma-display";
import type {HomeDemoCard} from "../lib/home-demo";

export default function HomeKoma({card}:{card:HomeDemoCard}){
  return <figure className="home-koma" data-home-koma data-koma-node={card.map.nodeId}>
    <figcaption><span>コマ地図の表示例</span><strong>曲がり角が、ヒント。</strong></figcaption>
    <OperatorKomaDisplay map={card.map} name="三崎の実際の道路から生成したコマ地図の例" context={card.context} referenceContext={null} layers={{buildings:false,landmarks:true,details:false}} reviewed={{center:card.center,candidates:card.candidates,photos:{}}} minimal/>
    <p className="home-koma-legend"><span>● 入ってくる道</span><span>↗ 進む道</span></p>
    <p className="home-koma-source">© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a> · <a href="https://opendatacommons.org/licenses/odbl/1-0/">ODbL</a></p>
  </figure>;
}
