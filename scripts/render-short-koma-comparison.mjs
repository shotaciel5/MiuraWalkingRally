import {arrowPath} from "../lib/route/koma.ts";
const esc=v=>String(v??"").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;");
const fixed=(v,n=1)=>Number(v).toFixed(n),xy=points=>points.map(p=>fixed(p.x,3)+","+fixed(p.y,3)).join(" ");
function diagram(map,context,key,mode="normal",anchors=[]){
 const incoming=map.branches.find(b=>b.arrival),outgoing=map.branches.find(b=>b.departure),dot=incoming?.points.at(-1);
 const road=b=>b.exit==="review"?"#a87a2b":b.exit==="excluded"?"#8a948e":"#b9c9bc";
 const features=(context?.landmarks??[]).filter(f=>f.x>=9&&f.x<=291&&f.y>=9&&f.y<=241);
 const title=mode==="labels"?"B案：30m固定と外側ラベル":mode==="reference"?"周辺30mの道路参照図":"A案：元の枝を同じ倍率で拡大した比較図";
 return '<svg role="img" aria-label="'+title+'" viewBox="0 0 300 280"><title>'+title+'</title><defs><clipPath id="'+key+'-clip"><rect x="9" y="9" width="282" height="232" rx="8"/></clipPath><marker id="'+key+'-arrow" markerWidth="16" markerHeight="16" viewBox="0 0 10 10" refX="8" refY="5" orient="auto" markerUnits="userSpaceOnUse"><path d="M0 0L10 5L0 10Z" fill="#17634f"/></marker></defs><rect x="1" y="1" width="298" height="278" rx="14" fill="#f5f6ef"/><g clip-path="url(#'+key+'-clip)">'+
 (context?.buildings??[]).map(b=>'<polygon points="'+xy(b.points)+'" fill="#e4dfcf" stroke="#d0c8b5" stroke-width="1"><title>'+esc(b.id)+'</title></polygon>').join("")+
 map.branches.map(b=>'<polyline data-neighbor="'+b.neighborNodeId+'" points="'+xy(b.points)+'" fill="none" stroke="'+road(b)+'" stroke-width="7" stroke-linecap="round"'+(b.exit==="candidate"?"":' stroke-dasharray="'+(b.exit==="review"?"2 5":"6 5")+'"')+'/>').join("")+
 (incoming?'<polyline points="'+xy(incoming.points)+'" fill="none" stroke="#263d34" stroke-width="7" stroke-linecap="round"/>':"")+
 (outgoing?'<polyline points="'+xy(mode==="normal"?arrowPath(outgoing.points):outgoing.points)+'" fill="none" stroke="#17634f" stroke-width="4"'+(mode==="normal"?' marker-end="url(#'+key+'-arrow)"':"")+'/>':"")+
 (context?.steps??[]).map(s=>'<line x1="'+s.from.x+'" y1="'+s.from.y+'" x2="'+s.to.x+'" y2="'+s.to.y+'" stroke="#6b5541" stroke-width="2"/>').join("")+
 features.map(f=>'<g><circle cx="'+f.x+'" cy="'+f.y+'" r="4" fill="#976735"/><text x="'+(f.x+5)+'" y="'+(f.y-4)+'">'+esc(f.name)+'</text><title>'+esc(f.id+" / "+f.symbol)+'</title></g>').join("")+
 '</g>'+
 (mode==="normal"&&dot?'<circle cx="'+dot.x+'" cy="'+dot.y+'" r="6" fill="#263d34"/>':"")+
 '<circle cx="150" cy="140" r="4" fill="white" stroke="#263d34" stroke-width="2"/>'+
 (mode==="labels"?anchors.map(a=>{
  const left=a.role==="arrival",x=left?17:200,y=24,color=left?"#263d34":"#17634f";
  return '<path data-callout="'+a.role+'" d="M'+(left?65:235)+' 49 L'+fixed(a.point.x,3)+' '+fixed(a.point.y,3)+'" fill="none" stroke="'+color+'" stroke-width="1.5" stroke-dasharray="2 3"/><circle cx="'+a.point.x+'" cy="'+a.point.y+'" r="3" fill="'+color+'"/><rect x="'+x+'" y="'+y+'" width="83" height="25" rx="6" fill="white" stroke="'+color+'"/><text x="'+(x+41.5)+'" y="'+(y+17)+'" text-anchor="middle" fill="'+color+'">'+(left?"ここから入る":"こちらへ進む")+'</text>';
 }).join(""):"")+
 '<text x="150" y="263" text-anchor="middle">'+(map.kind==="start"?"出る方向が上":map.kind==="finish"?"入ってきた道から、ここで終了":"入ってきた道が下")+'</text></svg>';
}
export function renderShortKomaComparison({report:r,examples}){
 const maximum=examples.reduce((a,b)=>a.row.a.zoomFactor>b.row.a.zoomFactor?a:b),openKeys=new Set([examples[0],maximum,examples.find(e=>e.row.sourceIssues.length),examples.find(e=>e.row.kind==="finish")].filter(Boolean).map(e=>e.row.caseId+"-"+e.row.sequence));
 const rows=examples.map(e=>{
  const x=e.row,key=x.caseId+"-"+x.sequence,normalContext=diagram(e.reference,e.context,key+"-ref","reference");
  return '<section id="'+key+'" data-example="'+key+'"><details'+(openKeys.has(key)?" open":"")+'><summary>'+esc(x.caseLabel)+' #'+x.sequence+' / 最短選択枝 '+fixed(x.shortestSelectedMeters,2)+'m / '+esc(x.kind)+'</summary><p>'+esc(x.nodeId>0?"node/"+x.nodeId:"道路途中の仮ノード "+x.nodeId)+'。次のコマまで '+(x.metersToNext===null?"終了":fixed(x.metersToNext)+"m")+'。両案で同じ枝 '+x.branches+'本・訪問順・距離を使う。</p>'+
   (x.sourceIssues.length?'<p class="notice">枝の条件：'+esc(x.sourceIssues.join(", "))+'。拡大しても通行確認済みにはならない。</p>':"")+
   '<div class="options"><article><h3>A案：参照図＋自動拡大</h3>'+diagram(e.zoom,e.zoomContext,key+"-a")+'<p>描画範囲 '+fixed(x.a.extentMeters,2)+'m / '+fixed(x.a.zoomFactor,2)+'倍。最短選択枝 '+fixed(x.a.minimumSelectedPixels)+'px。画面内の目印 '+x.a.visibleLandmarks+'件。</p>'+
   (x.a.nearOtherBranch?'<p class="notice">記号位置が別の枝に近い。拡大だけで読めると判断せず、確認待ちを残す候補。</p>':"")+
   '<details><summary>周辺30mの参照図を開く</summary>'+normalContext+'<p>こちらは道路・目印の参照用。短い枝には進入点・矢印を置かない。</p></details></article>'+
   '<article><h3>B案：30m固定＋外側ラベル</h3>'+diagram(e.reference,e.context,key+"-b","labels",e.bAnchors)+'<p>描画範囲30m。画面内の目印 '+x.b.visibleLandmarks+'件。破線は説明の引出線で、道路ではない。</p>'+
   (x.b.nearOtherBranch?'<p class="notice">引出線の指し先が別の枝に近い。特に中心付近の短い枝を見分ける必要がある。</p>':"")+'</article></div></details></section>';
 }).join("");
 const table=r.rows.map(x=>'<tr><td><a href="#'+x.caseId+'-'+x.sequence+'">'+esc(x.caseLabel)+' #'+x.sequence+'</a></td><td>'+fixed(x.shortestSelectedMeters,2)+'m</td><td>'+fixed(x.a.zoomFactor,2)+'倍</td><td>'+fixed(x.a.extentMeters,2)+'m</td><td>'+x.a.visibleLandmarks+' / '+x.b.visibleLandmarks+'</td><td>'+(x.a.nearOtherBranch?"注意":"—")+' / '+(x.b.nearOtherBranch?"注意":"—")+'</td></tr>').join("");
 return '<!doctype html><html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src \'none\'; style-src \'unsafe-inline\'; base-uri \'none\'; form-action \'none\'"><title>短い枝のコマ表示・方式比較</title><style>'+
 'body{margin:0;font:16px/1.7 system-ui,sans-serif;color:#203b31;background:#edf2ee}main{max-width:1050px;margin:auto;padding:24px}header,section{padding:24px;margin-bottom:20px;background:white;border-radius:12px}h1{font-size:1.7rem}h2{font-size:1.3rem}h3{font-size:1.1rem}p,summary{overflow-wrap:anywhere}a{color:#14618c}.options{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:24px}article{min-width:0;padding:12px;background:#fafbf8;border:1px solid #d9e1d9;border-radius:10px}svg{width:100%;max-width:360px;display:block;margin:auto}svg text{font:10px system-ui,sans-serif;paint-order:stroke;stroke:#f5f6ef;stroke-width:2px;fill:#263d34}.notice{background:#fff3db;border-left:4px solid #ac7d31;padding:12px}.scroll{overflow:auto}table{border-collapse:collapse;font-size:.85rem;width:100%}th,td{padding:8px;border:1px solid #cdd8d0;text-align:left;vertical-align:top}summary{cursor:pointer;font-weight:600}details{margin:12px 0}nav{display:flex;flex-wrap:wrap;gap:12px}small{font-size:.85rem}@media(max-width:620px){main{padding:8px}header,section{padding:16px}.options{grid-template-columns:minmax(0,1fr)}}'+
 '</style></head><body><main><header><h1>短い枝のコマ表示：A/B比較</h1><p class="notice"><strong>方式選定用の試作。アプリには未適用。</strong>元の角度・局所形状・全枝・進入基準・次コマまでの距離を保つ。現地の入口/通行/安全性は未確認。</p><p>A案は道路上の黒点・矢印を保ち、短い枝に合わせて同じ倍率で拡大。周辺30mは参照図から確認する。B案は30mを保ち、外側の文言と引出線で進入/退出の枝を指す。</p><p>拡大図の建物・目印・階段の位置も道路と同じ倍率で変換。拡大すると見切れる目印は参照図へ残す。目印の丸は位置比較用で、製品版の記号表現は今回採用していない。</p><nav><a href="#results">全45コマの数値</a><a href="#'+maximum.row.caseId+'-'+maximum.row.sequence+'">最大拡大の例</a><a href="#'+examples[0].row.caseId+'-'+examples[0].row.sequence+'">開始の例</a></nav>'+
 '<h2>比較結果</h2><p>長さ条件：A案 '+r.summary.aLengthPass+'/'+r.totalHeld+'。描画範囲 '+fixed(r.summary.minExtentMeters,2)+'〜'+fixed(r.summary.maxExtentMeters,2)+'m、最大 '+fixed(r.summary.maxZoom,2)+'倍。これは読解・安全性や記号重なりの解消を保証しない。</p><p>別の枝への近接指標：A案 '+r.summary.aNearOtherBranch+' / B案 '+r.summary.bNearOtherBranch+'コマ。目印が画面内に残らない例：A案 '+r.summary.aWithoutVisibleLandmarks+' / B案 '+r.summary.bWithoutVisibleLandmarks+'コマ。</p><p><small>比較用に、記号/引出線の指し先から他枝までの図上距離が12px未満の例を「注意」とする。採否や地理的精度の閾値ではない。長さ目標36pxは現行の保留条件30pxに余裕を付けた試作値。300×280の図上単位で、スマートフォンで縮小表示された実画面のpxとは異なる。枝端は隣の分岐・終端・表示範囲で止めており、道路がそこで終わるという意味ではない。縮小サムネイル・折返し・未知形状の読解は別途確認が必要。</small></p></header>'+
 rows+'<section id="results"><h2>全45コマの比較数値</h2><div class="scroll"><table><thead><tr><th>例</th><th>選択枝</th><th>A倍率</th><th>A範囲</th><th>目印 A/B</th><th>他枝近接 A/B</th></tr></thead><tbody>'+table+'</tbody></table></div></section><footer><p>原典の時点 '+esc(r.source.osmBaseTimestamp)+'。© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a> / ODbL 1.0。元データと集計はshort-koma-comparison.json。図は固定データからアルゴリズムで作成。外部画像・タイル・スクリプト通信なし。</p></footer></main></body></html>\n';
}
