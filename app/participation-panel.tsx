"use client";

import {useEffect, useState} from "react";
import Link from "next/link";
import {useRouter} from "next/navigation";
import ParticipantNavigator from "./participant-navigator";
import {readParticipation, startParticipation, saveCheckpointConfirmation} from "../lib/participation";
import type {CheckpointWriteResult, ParticipationState, RallyEdition} from "../lib/participation";
import type {ParticipantCourse} from "../lib/participant-course";

type Props = {
  rally: RallyEdition & { title: string; href: string };
  view?: "detail" | "play";
  course?: ParticipantCourse;
};
const storage = () => window.sessionStorage;

export default function ParticipationPanel({rally, view = "detail", course}: Props) {
  const router = useRouter();
  const [state, setState] = useState<ParticipationState | {status: "loading" | "changed"}>({status: "loading"});
  useEffect(() => { setState(readParticipation(storage, rally)); }, [rally.id, rally.revision]);
  function refresh() {
    const next = readParticipation(storage, rally);
    setState(next);
    return next;
  }
  function begin(replace = false) {
    const next = startParticipation(storage, rally, {
      uuid: () => window.crypto.randomUUID(), now: () => new Date().toISOString(),
    }, replace);
    setState(next);
    if (next.status === "active" && view === "detail") router.push(rally.href + "/play");
  }
  function confirm(checkpointId: string): CheckpointWriteResult {
    if (state.status !== "active") return {status:"empty"};
    const result = saveCheckpointConfirmation(storage, rally, state.participation.participationId, {
      checkpointId, method:"demo-button", recordedAt:new Date().toISOString(),
    });
    if (result.status === "saved") setState({status:"active", participation:result.participation});
    else if (result.status === "different-participation") setState({status:"changed"});
    else if (result.status === "empty" || result.status === "invalid" || result.status === "different-edition") setState({status:result.status});
    return result;
  }
  const incompatible = state.status === "invalid" || state.status === "different-edition";
  if (view === "play" && state.status === "active" && course) return <>
    <section className="participant-session-bar" aria-label="デモの開始記録" data-participation-state="active">
      <div data-participation-id={state.participation.participationId} data-participation-revision={state.participation.rallyRevision}>
        <span className="participation-status">開始済み</span><span>このタブの記録を引き継いでいます。</span>
        <details className="session-details"><summary>開始記録と保持範囲</summary><p>開始：<time dateTime={state.participation.startedAt}>{new Intl.DateTimeFormat("ja-JP", {dateStyle:"medium", timeStyle:"short", timeZone:"Asia/Tokyo"}).format(new Date(state.participation.startedAt))}</time>。開始・デモ達成の記録はこのタブ内に一時保存します。通常はタブを閉じると消え、複製やブラウザ復元でコピー・復元される場合があります。閲覧位置は再読込みで最初に戻ります。コマを見るだけでは達成を記録しません。</p></details>
      </div>
    </section>
    <ParticipantNavigator key={state.participation.participationId} course={course} participation={state.participation} onConfirm={confirm} onRetry={refresh}/>
  </>;
  return <section className="participant-panel participation-start" aria-labelledby="demo-start-title" data-participation-state={state.status}>
    <p className="eyebrow">TRY THE DEMO</p>
    <h2 id="demo-start-title">{state.status === "active" ? "開始済みのデモ" : "デモを試す"}</h2>
    <p className="participant-note">ログインや個人情報の入力は不要です。コマ地図・地点情報の閲覧と、ボタンによるデモ達成を試せます。実際の到着は確認しません。</p>
    <p className="session-scope">開始・デモ達成の記録はこのタブ内に保存します。再読込み後も続けられますが、通常はタブを閉じると消えます。</p>
    {state.status === "loading" && <><p role="status">開始記録を確認しています…</p><noscript><p>デモの開始にはJavaScriptを有効にしてください。</p></noscript></>}
    {state.status === "active" && <div className="participation-active" data-participation-id={state.participation.participationId} data-participation-revision={state.participation.rallyRevision}>
      <span className="participation-status">開始済み</span><p>このタブの開始・デモ達成の記録を読み込みました。</p>
      <dl className="participation-start-facts"><div><dt>コース</dt><dd>{rally.title}</dd></div><div><dt>開始日時</dt><dd><time dateTime={state.participation.startedAt}>{new Intl.DateTimeFormat("ja-JP", {dateStyle:"medium", timeStyle:"short", timeZone:"Asia/Tokyo"}).format(new Date(state.participation.startedAt))}</time></dd></div></dl>
      <p className="demo-progress-count">デモ達成：{state.participation.achievements.length} / {rally.checkpointIds.length}</p>
      {view === "detail" && <Link href={rally.href + "/play"} className="rally-primary-link" data-demo-resume>開始したデモへ戻る<span aria-hidden="true">→</span></Link>}
    </div>}
    {incompatible && <p className="participation-error" role="alert">{state.status === "different-edition" ? "保存された記録は、現在のコースと版が異なるため続けられません。" : "保存された記録を読み取れません。"} 新しいデモを開始すると、このコースの古い開始・デモ達成の記録を置き換えます。</p>}
    {(state.status === "unavailable" || state.status === "changed") && <div className="participation-error" role="alert"><p>{state.status === "changed" ? "このタブの開始記録が変わりました。再確認してから続けてください。" : "このブラウザで記録を保存・確認できませんでした。ブラウザの保存設定を確認し、もう一度お試しください。"}</p><button type="button" className="rally-secondary-link" data-demo-retry onClick={refresh}>もう一度試す</button></div>}
    {(state.status === "empty" || incompatible) && <button type="button" className="rally-primary-link demo-start-button" data-demo-start onClick={() => begin(incompatible)}>{incompatible ? "新しいデモを開始" : "デモを開始"}<span aria-hidden="true">→</span></button>}
    <details className="session-details"><summary>記録の保持について</summary><p>同じブラウザ・同じ接続先・同じタブでのみ使う一時記録です。別の端末への引継ぎや長期保存はできません。タブの複製やブラウザの復元によって記録がコピー・復元される場合があります。閲覧では達成を記録せず、デモ用ボタンも実際の訪問を証明しません。</p></details>
  </section>;
}
