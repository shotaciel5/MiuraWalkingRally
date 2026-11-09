import Link from "next/link";
export default function OperatorNav({view}:{view:"spots"|"draft"|"preview"}){
 return <nav className="operator-tabs" aria-label="運営者機能"><Link href="/operator/spots" aria-current={view==="spots"?"page":undefined}>スポット台帳</Link><Link href="/operator/draft" aria-current={view==="draft"?"page":undefined}>ラリー下書き</Link>{view==="preview"&&<span aria-current="page" className="preview-nav-current">生成プレビュー</span>}</nav>;
}
