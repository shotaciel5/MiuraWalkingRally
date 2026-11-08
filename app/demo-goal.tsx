"use client";

import {useState} from "react";
import type {GoalWriteResult, Participation} from "../lib/participation";

type Props = {
  participation: Participation;
  requirements: {id:string; name:string; achieved:boolean}[];
  onFinish: () => GoalWriteResult;
  onRetry: () => unknown;
};
export default function DemoGoal({participation, requirements, onFinish, onRetry}: Props) {
  const [error, setError] = useState<string | null>(null);
  const eligible = requirements.length > 0 && requirements.every(r=>r.achieved);
  const completion = participation.completion;
  function finish() {
    const result = onFinish();
    if (result.status === "finished") setError(null);
    else setError(result.status === "incomplete" ? "未達成のチェックポイントがあります。達成記録を確認してください。" : result.status === "invalid-confirmation" ? "ゴール地点や終了時刻を確認できません。端末の時刻設定などを確認してください。" : "終了記録の保存を確認できませんでした。保存状態を再確認してから、もう一度お試しください。");
  }
  return <section className="demo-goal" aria-labelledby="demo-goal-title" data-demo-goal>
    <p className="eyebrow">DEMO GOAL</p>
    <h3 id="demo-goal-title">{completion ? "デモを完了しました" : "最後のコマでデモを終了"}</h3>
    {completion ? <div className="demo-goal-result" role="status" data-demo-goal-result data-demo-finished-at={completion.recordedAt}>
      <span className="participation-status">デモ終了済み</span>
      <p>両チェックポイントのデモ達成と、ゴールボタンの操作を記録しました。</p>
      <p className="demo-finished-time">終了日時：<time dateTime={completion.recordedAt}>{new Intl.DateTimeFormat("ja-JP", {dateStyle:"medium", timeStyle:"short", timeZone:"Asia/Tokyo"}).format(new Date(completion.recordedAt))}</time></p>
      <button type="button" className="rally-primary-link" data-demo-finish disabled>デモ終了済み</button>
      <p className="participant-note">コマ地図は引き続き見返せます。クーポンの発行・表示は、まだ利用できません。</p>
    </div> : <>
      <p className="participant-note" id="demo-goal-condition">両チェックポイントをデモ達成にした後、このボタンで終了を記録できます。最後のコマを見ただけでは終了しません。</p>
      <ul className="demo-goal-requirements">{requirements.map(r=><li key={r.id}><span>{r.name}</span><span className={"checkpoint-state"+(r.achieved?" demo-achieved":"")}>{r.achieved?"デモ達成済み":"未達成"}</span></li>)}</ul>
      <button type="button" className="rally-primary-link" data-demo-finish disabled={!eligible} aria-describedby="demo-goal-condition" onClick={finish}>デモ用：ゴールする</button>
      {!eligible && <p className="participant-note">未達成のチェックポイントを、デモ用ボタンで記録してください。</p>}
      {error && <div className="participation-error" role="alert" data-goal-feedback="error"><p>{error}</p><button type="button" className="rally-secondary-link" data-goal-retry onClick={()=>{onRetry();setError(null)}}>保存状態を再確認</button></div>}
    </>}
    <p className="participant-note demo-goal-limit">開発用の終了記録です。実際の到着・歩行は確認しません。</p>
  </section>;
}
