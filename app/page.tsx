const stops = [
  { name: "三崎港", role: "スタート" },
  { name: "海南神社", role: "チェックポイント" },
  { name: "光念寺", role: "経由地" },
  { name: "本瑞寺", role: "チェックポイント" },
  { name: "三崎港", role: "ゴール" },
];

export default function Home() {
  return (
    <main>
      <header className="site-header">
        <span className="brand-mark" aria-hidden="true">歩</span>
        <span>三浦市ウォーキングラリー</span>
      </header>

      <section className="intro" aria-labelledby="page-title">
        <p className="eyebrow">MIURA / MISAKI</p>
        <h1 id="page-title">
          まちの分かれ道を、
          <br />
          ひとコマずつ。
        </h1>
        <p className="lead">
          三崎下町の小さな周回を題材に、
          <br className="desktop-break" />
          歩く人へ道順を伝えるコマ地図を準備しています。
        </p>
      </section>

      <section className="route-card" aria-labelledby="route-title">
        <div className="card-heading">
          <div>
            <p className="eyebrow">検証するコース</p>
            <h2 id="route-title">三崎下町の周回</h2>
          </div>
          <span className="status">準備中</span>
        </div>
        <ol className="stop-list">
          {stops.map((stop, index) => (
            <li key={stop.name + index}>
              <span className="stop-number" aria-hidden="true">{index + 1}</span>
              <span className="stop-name">{stop.name}</span>
              <span className="stop-role">{stop.role}</span>
            </li>
          ))}
        </ol>
        <p className="route-caption">
          この一覧は訪問順です。実際の道路形状や確定した道順を示すものではありません。
        </p>
      </section>

      <aside className="preparation-note" aria-labelledby="preparation-title">
        <h2 id="preparation-title">コマ地図を準備しています</h2>
        <p>
          ルートとコマ地図はまだ生成していません。
          距離・所要時間・通行条件を確認してから、案内を表示します。
        </p>
      </aside>

      <footer>海とまちを、自分の足で。</footer>
    </main>
  );
}
