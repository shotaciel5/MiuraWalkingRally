import {arrowPath} from "../lib/route/koma.ts";
const esc=value=>String(value??"").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;");
const n=value=>Number(value).toFixed(2),m=value=>Number(value).toFixed(1),idLink=(type,id)=>'<a href="https://www.openstreetmap.org/'+type+'/'+id+'">'+type+'/'+id+'</a>';
function northMap(lines,marks,key,bounds=null,width=720,height=420){
 const all=lines.flatMap(l=>l.points).concat(marks.map(m=>m.point));
 if(!bounds)bounds={south:Math.min(...all.map(p=>p.lat))-.00008,north:Math.max(...all.map(p=>p.lat))+.00008,west:Math.min(...all.map(p=>p.lon))-.00008,east:Math.max(...all.map(p=>p.lon))+.00008};
 const c=Math.cos((bounds.south+bounds.north)/2*Math.PI/180),scale=Math.min((width-50)/((bounds.east-bounds.west)*c),(height-60)/(bounds.north-bounds.south));
 const dx=(width-(bounds.east-bounds.west)*c*scale)/2,dy=(height-(bounds.north-bounds.south)*scale)/2;
 const xy=p=>({x:dx+(p.lon-bounds.west)*c*scale,y:height-dy-(p.lat-bounds.south)*scale});
 const colors={major:"#367c58",minor:"#734b9b",review:"#b36715",other:"#d6d9db",route:"#087b64",arrival:"#263d34",departure:"#087b64"};
 const title="北が上・固定OSMの道路形状。紫は別グループ、橙破線は確認待ち道路。";
 return '<svg role="img" aria-label="'+title+'" viewBox="0 0 '+width+' '+height+'"><title>'+title+'</title><defs><clipPath id="'+key+'"><rect x="5" y="5" width="'+(width-10)+'" height="'+(height-10)+'"/></clipPath></defs><rect width="'+width+'" height="'+height+'" fill="#f7f8f4"/><g clip-path="url(#'+key+')">'+lines.map(l=>'<polyline points="'+l.points.map(p=>{const v=xy(p);return n(v.x)+","+n(v.y)}).join(" ")+'" fill="none" stroke="'+(colors[l.kind]??colors.other)+'" stroke-width="'+(l.kind==="route"?4:l.kind==="review"?3:1.8)+'"'+(l.kind==="review"?' stroke-dasharray="5 4"':"")+'><title>'+esc(l.id?"way/"+l.id+" "+JSON.stringify(l.tags??{}):l.kind)+'</title></polyline>').join("")+marks.map(p=>{const v=xy(p.point);return '<g><circle cx="'+n(v.x)+'" cy="'+n(v.y)+'" r="'+(p.gate?6:4)+'" fill="'+(p.gate?"#b36715":"#135aa1")+'"/><text x="'+n(v.x+7)+'" y="'+n(v.y-6)+'">'+esc(p.name??p.id)+'</text><title>'+esc(p.id??"")+'</title></g>'}).join("")+'</g><text x="12" y="22">N ↑</text><text x="12" y="'+(height-12)+'">元データの接続・形状の参照図 / 現地未確認</text></svg>';
}
function koma(map,context,key){
 if(map.state==="held")return '<div class="held">案内図は保留<br><small>枝を省略・延長せず、元データの確認を続ける。</small></div>';
 const coords=points=>points.map(p=>n(p.x)+","+n(p.y)).join(" "),incoming=map.branches.find(b=>b.arrival),outgoing=map.branches.find(b=>b.departure),dot=incoming?.points.at(-1);
 return '<svg role="img" aria-label="生成モデルのコマ図" viewBox="0 0 300 280"><title>生成モデルのコマ'+map.sequence+'</title><defs><marker id="'+key+'" markerWidth="10" markerHeight="10" refX="8" refY="5" orient="auto" markerUnits="userSpaceOnUse"><path d="M0 0L10 5L0 10Z" fill="#087b64"/></marker></defs><rect width="300" height="280" rx="8" fill="#f5f6ef"/>'+
 (context?.buildings??[]).map(b=>'<polygon points="'+coords(b.points)+'" fill="#e4dfcf" stroke="#d0c8b5"><title>'+esc(b.id)+'</title></polygon>').join("")+
 map.branches.map(b=>'<polyline points="'+coords(b.points)+'" fill="none" stroke="'+(b.exit==="candidate"?"#b7c5b9":b.exit==="review"?"#aa7d33":"#8c958b")+'" stroke-width="7"'+(b.exit==="candidate"?"":' stroke-dasharray="4 4"')+'/>').join("")+
 (incoming?'<polyline points="'+coords(incoming.points)+'" fill="none" stroke="#263d34" stroke-width="7"/>':"")+
 (outgoing?'<polyline points="'+coords(arrowPath(outgoing.points))+'" fill="none" stroke="#087b64" stroke-width="4" marker-end="url(#'+key+')"/>':"")+
 (dot?'<circle cx="'+n(dot.x)+'" cy="'+n(dot.y)+'" r="6" fill="#263d34"/>':"")+
 (context?.landmarks??[]).map(f=>'<circle cx="'+n(f.x)+'" cy="'+n(f.y)+'" r="3" fill="#9a5b24"><title>'+esc(f.id+" "+f.name+" "+f.symbol)+'</title></circle>').join("")+
 '<circle cx="150" cy="140" r="4" fill="white" stroke="#263d34"/><text x="150" y="263" text-anchor="middle">'+(map.kind==="start"?"出る方向が上":map.kind==="finish"?"ここで終了":"入ってきた道が下")+'</text></svg>';
}
export function renderExpandedAudit({report:r,groupFigures,caseFigures}){
 const groupSections=r.groups.slice(1).map(g=>{
  const v=groupFigures.find(v=>v.id===g.id);
  return '<section id="'+g.id+'"><h2>'+g.id+'：別接続グループ '+g.spots+'地点</h2><p>歩行グラフ '+g.walkingNodes+'ノード。'+(g.diagnosis==="no-shared-source-road-link"?"他グループへ続く道路ノードの共有が元データにない。":"元データの境界線分に、保留・除外条件がある。")+'</p>'+
   northMap(v.lines,v.spots.map(s=>({...s})).concat(v.gates.map(g=>({...g,name:"ゲート "+g.id,gate:true}))),g.id,v.bounds)+
   '<p class="legend">緑：最大グループ / 紫：このグループ / 橙破線：境界の確認待ち道路 / 灰：周辺道路 / 青：施設位置</p><div class="scroll"><table><thead><tr><th>施設</th><th>自動候補</th><th>最大グループの近傍道路（調査用）</th></tr></thead><tbody>'+
   g.members.map(s=>'<tr><td>'+esc(s.name)+'<br>'+esc(s.id)+'</td><td>'+idLink("way",s.automatic.wayId)+'<br>施設から直線 '+m(s.automatic.gapMeters)+'m</td><td>'+idLink("way",s.nearestMajorForInspectionOnly.wayId)+'<br>直線 '+m(s.nearestMajorForInspectionOnly.gapMeters)+'m<br><code>'+esc(JSON.stringify(s.nearestMajorForInspectionOnly.tags))+'</code></td></tr>').join("")+
   '</tbody></table></div><p><strong>調査用の近傍道路は採用していない。</strong>橋・高低差・建物・敷地境界を越えて接続できる根拠にはならない。</p>'+
   '<details><summary>境界の元道路・ノード・判定（'+g.cuts.length+'線分）</summary>'+g.cuts.map(c=>'<p>'+idLink("way",c.wayId)+'：'+idLink("node",c.from)+' → '+idLink("node",c.to)+'<br><code>'+esc(JSON.stringify(c.tags))+'</code><br>'+esc(c.wayPolicy.state+": "+c.wayPolicy.reason)+c.nodes.map(n=>'<br>'+idLink("node",n.id)+' <code>'+esc(JSON.stringify(n.tags))+'</code> '+esc(n.reason)).join("")+'</p>').join("")+'</details></section>';
 }).join("");
 const cases=r.cases.map(c=>{
  if(c.state!=="ready")return '<section id="'+c.id+'"><h2>'+esc(c.label)+'</h2><p class="held">道路上候補を結ぶ経路がなく停止。直線で代用しない。</p></section>';
  const v=caseFigures.find(v=>v.id===c.id),heldRows=c.held.map(h=>'<tr><td>#'+h.sequence+'</td><td>'+esc(h.nodeId)+'</td><td>'+h.selectedArms.map(a=>(a.arrival?"進入":"")+(a.arrival&&a.departure?"/":"")+(a.departure?"退出":"")+': '+m(a.meters)+'m / '+m(a.pathPixels)+'px / '+esc(a.endReason)).join("<br>")+'</td></tr>').join("");
  const overview=northMap(v.roads.map(w=>({...w,kind:"other"})).concat([{points:v.path,kind:"route"}]),v.visits.map(s=>({id:s.spotId,name:s.name,point:s.point})),c.id);
  const details=v.illustrations.map(f=>{
   const lines=f.traces.map(t=>({points:t.points,kind:t.arrival?"arrival":t.departure?"departure":"other"}));
   return '<article id="'+c.id+'-k'+f.sequence+'"><h3>#'+f.sequence+' / '+(f.state==="held"?"図は保留":"生成図")+'</h3><p>'+esc(f.nodeId>0?"node/"+f.nodeId:"道路途中の仮ノード "+f.nodeId)+' / '+f.point.lat.toFixed(7)+', '+f.point.lon.toFixed(7)+'</p><div class="compare"><figure>'+northMap(lines,[{point:f.point,name:"中心"}],c.id+"-n"+f.sequence,null,300,280)+'<figcaption>診断用：北が上。元の枝を30mまで追跡。</figcaption></figure><figure>'+koma(f.map,f.context,c.id+"-a"+f.sequence)+'<figcaption>生成モデル：進入基準。保留図は描かない。</figcaption></figure></div></article>';
  }).join("");
  return '<section id="'+c.id+'"><h2>'+esc(c.label)+'</h2><p>'+m(c.meters)+'m / '+c.cards+'コマ / 図の保留 '+c.held.length+'。枝・向き・投影・周辺情報を元データと照合。</p>'+overview+
   (c.sourceIssues.length?'<p class="held">枝の条件に注意：'+c.sourceIssues.map(s=>'#'+s.sequence+' '+idLink("node",s.nodeId)+' '+esc(s.issues.join(", "))).join(" / ")+'。詳細な道路タグと枝はJSONのsourceIssuesを参照。</p>':"")+
   '<p>経由するbridge=yes道路：'+(c.bridgeWays.map(w=>idLink("way",w.id)+' <code>'+esc(JSON.stringify(w.tags))+'</code>').join(" / ")||"なし")+'</p><p>局所表示の延べ目印 '+c.contextOccurrences.landmarks+' / 建物 '+c.contextOccurrences.buildings+'。同じ地物の再表示を含む。</p>'+
   (heldRows?'<details open><summary>図の保留一覧</summary><div class="scroll"><table><thead><tr><th>コマ</th><th>中心</th><th>選択枝の追跡長 / 図上長 / 終端理由</th></tr></thead><tbody>'+heldRows+'</tbody></table></div></details>':"")+
   '<details><summary>全保留位置と代表生成図の比較資料</summary>'+details+'</details></section>';
 }).join("");
 return '<!doctype html><html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src \'none\'; style-src \'unsafe-inline\'; base-uri \'none\'; form-action \'none\'"><title>P4-03b-3 固定OSM照合資料</title><style>'+
 'body{font:16px/1.7 system-ui,sans-serif;margin:0;background:#edf2ed;color:#22362d}main{max-width:1080px;margin:auto;padding:24px}section,header{background:white;border-radius:12px;padding:24px;margin:20px 0}h1{font-size:1.7rem}h2{font-size:1.3rem}p{overflow-wrap:anywhere}a{color:#075a8c}nav{display:flex;gap:12px;flex-wrap:wrap}svg{display:block;width:100%;height:auto}svg text{font:11px system-ui,sans-serif;paint-order:stroke;stroke:#f7f8f4;stroke-width:2px;stroke-linejoin:round;fill:#263d34}table{border-collapse:collapse;width:100%;font-size:.9rem}td,th{border:1px solid #d2ddd4;padding:8px;text-align:left;vertical-align:top}code{white-space:normal;overflow-wrap:anywhere}.scroll{overflow:auto}summary{cursor:pointer;font-weight:600}details{margin:16px 0}.legend{font-size:.85rem}.held{padding:16px;background:#fff3da;border:1px solid #a67b3a;border-radius:8px}.compare{display:grid;grid-template-columns:1fr 1fr;gap:16px}figure{margin:0}figcaption{font-size:.85rem}article{padding:12px 0;border-top:1px solid #d2ddd4}@media(max-width:600px){main{padding:8px}section,header{padding:16px}.compare{grid-template-columns:1fr}}'+
 '</style></head><body><main><header><h1>P4-03b-3：拡張地域の道路・コマ照合</h1><p><strong>固定OSMとの整合性を確認するオフライン資料。現地の通行・入口・安全性は未確認。</strong></p><p>初期178地点：相互接続グループ '+r.mutualGroupSizes.join(" / ")+'。全'+r.orderedPairs+'有向組合せ中、到達可能'+r.reachablePairs+' / 到達不能'+r.unreachablePairs+'。</p><p>図は元の座標・枝を使い、道路・許可条件・アプリの描画は変更していない。近傍候補は調査用。全コースの確認済みを意味しない。</p><nav>'+r.groups.slice(1).map(g=>'<a href="#'+g.id+'">'+g.id+'（'+g.spots+'地点）</a>').join("")+r.cases.map(c=>'<a href="#'+c.id+'">'+esc(c.label)+'</a>').join("")+'</nav></header>'+groupSections+cases+
 '<footer><p>照合：元道路辺 '+r.checks.checkedSourceEdges+' / コマ '+r.checks.checkedCards+' / 描画可能コマの周辺情報 '+r.checks.checkedReadyContexts+'。短い枝の判定は30px（30m表示時に約9.18m）。地理的精度や安全性の閾値ではない。</p><p>元データ時点 '+esc(r.source.osmBaseTimestamp)+'。© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a> / ODbL 1.0。データ・根拠は同梱のexpanded-route-audit.jsonとリポジトリの固定OSMを参照。地図タイル・外部画像・スクリプトの通信なし。</p></footer></main></body></html>\n';
}
