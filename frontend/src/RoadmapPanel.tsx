import { PRODUCTION_ROADMAP } from "./methodology";

export default function RoadmapPanel() {
  const { title, intro, waves, deferred, recommendedOrder } = PRODUCTION_ROADMAP;

  return (
    <section className="roadmap-page">
      <header className="roadmap-header">
        <h2>{title}</h2>
        <p className="roadmap-intro">{intro}</p>
      </header>

      <div className="roadmap-waves">
        {waves.map((w) => (
          <article key={w.wave} className={`roadmap-wave roadmap-wave-${w.wave}`}>
            <div className="roadmap-wave-head">
              <span className="roadmap-wave-badge">Волна {w.wave}</span>
              <h3>{w.title}</h3>
              <p className="roadmap-wave-subtitle">{w.subtitle}</p>
            </div>
            <ul className="roadmap-features">
              {w.features.map((f) => (
                <li key={f.name} className="roadmap-feature">
                  <strong className="roadmap-feature-name">{f.name}</strong>
                  <dl className="roadmap-feature-meta">
                    <div>
                      <dt>Зачем</dt>
                      <dd>{f.why}</dd>
                    </div>
                    <div>
                      <dt>Как в demo</dt>
                      <dd>{f.how}</dd>
                    </div>
                  </dl>
                </li>
              ))}
            </ul>
          </article>
        ))}
      </div>

      <section className="roadmap-deferred">
        <h3>{deferred.title}</h3>
        <ul>
          {deferred.items.map((item) => (
            <li key={item.name}>
              <strong>{item.name}</strong>
              <span> — {item.reason}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="roadmap-order">
        <h3>Рекомендуемый порядок внедрения</h3>
        <ol>
          {recommendedOrder.map((step, i) => (
            <li key={i}>{step}</li>
          ))}
        </ol>
      </section>
    </section>
  );
}
