"use client";

import { useEffect, useState } from "react";
import type { JunctionCandidate } from "../lib/route/junctions";

import {nextOccurrenceIndex, type ReviewSelection} from "../lib/route/review";
import {placeLandmarkBadges} from "../lib/route/context";
import type {ContextData, KomaContext} from "../lib/route/context";
import type {ContextLayers} from "./koma-figure";

type Coordinate = { lat: number; lon: number };
export type OverviewData = {
  context:ContextData;
  paths:{generated:Coordinate[];reference:Coordinate[]};
  roads: { id: number; points: Coordinate[]; walking: boolean }[];
  legs: { label: string; points: Coordinate[]; reference: Coordinate[] }[];
  stops: { id: string; name: string; point: Coordinate }[];
  junctions: JunctionCandidate[];
  referenceJunctions: JunctionCandidate[];
};

export default function RouteOverview({ data, selection, onSelect, layers, context }: { data: OverviewData;selection:ReviewSelection;onSelect:(selection:ReviewSelection)=>void;layers:ContextLayers;context:KomaContext }) {
  const [selected, setSelected] = useState(-1);
  const [showReference, setShowReference] = useState(true);
  const {source:junctionSource,index:junctionIndex}=selection;
  useEffect(()=>{setSelected(-1)},[selection.source,selection.index]);
  const junctions = junctionSource === "generated" ? data.junctions : data.referenceJunctions;
  const selectedJunction = junctions[junctionIndex];
  const angle = (value: number | null) => value === null ? "—" : value.toFixed(1) + "°";
  const reasonNames = {start:"出発",finish:"終了",stop:"到着点",junction:"分岐",return:"折返し"};
  const accessNames = {candidate:"候補",excluded:"除外",review:"保留"};
  const pointName = (point: JunctionCandidate) => point.stopIds.map(id => data.stops.find(stop => stop.id === id)?.name ?? id).join(" / ");
  const selectSource = (source: "generated" | "reference") => {
    onSelect({source,index:0}); setSelected(-1);
    if (source === "reference") setShowReference(true);
  };
  const extent = data.legs.flatMap(leg => [...leg.points, ...leg.reference]);
  const midLat = extent.reduce((sum, p) => sum + p.lat, 0) / extent.length;
  const lonFactor = 111_195.08 * Math.cos(midLat * Math.PI / 180);
  const minX = Math.min(...extent.map(p => p.lon * lonFactor)) - 40;
  const maxX = Math.max(...extent.map(p => p.lon * lonFactor)) + 40;
  const minY = Math.min(...extent.map(p => p.lat * 111_195.08)) - 40;
  const maxY = Math.max(...extent.map(p => p.lat * 111_195.08)) + 40;
  const width = 800, height = 600;
  const scale = Math.min(width / (maxX - minX), height / (maxY - minY));
  const offsetX = (width - (maxX - minX) * scale) / 2;
  const offsetY = (height - (maxY - minY) * scale) / 2;
  const xy = (p: Coordinate) => [
    offsetX + (p.lon * lonFactor - minX) * scale,
    height - offsetY - (p.lat * 111_195.08 - minY) * scale,
  ];
  const line = (points: Coordinate[]) => points.map(p => xy(p).map(n => n.toFixed(2)).join(",")).join(" ");
  const visible = (points: Coordinate[]) => points.some(p => p.lon * lonFactor >= minX && p.lon * lonFactor <= maxX && p.lat * 111_195.08 >= minY && p.lat * 111_195.08 <= maxY);
  const path=data.paths[junctionSource];
  const next=junctions[junctionIndex+1];
  const segment=next?path.slice(selectedJunction.pathIndex,next.pathIndex+1):[];
  const pinIds=[...new Set(junctions.map(c=>c.nodeId))].sort((a,b)=>Number(a===selectedJunction.nodeId)-Number(b===selectedJunction.nodeId));
  const selectPin=(nodeId:number)=>onSelect({...selection,index:nextOccurrenceIndex(junctions,junctionIndex,nodeId)});
  const badges=placeLandmarkBadges(context.landmarks.map(l=>{const [x,y]=xy(l.point);return {x,y}}),width,height);
  const labels: Record<string, [number, number]> = { S: [16, 25], C1: [-92, -18], W1: [-62, -22], C2: [16, -17] };
  return (
    <div className="overview">
      <div className="map-controls" aria-label="地図の表示区間">
        <button type="button" aria-pressed={selected === -1} onClick={() => setSelected(-1)}>全区間</button>
        {data.legs.map((leg, i) => (
          <button key={leg.label} type="button" aria-pressed={selected === i} onClick={() => setSelected(i)}>
            区間 {i + 1}<span className="sr-only"> {leg.label}</span>
          </button>
        ))}
      </div>
      <p className="map-selection" aria-live="polite">
        {selected === -1 ? "全4区間を重ねて表示" : data.legs[selected].label}
      </p>
      <svg className="route-map" viewBox={`0 0 ${width} ${height}`} role="group" aria-labelledby="map-title map-description">
        <title id="map-title">三崎下町の徒歩経路候補と手動参照ルート</title>
        <desc id="map-description">北が上の全体地図。緑は生成候補、オレンジの破線は生成前に固定した手動参照。道路の実際の通行可否は未確認です。</desc>
        <rect width={width} height={height} fill="#f3f2eb" />
        {layers.buildings&&<g fill="#e4dfcf" stroke="#d0c8b5" strokeWidth=".7" pointerEvents="none">{data.context.buildings.filter(b=>visible(b.points)).map(b=><polygon key={b.id} data-overview-building={b.id} points={line(b.points)}/>)}</g>}
        <g fill="none" strokeLinecap="round" strokeLinejoin="round">
          {data.roads.filter(road => visible(road.points)).map(road => (
            <polyline key={road.id} points={line(road.points)} stroke={road.walking ? "#d1d5cc" : "#c7b6ae"} strokeWidth={road.walking ? 3 : 2} strokeDasharray={road.walking ? undefined : "3 4"} />
          ))}
          {(showReference||junctionSource==="reference") && data.legs.map((leg, i) => (
            <polyline key={"ref" + i} data-reference-leg={i + 1} points={line(leg.reference)} stroke="#b86a28" strokeWidth={6} strokeDasharray="9 7" opacity={selected === -1 || selected === i ? 0.9 : 0.22} />
          ))}
          {data.legs.map((leg, i) => (
            <g key={i} opacity={selected === -1 || selected === i ? 1 : 0.16}>
              <polyline data-generated-leg={i + 1} points={line(leg.points)} stroke="#fff" strokeWidth={9} />
              <polyline points={line(leg.points)} stroke="#17634f" strokeWidth={5} />
            </g>
          ))}
        </g>
        {segment.length>1&&<g fill="none" strokeLinecap="round" strokeLinejoin="round" pointerEvents="none"><polyline points={line(segment)} stroke="white" strokeWidth="12"/><polyline data-next-koma-segment={selectedJunction.sequence} points={line(segment)} stroke="#276bb4" strokeWidth="7"/></g>}
        {layers.landmarks&&context.landmarks.map((l,i)=>{const [x,y]=xy(l.point);return <g key={l.id} data-overview-landmark={l.id} pointerEvents="none"><circle cx={x} cy={y} r="3" fill="#79551d"/><path d={`M${x} ${y}L${badges[i].x} ${badges[i].y}`} stroke="#79551d"/><circle cx={badges[i].x} cy={badges[i].y} r="9" fill="#fff9e8" stroke="#8b692d"/><text x={badges[i].x} y={badges[i].y+4} textAnchor="middle" fontSize="12" fill="#63491e">{i+1}</text></g>})}
        {data.stops.filter(stop => stop.id !== "G").map(stop => {
          const [x, y] = xy(stop.point);
          const [dx, dy] = labels[stop.id] ?? [16, -18];
          return (
            <g key={stop.id}>
              <circle cx={x} cy={y} r={9} fill="#17634f" stroke="white" strokeWidth={3} />
              <text x={x + dx} y={y + dy} className="map-label">{stop.id === "S" ? "S / G 三崎港" : stop.id + " " + stop.name}</text>
            </g>
          );
        })}
        {pinIds.map(nodeId=>{
          const matches=junctions.filter(c=>c.nodeId===nodeId),candidate=matches.find(c=>c.sequence===selectedJunction.sequence)??matches[0];
          const [x,y]=xy(candidate.point),active=nodeId===selectedJunction.nodeId;
          const label=`コマ ${matches.map(c=>c.sequence).join("・")} の位置${matches.length>1?"。押すたびに再訪順に切替":""}`;
          return <g key={nodeId} role="button" tabIndex={0} aria-label={label} aria-pressed={active} data-map-pin={nodeId} onClick={()=>selectPin(nodeId)} onKeyDown={e=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();selectPin(nodeId)}}} className="map-pin">
            <circle cx={x} cy={y} r="13" fill="transparent"/>
            <circle cx={x} cy={y} r={active?13:5} fill={active?"#276bb4":"white"} stroke={active?"white":"#276bb4"} strokeWidth={active?3:2}/>
            {active&&<g data-junction-highlight={candidate.sequence} pointerEvents="none"><text x={x} y={y+4} textAnchor="middle" fontSize="11" fontWeight="700" fill="white">{candidate.sequence}</text></g>}
          </g>;
        })}
        <g className="map-annotations">
          <path d="M758 60V28m-6 9 6-9 6 9" stroke="#506154" fill="none" strokeWidth="2" />
          <text x={758} y={20} textAnchor="middle">N</text>
          <path d={`M30 560v8h${100 * scale}v-8`} fill="none" stroke="#506154" strokeWidth={2} />
          <text x={30} y={548}>100 m（概算）</text>
        </g>
      </svg>
      <div className="map-legend">
        <span><i className="legend-line generated" />生成候補</span>
        <label><input type="checkbox" checked={showReference||junctionSource==="reference"} disabled={junctionSource==="reference"} onChange={event => setShowReference(event.target.checked)} /><i className="legend-line reference" />手動参照を表示</label>
        <span><i className="legend-line road" />OSM道路</span><span><i className="legend-line active-segment"/>選択コマ → 次のコマ</span>
      </div>
      <p className="map-attribution">道路データ © <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a> · ODbL 1.0</p>
      <p className="map-linked-caption" aria-live="polite">選択中：{junctionSource==="generated"?"生成経路":"手動参照"}のコマ #{selectedJunction.sequence}。青い点がコマの位置、青い線が次のコマまでの道路です。GPS現在地ではありません。</p><p className="route-caption">地図の点を選ぶとコマも切り替わります。同じ点を繰り返し押すと再訪順に切り替わります。目印の番号はコマ図と共通です。</p><p className="route-caption">道路中心線による比較用の地図です。道路幅や歩道、横断位置を表すものではありません。重なる往復区間は「区間」ボタンで確認できます。</p>

      <section className="junction-inspector" aria-labelledby="junction-title" data-junction-count={junctions.length}>
        <h3 id="junction-title">選択コマの道路接続を照合する</h3>
        <p className="route-caption">元の道路接続から抽出した確認用の情報です。開始・終了・到着点を含み、再訪は別件に数えています。上のコマ図と元の接続・角度を照合できます。現地で使う案内の確認は未実施です。</p>
        <div className="junction-source" aria-label="分岐の比較対象">
          <button type="button" aria-pressed={junctionSource === "generated"} onClick={() => selectSource("generated")}>生成候補 {data.junctions.length}件</button>
          <button type="button" aria-pressed={junctionSource === "reference"} onClick={() => selectSource("reference")}>手動参照 {data.referenceJunctions.length}件</button>
        </div>
        <label htmlFor="junction-point">通過する候補を選択</label>
        <select id="junction-point" value={junctionIndex} onChange={event => {onSelect({...selection,index:Number(event.target.value)}); setSelected(-1);}}>
          {junctions.map((point, i) => <option key={point.pathIndex} value={i}>#{point.sequence} {pointName(point) || "分岐"} · 累積{Math.round(point.metersFromStart)}m</option>)}
        </select>
        {selectedJunction && (
          <div className="junction-result" aria-live="polite" data-junction-sequence={selectedJunction.sequence}>
            <p className="junction-kind">#{selectedJunction.sequence} {pointName(selectedJunction)} · {selectedJunction.reasons.map(reason => reasonNames[reason]).join(" / ")}</p>
            <dl className="junction-metrics">
              <div><dt>接続する枝</dt><dd>{selectedJunction.branches.length}本</dd></div>
              <div><dt>次の候補まで</dt><dd>{selectedJunction.metersToNext === null ? "終了" : Math.round(selectedJunction.metersToNext) + " m"}</dd></div>
              <div><dt>進入 → 退出（北基準）</dt><dd>{angle(selectedJunction.arrival?.bearingDegrees ?? null)} → {angle(selectedJunction.departure?.bearingDegrees ?? null)}</dd></div>
              <div><dt>進入方向からの相対角</dt><dd>{angle(selectedJunction.turnDegrees)}</dd></div>
            </dl>
            <p className="route-caption">北基準は北0°・時計回り。相対角は正が右、負が左で、−180°は折返し方向です。角度は直近の元ノード間から計算しています。</p>
            {selectedJunction.issues.length > 0 && <p className="junction-warning">角度・通行条件・切出し範囲に確認が必要なデータがあります。確定した案内として扱えません。</p>}
            <details className="junction-evidence">
              <summary>接続・方向の根拠を見る</summary>
              <p>通過位置 {selectedJunction.pathIndex} · <a href={`https://www.openstreetmap.org/node/${selectedJunction.nodeId}`}>OSM node/{selectedJunction.nodeId}</a>。同じ場所の再訪も、通過順に別の候補として記録します。</p>
              <p>各枝の角度は分岐から外へ向く方向です。進入の向きは、進入枝の反対向きです。</p>
              <div className="table-scroll"><table><caption className="sr-only">選択した分岐に接続する各枝の根拠</caption><thead><tr><th>接続先・道路</th><th>経路上の役割</th><th>外向き北 / 相対角</th><th>徒歩 進入 / 退出</th></tr></thead><tbody>
                {selectedJunction.branches.map(branch => (
                  <tr key={branch.neighborNodeId}>
                    <td><a href={`https://www.openstreetmap.org/node/${branch.neighborNodeId}`}>node/{branch.neighborNodeId}</a><span className="branch-ways">{branch.evidence.map(e => <a key={e.wayId} href={`https://www.openstreetmap.org/way/${e.wayId}`}>way/{e.wayId} ({e.highway})</a>)}</span></td>
                    <td>{[branch.arrival ? "進入" : "", branch.departure ? "退出" : ""].filter(Boolean).join("・") || "他の枝"}</td>
                    <td>{angle(branch.bearingDegrees)} / {angle(branch.relativeDegrees)}</td>
                    <td>{accessNames[branch.entry]} / {accessNames[branch.exit]}</td>
                  </tr>
                ))}
              </tbody></table></div>
              <p>枝の通行状態は隣接する1区間のデータ上の判定です。先の道路全体の通行許可・安全性を保証しません。座標は選択時点の固定データを使い、リンク先OSMの更新後の内容とは異なる場合があります。</p>
            </details>
          </div>
        )}
      </section>
    </div>
  );
}
