"use client";

import { useState } from "react";

type Coordinate = { lat: number; lon: number };
export type OverviewData = {
  roads: { id: number; points: Coordinate[]; walking: boolean }[];
  legs: { label: string; points: Coordinate[]; reference: Coordinate[] }[];
  stops: { id: string; name: string; point: Coordinate }[];
};

export default function RouteOverview({ data }: { data: OverviewData }) {
  const [selected, setSelected] = useState(-1);
  const [showReference, setShowReference] = useState(true);
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
      <svg className="route-map" viewBox={`0 0 ${width} ${height}`} role="img" aria-labelledby="map-title map-description">
        <title id="map-title">三崎下町の徒歩経路候補と手動参照ルート</title>
        <desc id="map-description">北が上の全体地図。緑は生成候補、オレンジの破線は生成前に固定した手動参照。道路の実際の通行可否は未確認です。</desc>
        <rect width={width} height={height} fill="#f3f2eb" />
        <g fill="none" strokeLinecap="round" strokeLinejoin="round">
          {data.roads.filter(road => visible(road.points)).map(road => (
            <polyline key={road.id} points={line(road.points)} stroke={road.walking ? "#d1d5cc" : "#c7b6ae"} strokeWidth={road.walking ? 3 : 2} strokeDasharray={road.walking ? undefined : "3 4"} />
          ))}
          {showReference && data.legs.map((leg, i) => (
            <polyline key={"ref" + i} data-reference-leg={i + 1} points={line(leg.reference)} stroke="#b86a28" strokeWidth={6} strokeDasharray="9 7" opacity={selected === -1 || selected === i ? 0.9 : 0.22} />
          ))}
          {data.legs.map((leg, i) => (
            <g key={i} opacity={selected === -1 || selected === i ? 1 : 0.16}>
              <polyline data-generated-leg={i + 1} points={line(leg.points)} stroke="#fff" strokeWidth={9} />
              <polyline points={line(leg.points)} stroke="#17634f" strokeWidth={5} />
            </g>
          ))}
        </g>
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
        <g className="map-annotations">
          <path d="M758 60V28m-6 9 6-9 6 9" stroke="#506154" fill="none" strokeWidth="2" />
          <text x={758} y={20} textAnchor="middle">N</text>
          <path d={`M30 560v8h${100 * scale}v-8`} fill="none" stroke="#506154" strokeWidth={2} />
          <text x={30} y={548}>100 m（概算）</text>
        </g>
      </svg>
      <div className="map-legend">
        <span><i className="legend-line generated" />生成候補</span>
        <label><input type="checkbox" checked={showReference} onChange={event => setShowReference(event.target.checked)} /><i className="legend-line reference" />手動参照を表示</label>
        <span><i className="legend-line road" />OSM道路</span>
      </div>
      <p className="map-attribution">道路データ © <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a> · ODbL 1.0</p>
      <p className="route-caption">道路中心線による比較用の地図です。道路幅や歩道、横断位置を表すものではありません。重なる往復区間は「区間」ボタンで確認できます。</p>
    </div>
  );
}
