import Link from "next/link";

export default function SiteHeader({view="participant"}:{view?:"participant"|"poc"}){
  return <>
    <a className="skip-link" href="#page-content">本文へ移動</a>
    <header className="site-header rally-header">
      <Link href="/" className="brand brand-link" aria-label="三浦市ウォーキングラリー 一覧へ"><span className="brand-mark" aria-hidden="true">歩</span><span>三浦市<br className="brand-break"/>ウォーキングラリー</span></Link>
      <nav className="view-switch" aria-label="画面切替">
        <Link href="/" aria-current={view==="participant"?"true":undefined}>参加者向け</Link>
        <Link href="/poc" aria-current={view==="poc"?"true":undefined}>運営者向けPoC</Link>
      </nav>
    </header>
  </>;
}
