import type {Metadata} from "next";
import SiteHeader from "../../site-header";
import OperatorNav from "../../operator-nav";
import {RallyFooter} from "../../rally-ui";
import RallyPreviewView from "../../rally-preview-view";
import {getDraftRepository} from "../../../lib/operator/draft-repository";
import {createRallyPreview} from "../../../lib/operator/rally-preview";
export const runtime="nodejs";
export const dynamic="force-dynamic";
export const metadata:Metadata={title:"生成プレビュー（運営者向け）"};
export default function OperatorPreviewPage(){
 let result;
 try{const current=getDraftRepository().load();result=createRallyPreview(current.draft,current.spots)}
 catch{result={state:"blocked" as const,reason:"unavailable",message:"下書き・道路・周辺情報を読み込めませんでした。保存先と固定データを確認して再試行してください。"}}
 return <main className="participant-main operator-main" data-operator-page="preview"><SiteHeader view="operator"/><section id="page-content" tabIndex={-1}><OperatorNav view="preview"/>
  {result.state==="ready"?<RallyPreviewView data={result}/>:<section className="preview-panel" role="alert" data-preview-blocked={result.reason}><p className="eyebrow">COURSE PREVIEW</p><h1>生成前に確認が必要です</h1><p>{result.message}</p><div className="preview-actions"><a href="/operator/draft">下書きを確認する</a><a href="/operator/preview">再試行する</a></div></section>}
 </section><RallyFooter/></main>;
}
