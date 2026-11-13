import Link from "next/link";
export default function OperatorNav({view}:{view:"home"|"spots"|"draft"|"preview"|"connections"|"courses"}){
 return <nav className="operator-tabs operator-workflow-nav" aria-label="運営者機能" data-operator-workflow>
  <Link prefetch={false} href="/operator" className="operator-work-home" aria-current={view==="home"?"page":undefined}>作業ホーム</Link>
  <ol className="operator-work-steps" aria-label="コースをつくる3ステップ">
   <li><Link prefetch={false} href="/operator/draft" aria-current={view==="draft"?"page":undefined}><span>1</span>地点を選ぶ</Link></li>
   <li><Link prefetch={false} href={view==="draft"?"/operator/draft#draft-next-action":"/operator/preview"} aria-current={view==="preview"?"page":view==="connections"?"step":undefined}><span>2</span>コマを確認・保存</Link></li>
   <li><Link prefetch={false} href="/operator/courses" aria-current={view==="courses"?"page":undefined}><span>3</span>参加者へ公開</Link></li>
  </ol>
  <Link prefetch={false} href="/operator/spots" className="operator-catalog-link" aria-current={view==="spots"?"page":undefined}>スポットを追加・編集</Link>
 </nav>;
}
