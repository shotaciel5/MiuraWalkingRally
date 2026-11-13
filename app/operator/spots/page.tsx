import type {Metadata} from "next";
import OperatorNav from "../../operator-nav";
import SiteHeader from "../../site-header";
import {RallyFooter} from "../../rally-ui";
import SpotBrowser from "../../spot-browser";
import {getSpotRepository} from "../../../lib/spots/local-repository";
export const runtime="nodejs";
export const dynamic="force-dynamic";
export const metadata:Metadata={title:"スポット管理（運営者向け）"};
export default function OperatorSpotsPage(){
  let spots;try{spots=getSpotRepository().list()}catch{spots=null}
  return <main className="participant-main operator-main" data-operator-page="spots">
    <SiteHeader view="operator"/>
    <section id="page-content" tabIndex={-1}>
      <OperatorNav view="spots"/>
      <div className="operator-intro"><div><p className="eyebrow">OPERATOR / SPOT CATALOG</p><h1>スポットを追加・編集する</h1><p className="participant-lead">使いたい場所の追加・編集はこちら。コースに地点を入れるときは「地点を選ぶ」へ。</p></div></div>
      <p className="operator-scope"><span>スポット台帳</span>スポットを追加・編集・削除できます。変更はこのPCの保存先で共有されます。全候補の営業・入口・現地安全性は確認待ちです。</p>
      {spots?<SpotBrowser spots={spots}/>:<section className="participant-panel" role="alert" data-catalog-error><h2>スポット情報を読み込めませんでした</h2><p>スポット情報を再読込みしてください。表示できない場合は登録データを確認してください。</p><a href="/operator/spots">再読込みする</a></section>}
    </section>
    <RallyFooter/>
  </main>;
}
