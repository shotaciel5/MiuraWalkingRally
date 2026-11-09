import type {Metadata} from "next";
import SiteHeader from "../../site-header";
import OperatorNav from "../../operator-nav";
import {RallyFooter} from "../../rally-ui";
import CorrectionEditor from "../../correction-editor";
import {getDraftRepository} from "../../../lib/operator/draft-repository";
export const runtime="nodejs";
export const dynamic="force-dynamic";
export const metadata:Metadata={title:"道路上の到達点を修正（運営者向け）"};
export default function ConnectionsPage(){
 let context;try{context=getDraftRepository().load()}catch{context=null}
 return <main className="participant-main operator-main" data-operator-page="connections"><SiteHeader view="operator"/><section id="page-content" tabIndex={-1}><OperatorNav view="connections"/>
 <div className="operator-intro"><div><p className="eyebrow">OPERATOR / ROAD CONNECTION</p><h1>道路上の到達点を修正する</h1><p className="participant-lead">施設の位置を保ち、道路上の候補だけを選び直します。</p></div></div>
 {context?.draft?<CorrectionEditor initial={context}/>:<section className="preview-panel" role="alert" data-correction-blocked={context?"missing":"unavailable"}><h2>{context?"保存済みの下書きがありません":"下書き・補正を読み込めませんでした"}</h2><p>下書きと保存先を確認してください。</p><a href="/operator/draft">下書きへ</a></section>}
 </section><RallyFooter/></main>;
}
