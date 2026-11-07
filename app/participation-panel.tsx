"use client";

import {useEffect, useState} from "react";
import Link from "next/link";
import {useRouter} from "next/navigation";
import {readParticipation, startParticipation} from "../lib/participation";
import type {ParticipationState, RallyEdition} from "../lib/participation";

type Props = {
  rally: RallyEdition & { title: string; href: string };
  view?: "detail" | "play";
};
const storage = () => window.sessionStorage;

export default function ParticipationPanel({rally, view = "detail"}: Props) {
  const router = useRouter();
  const [state, setState] = useState<ParticipationState | {status: "loading"}>({status: "loading"});
  useEffect(() => { setState(readParticipation(storage, rally)); }, [rally.id, rally.revision]);
  function begin(replace = false) {
    const next = startParticipation(storage, rally, {
      uuid: () => window.crypto.randomUUID(), now: () => new Date().toISOString(),
    }, replace);
    setState(next);
    if (next.status === "active" && view === "detail") router.push(rally.href + "/play");
  }
  const incompatible = state.status === "invalid" || state.status === "different-edition";
  return <section className="participant-panel participation-start" aria-labelledby="demo-start-title" data-participation-state={state.status}>
    <p className="eyebrow">TRY THE DEMO</p>
    <h2 id="demo-start-title">{state.status === "active" ? "開始済みのデモ" : "デモを試す"}</h2>
    <p className="participant-note">ログインや個人情報の入力は不要です。試せるのはデモの開始と再表示です。実際の散策には使用できません。</p>
    <p className="session-scope">開始記録はこのタブ内に保存します。再読込み後も続けられますが、通常はタブを閉じると消えます。</p>
    {state.status === "loading" && <><p role="status">開始記録を確認しています…</p><noscript><p>デモの開始にはJavaScriptを有効にしてください。</p></noscript></>}
    {state.status === "active" && <div className="participation-active" data-participation-id={state.participation.participationId} data-participation-revision={state.participation.rallyRevision}>
      <span className="participation-status">開始済み</span>
      <p>このタブに開始記録が保存されています。</p>
      <dl className="participation-start-facts"><div><dt>コース</dt><dd>{rally.title}</dd></div><div><dt>開始日時</dt><dd><time dateTime={state.participation.startedAt}>{new Intl.DateTimeFormat("ja-JP", {dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Tokyo"}).format(new Date(state.participation.startedAt))}</time></dd></div></dl>
      {view === "detail"
        ? <Link href={rally.href + "/play"} className="rally-primary-link" data-demo-resume>開始したデモへ戻る<span aria-hidden="true">→</span></Link>
        : <p className="participant-note">コマ地図による案内・訪問判定・ゴールの操作は、まだ利用できません。地点の情報はコース詳細から確認できます。</p>}
    </div>}
    {incompatible && <p className="participation-error" role="alert">{state.status === "different-edition"
      ? "保存された開始記録は、現在のコースと版が異なるため続けられません。"
      : "保存された開始記録を読み取れません。"} 新しいデモを開始すると、このコースの古い開始記録を置き換えます。</p>}
    {state.status === "unavailable" && <div className="participation-error" role="alert"><p>このブラウザで開始記録を保存・確認できませんでした。ブラウザの保存設定を確認し、もう一度お試しください。</p><button type="button" className="rally-secondary-link" data-demo-retry onClick={() => setState(readParticipation(storage, rally))}>もう一度試す</button></div>}
    {(state.status === "empty" || incompatible) && <button type="button" className="rally-primary-link demo-start-button" data-demo-start onClick={() => begin(incompatible)}>{incompatible ? "新しいデモを開始" : "デモを開始"}<span aria-hidden="true">→</span></button>}
    <details className="session-details"><summary>記録の保持について</summary><p>同じブラウザ・同じ接続先・同じタブでのみ使う一時記録です。別の端末への引継ぎや長期保存はできません。タブの複製やブラウザの復元によって記録がコピー・復元される場合があります。開始だけではチェックポイントの達成にはなりません。</p></details>
  </section>;
}
