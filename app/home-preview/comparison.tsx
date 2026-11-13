"use client";
import Link from "next/link";
import {useState} from "react";

type Mode="current"|"proposal"|"both";
export default function HomeComparison(){
 const [mode,setMode]=useState<Mode>("both"),[mobile,setMobile]=useState(false);
 return <main className="home-comparison" data-home-comparison>
  <header className="hc-toolbar">
   <div className="hc-title"><Link href="/">← ホームへ</Link><h1>ホームのデザイン比較</h1><span>改善案は未採用です</span></div>
   <div className="hc-options">
    <div className="hc-switch" role="group" aria-label="比較する画面">
     {([["current","現行"],["proposal","改善案"],["both","並べて比較"]] as const).map(([value,label])=><button key={value} type="button" aria-pressed={mode===value} onClick={()=>setMode(value)} data-compare-mode={value}>{label}</button>)}
    </div>
    <div className="hc-switch" role="group" aria-label="表示幅">
     <button type="button" aria-pressed={!mobile} onClick={()=>setMobile(false)} data-compare-width="normal">通常幅</button>
     <button type="button" aria-pressed={mobile} onClick={()=>setMobile(true)} data-compare-width="mobile">スマホ幅</button>
    </div>
   </div>
   <p>それぞれの画面内でスクロールできます。「現行」「改善案」で大きく表示して比較できます。スマホ幅は390pxを上限にします。</p>
  </header>
  <div className={"hc-workspace"+(mode==="both"?" is-both":"")+(mobile?" is-mobile":"")} data-comparison-layout={mode}>
   {mode!=="proposal"&&<section className="hc-pane" aria-label="現行ホーム">
    <div className="hc-pane-label"><strong>現行</strong><Link href="/" target="_blank" rel="noopener noreferrer">別タブで開く ↗</Link></div>
    <div className="hc-frame-wrap"><iframe src="/" title="現行のホーム画面" loading="eager" data-current-frame/></div>
   </section>}
   {mode!=="current"&&<section className="hc-pane" aria-label="改善案ホーム">
    <div className="hc-pane-label"><strong>改善案 <span>未採用</span></strong><Link href="/home-preview/proposal" target="_blank" rel="noopener noreferrer">別タブで開く ↗</Link></div>
    <div className="hc-frame-wrap"><iframe src="/home-preview/proposal" title="改善案のホーム画面" loading="eager" data-proposal-frame/></div>
   </section>}
  </div>
 </main>;
}
