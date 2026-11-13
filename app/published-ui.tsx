import Link from "next/link";
import type {PublishedRally} from "../lib/published-course";
export function PublishedBadge(){return <span className="published-badge">公開コース</span>}
export function PublishedNotice(){return <aside className="demo-notice" aria-label="道順と安全性の確認"><span aria-hidden="true" className="demo-notice-mark">i</span><div><strong>現地の入口・通行・安全性は確認待ちです</strong><p>周囲の安全と通行条件を確かめ、画面の操作は立ち止まって行ってください。</p></div></aside>}
export function PublishedFacts({rally}:{rally:PublishedRally}){return <dl className="rally-facts" aria-label="コースの目安"><div><dt>道路上の距離</dt><dd data-published-meters={rally.distanceMeters}>約 <strong>{(rally.distanceMeters/1000).toFixed(2)}</strong> km</dd></div><div><dt>歩行のみの目安</dt><dd>約 <strong>{rally.walkingMinutes}</strong> 分</dd></div><div><dt>コマ地図</dt><dd><strong>{rally.cardCount}</strong> 枚</dd></div></dl>}
export function PublishedUnavailable({href="/courses"}:{href?:string}){return <section className="participant-panel" role="alert" data-published-unavailable><h1>コースを読み込めませんでした</h1><p>時間をおいて再試行してください。</p><Link href={href} className="rally-secondary-link">再試行する</Link></section>}

export function PublishedAttribution(){return <p className="map-attribution">スポット・道路・目印 © <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a> · <a href="https://opendatacommons.org/licenses/odbl/1-0/">ODbL 1.0</a></p>}

export function PublishedStopped({compact=false}={}){const Heading=compact?"h2":"h1";return <section className="participant-panel" role="status" data-published-stopped><Heading>このコースは公開を停止しています</Heading><p>現在はコースを開始・閲覧できません。</p><p>同じ内容が再公開された場合は、同じタブに残る開始記録を引き継げます。</p><a href="/courses" className="rally-secondary-link">公開コースへ戻る</a></section>}
