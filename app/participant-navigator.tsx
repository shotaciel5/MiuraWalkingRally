"use client";

import {useRef, useState} from "react";
import KomaFigure from "./koma-figure";
import type {ParticipantCourse, ParticipantSpot} from "../lib/participant-course";
import {participantFrame} from "../lib/participant-view";
import type {CheckpointConfirmation, CheckpointWriteResult, Participation} from "../lib/participation";

type Feedback = {checkpointId:string; ok:boolean; message:string} | null;
function SpotDetails({spot, achievement, onConfirm, feedback, onRetry}: {spot:ParticipantSpot; achievement?:CheckpointConfirmation; onConfirm:(id:string)=>void; feedback:Feedback; onRetry:()=>void}) {
  const [photoFailed, setPhotoFailed] = useState(false);
  const photo = spot.photo;
  return <article className="participant-spot" data-participant-spot={spot.id}>
    <p className="participant-stop-role">{spot.role}</p>
    <h3>{spot.name}</h3>
    {spot.kind === "checkpoint" && <span className={"checkpoint-state"+(achievement?" demo-achieved":"")}>{achievement?"デモ達成済み":"未達成"}</span>}
    <p>{spot.description}</p>
    {spot.kind === "checkpoint" && <div className="demo-confirmation">
      <button type="button" className="rally-primary-link" data-demo-confirm={spot.id} disabled={!!achievement} onClick={() => onConfirm(spot.id)}>{achievement ? "デモ達成済み" : "デモ用：達成にする"}</button>
      <p className="participant-note">テスト用の操作です。実際の到着は確認しません。</p>
      {achievement && <p className="demo-recorded-time">記録：<time dateTime={achievement.recordedAt}>{new Intl.DateTimeFormat("ja-JP", {dateStyle:"medium", timeStyle:"short", timeZone:"Asia/Tokyo"}).format(new Date(achievement.recordedAt))}</time></p>}
      {feedback?.checkpointId === spot.id && <div role={feedback.ok?"status":"alert"} className={feedback.ok?"demo-save-success":"participation-error"} data-checkpoint-feedback={feedback.ok?"saved":"error"}><p>{feedback.message}</p>{!feedback.ok && <button type="button" className="rally-secondary-link" data-checkpoint-retry onClick={onRetry}>保存状態を再確認</button>}</div>}
    </div>}
    {photo && <figure className="participant-spot-photo" data-spot-photo={spot.id}>
      <img src={photo.path} alt={photo.alt} width={photo.width} height={photo.height} loading="lazy" decoding="async" hidden={photoFailed} onError={() => setPhotoFailed(true)}/>
      {photoFailed && <p className="photo-unavailable" role="status">参考写真を表示できません。地点名と説明をご確認ください。</p>}
      <figcaption>
        <span>{photo.capturedLabel}撮影の参考写真。現在の入口・到着位置や認証用の撮影対象を指定するものではありません。</span>
        <span><a href={photo.sourceUrl}>{photo.title}</a> / <a href={photo.creatorUrl}>{photo.creator}</a> / <a href={photo.licenseUrl}>{photo.license}</a></span>
        <span>{photo.changes}</span>
      </figcaption>
    </figure>}
  </article>;
}

export default function ParticipantNavigator({course, participation, onConfirm, onRetry}: {course:ParticipantCourse; participation:Participation; onConfirm:(id:string)=>CheckpointWriteResult; onRetry:()=>unknown}) {
  const [index, setIndex] = useState(0);
  const [feedback, setFeedback] = useState<Feedback>(null);
  function confirm(id:string) {
    const result = onConfirm(id);
    setFeedback({checkpointId:id, ok:result.status==="saved", message:result.status==="saved" ? (result.added?"デモ達成を記録しました。":"すでにデモ達成として記録されています。") : result.status==="invalid-confirmation" ? "この地点や記録時刻を確認できません。端末の時刻設定などを確認し、再度お試しください。" : "デモ達成の保存を確認できませんでした。保存状態を再確認してから、もう一度お試しください。"});
  }
  function retry() { onRetry(); setFeedback(null); }
  const cardTitle = useRef<HTMLHeadingElement>(null);
  const {card, stops} = participantFrame(course, index);
  const checkpoints = course.stops.filter(s => s.kind === "checkpoint");
  const name = stops.map(s => s.name).join(" / ") || "分岐";
  const kind = card.map.kind === "return" ? "同じ道を戻る" : card.map.kind === "start" ? "出発地点" : card.map.kind === "finish" ? "コース図の最後" : "分岐";
  function showCheckpoint(id: string) {
    const next = course.cards.findIndex(c => c.stopIds.includes(id));
    if (next < 0) return;
    setIndex(next);
    // Keep focus on the changed frame when jumping from the checkpoint list.
    cardTitle.current?.focus({preventScroll:true});
    cardTitle.current?.scrollIntoView({block:"start"});
  }
  return <section className="participant-navigation" aria-label="コマとチェックポイントの閲覧" data-participant-navigator data-participant-koma-count={course.cards.length}>
    <div className="participant-navigation-layout">
      <section className="participant-panel participant-frame" aria-labelledby="participant-card-title" data-participant-frame={card.map.sequence}>
        <div className="participant-frame-heading"><p className="eyebrow" role="status" aria-live="polite" aria-atomic="true">コマ {card.map.sequence} / {course.cards.length}</p><span>{kind}</span></div>
        <h2 ref={cardTitle} id="participant-card-title" tabIndex={-1}>{name}</h2>
        <p className="participant-figure-guide">{card.map.kind === "start" ? "黒点が出発点です。上を向いた緑の矢印の枝へ進みます。" : card.map.kind === "finish" ? "黒点のある道から、図の中央の終了地点へ。退出の矢印はありません。" : card.map.kind === "return" ? "黒点のある道から入り、同じ道を戻ります。緑の矢印が戻る方向です。" : "黒点のある道から入り、緑の矢印の枝へ。入ってきた道が下になる向きです。"}</p>
        <div className="participant-figure"><KomaFigure map={card.map} name={name} context={card.context} layers={{buildings:true,landmarks:true,details:true}}/></div>
        <div className="koma-distance" data-participant-distance={card.map.metersToNext ?? ""}><span>{card.map.metersToNext === null ? "最後のコマを表示しています" : "次のコマまで"}</span>{card.map.metersToNext !== null && <strong>{Math.round(card.map.metersToNext)}<small> m</small></strong>}<span className="koma-cumulative">出発から {Math.round(card.map.metersFromStart)} m</span></div>
        <div className="koma-navigation"><button type="button" data-participant-prev disabled={index === 0} onClick={() => setIndex(i => Math.max(0, i-1))}>← 前のコマ</button><button type="button" data-participant-next disabled={index === course.cards.length-1} onClick={() => setIndex(i => Math.min(course.cards.length-1, i+1))}>次のコマ →</button></div>
        <label className="participant-koma-select" htmlFor="participant-koma-select">閲覧するコマ<select id="participant-koma-select" value={index} onChange={e => setIndex(Number(e.target.value))}>{course.cards.map((c,i) => <option key={c.map.pathIndex} value={i}>#{c.map.sequence} {c.stopIds.map(id => course.stops.find(s => s.id === id)?.name).join(" / ") || "分岐"}</option>)}</select></label>
        {card.map.kind === "finish" && <p className="participant-finish-note" role="note">コース図の最後です。実際の到着やゴールの判定は行っていません。</p>}
        <div className="participant-spot-details">{stops.map(spot => <SpotDetails key={spot.id} spot={spot} achievement={participation.achievements.find(a=>a.checkpointId===spot.id)} onConfirm={confirm} feedback={feedback} onRetry={retry}/>)}</div>
        <details className="participant-map-notes"><summary>図の見方・出典</summary><p>道路の曲がりと枝を切り出した模式図です。距離は道路沿いの概算で、図の長さとは異なります。道幅・歩道・安全な横断位置は表しません。</p><p>茶色の横線は階段です。目印は30m以内の最大4件で、引出線の先が元データの位置です。破線の「停」は停止点の記録で、歩行者への指示ではありません。</p><p>施設の入口・通行・現地の安全性は確認待ちです。コマの選択はGPS現在地や到着の判定ではありません。</p></details>
        <p className="map-attribution">道路・目印 © <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a> · <a href="https://opendatacommons.org/licenses/odbl/1-0/">ODbL 1.0</a></p>
      </section>
      <aside className="participant-panel participant-checkpoints" aria-labelledby="participant-checkpoints-title">
        <p className="eyebrow">CHECKPOINTS</p><h2 id="participant-checkpoints-title">チェックポイント候補</h2>
        <p className="participant-note">デモ用ボタンの操作を一時保存します。コマや写真を見るだけでは記録は変わりません。実際の到着は確認しません。</p><p className="demo-progress-count" data-achievement-count={participation.achievements.length}>デモ達成：{participation.achievements.length} / {checkpoints.length}</p>
        <ol>{checkpoints.map(spot => {
          const achieved = participation.achievements.some(a=>a.checkpointId===spot.id);
          return <li key={spot.id} data-participant-checkpoint={spot.id} data-checkpoint-status={achieved?"demo-completed":"unverified"}><strong>{spot.name}</strong><span className={"checkpoint-state"+(achieved?" demo-achieved":"")}>{achieved?"デモ達成済み":"未達成"}</span><button type="button" onClick={() => showCheckpoint(spot.id)} data-checkpoint-frame={spot.id}>{spot.name}のコマを見る<span aria-hidden="true">→</span></button></li>;
        })}</ol>
        <p className="participant-note">光念寺は経由地候補です。チェックポイントの達成対象には含めていません。</p>
        <p className="participant-note navigation-retention">閲覧位置は画面内だけで保持し、再読込みすると最初のコマに戻ります。</p>
      </aside>
    </div>
  </section>;
}
