import type {Metadata} from "next";
import SiteHeader from "../../site-header";
import OperatorNav from "../../operator-nav";
import {RallyFooter} from "../../rally-ui";
import RallyDraftBuilder from "../../rally-draft-builder";
import {getDraftRepository} from "../../../lib/operator/draft-repository";
export const runtime="nodejs";
export const dynamic="force-dynamic";
export const metadata:Metadata={title:"コースの地点を選ぶ（運営者向け）"};
export default function OperatorDraftPage(){
 let context;try{context=getDraftRepository().load()}catch{context=null}
 return <main className="participant-main operator-main" data-operator-page="draft"><SiteHeader view="operator"/><section id="page-content" tabIndex={-1}>
  <OperatorNav view="draft"/><div className="operator-intro"><div><p className="eyebrow">OPERATOR / RALLY DRAFT</p><h1>コースの地点を選ぶ</h1><p className="participant-lead">登録済みの場所を、スタート・ゴール・立ち寄り先に割り当てます。</p></div></div>
  <p className="operator-scope"><span>STEP 1</span>地点を保存したら、ルートとコマをつくれます。入口・通行・現地安全性は確認待ちです。</p>
  {context?<RallyDraftBuilder initial={context}/>:<section className="participant-panel" role="alert" data-draft-load-error><h2>下書きとスポット情報を読み込めませんでした</h2><p>保存先を確認して再読込みしてください。</p><a href="/operator/draft">再読込みする</a></section>}
 </section><RallyFooter/></main>;
}
