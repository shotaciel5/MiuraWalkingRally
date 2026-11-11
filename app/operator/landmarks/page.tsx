import type {Metadata} from "next";
import SiteHeader from "../../site-header";
import OperatorNav from "../../operator-nav";
import LandmarkDisplayPoc from "../../landmark-display-poc";
import {RallyFooter} from "../../rally-ui";
import {PublishedAttribution} from "../../published-ui";
import {createMisakiReviewPoc} from "../../../lib/misaki-review";
export const metadata:Metadata={title:"目印の表示比較PoC"};
export default function LandmarkPocPage(){
 const source=createMisakiReviewPoc();
 return <main className="participant-main operator-main landmark-poc-main" data-operator-page="landmarks"><SiteHeader view="operator"/><section id="page-content" tabIndex={-1}><OperatorNav view="landmarks"/><div className="operator-intro"><div><p className="eyebrow">VISUAL LANDMARKS / LOCAL POC</p><h1>コマ図の目印を、絞って比べる。</h1><p className="participant-lead">建物形状と名称を省き、見て分かる記号を少数だけ。固有の看板は、切り出しと位置の確かさを分けて試します。</p></div></div><p className="operator-scope"><span>比較PoC</span>三崎下町の固定31コマを使います。保存済みコースとは別の表示例で、通常の参加者/運営画面への採用は今回行いません。画像取得・認識・現地確認は未実施です。</p><LandmarkDisplayPoc cards={source.koma}/></section><PublishedAttribution/><RallyFooter/></main>;
}
