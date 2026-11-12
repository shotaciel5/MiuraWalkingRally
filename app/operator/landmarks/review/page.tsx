import type {Metadata} from "next";
import Link from "next/link";
import SiteHeader from "../../../site-header";
import OperatorNav from "../../../operator-nav";
import LandmarkWorkbench from "../../../landmark-workbench";
import {RallyFooter} from "../../../rally-ui";
import {loadLandmarkDataset} from "../../../../lib/landmarks/dataset";
import {workbenchState} from "../../../../lib/landmarks/workbench";
export const metadata:Metadata={title:"コマ図の目印を選ぶ（PoC）"};
export const runtime="nodejs";export const dynamic="force-dynamic";
export default async function LandmarkReviewPage({searchParams}:{searchParams:Promise<{source?:string}>}){
 const source=(await searchParams).source==="draft"?"draft":"sample";let state;
 try{state=workbenchState(loadLandmarkDataset(source))}catch{}
 return <main className="participant-main operator-main landmark-workbench-main" data-operator-page="landmark-review"><SiteHeader view="operator"/><section id="page-content" tabIndex={-1}><OperatorNav view="landmark-review"/><p className="eyebrow">LANDMARK REVIEW / POC</p><h1>このコマの、目印を選ぼう。</h1><p className="participant-lead">階段は必須表示。一時停止・横断箇所は初期採用。信号・看板などは、見え方を確かめて採用します。</p><div className="landmark-workbench-links"><Link prefetch={false} href="/operator/landmarks/review?source=draft" aria-current={source==="draft"?"page":undefined}>保存済み下書きのルート</Link><Link prefetch={false} href="/operator/landmarks/review" aria-current={source==="sample"?"page":undefined}>三崎下町サンプル</Link><Link href="/operator/landmarks">前回の表示比較</Link></div>{state?<LandmarkWorkbench key={state.dataset.id} initial={state}/>:<div role="alert" className="preview-panel"><p>下書きのルートまたはPoC保存先を読み込めませんでした。</p><Link href="/operator/draft">下書きを確認する</Link></div>}</section><RallyFooter/></main>;
}
