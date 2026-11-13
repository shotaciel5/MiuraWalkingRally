import Link from "next/link";
import {ArrowIcon} from "./rally-ui";

export default function SiteHeader({view="participant",storyHref="/#how-it-works"}:{view?:"home"|"participant"|"operator";storyHref?:string}){
  return <>
    <a className="skip-link" href="#page-content">本文へ移動</a>
    <header className="site-header experience-header" data-site-header={view}>
      <Link href="/" className="brand brand-link" aria-label="三浦市ウォーキングラリー トップへ">
        <span className="experience-mark" aria-hidden="true"><svg viewBox="0 0 32 32" fill="none"><path d="M8 25V14h15V6m-5 5 5-5 5 5" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"/><circle cx="8" cy="25" r="3" fill="currentColor"/></svg></span>
        <span className="experience-brand"><small>MIURA WALKING RALLY</small><span>三浦市ウォーキングラリー</span></span>
      </Link>
      <nav className="experience-header-links" aria-label="メインナビゲーション">
        {view==="home"?<>
          <Link className="header-story" href={storyHref}>楽しみ方</Link>
          <Link className="header-operator" href="/operator">コースをつくる</Link>
          <Link className="header-action" href="/courses">参加する<ArrowIcon/></Link>
        </>:<>
          <span className="header-context">{view==="operator"?"運営者の方へ":"参加者の方へ"}</span>
          <Link href={view==="operator"?"/courses":"/"}>{view==="operator"?"参加者の画面へ":"トップへ"}<ArrowIcon/></Link>
        </>}
      </nav>
    </header>
  </>;
}
