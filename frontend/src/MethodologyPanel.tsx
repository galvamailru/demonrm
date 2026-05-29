import {
  DEMO_LIMITATIONS,
  NRM_PROCESS_MAP,
  PAGE_HELP,
  type HelpPageId,
} from "./methodology";

interface MethodologyPanelProps {
  page: HelpPageId;
}

export default function MethodologyPanel({ page }: MethodologyPanelProps) {
  const help = PAGE_HELP[page];

  return (
    <div className="methodology-wrap">
      <section className="methodology-panel">
        <h3>{help.title} — что сделать</h3>
        <p className="methodology-purpose">{help.purpose}</p>
        <ol className="methodology-steps">
          {help.steps.map((step, i) => (
            <li key={i}>{step}</li>
          ))}
        </ol>
        {help.inApp && help.inApp.length > 0 && (
          <div className="methodology-subsection methodology-in-app">
            <h4>Уже в системе — обратите внимание</h4>
            <ul>
              {help.inApp.map((item, i) => (
                <li key={i}>{item}</li>
              ))}
            </ul>
          </div>
        )}
        {help.notIncluded.length > 0 && (
          <div className="methodology-subsection methodology-not-included">
            <h4>Не входит в demo (типичный enterprise NRM)</h4>
            <ul>
              {help.notIncluded.map((item, i) => (
                <li key={i}>{item}</li>
              ))}
            </ul>
          </div>
        )}
      </section>

      <details className="methodology-global">
        <summary>Охват demo vs полный NRM-процесс</summary>
        <div className="methodology-global-body">
          <div className="methodology-columns">
            <div>
              <h4>В demo есть</h4>
              <ul>
                {NRM_PROCESS_MAP.covered.map((item, i) => (
                  <li key={i}>{item}</li>
                ))}
              </ul>
            </div>
            <div>
              <h4>В enterprise NRM, но не в demo</h4>
              <ul>
                {NRM_PROCESS_MAP.notCovered.map((item, i) => (
                  <li key={i}>{item}</li>
                ))}
              </ul>
            </div>
          </div>
          <p className="methodology-global-note">{DEMO_LIMITATIONS.description}</p>
          <ul className="methodology-tech-limits">
            {DEMO_LIMITATIONS.technical.map((item, i) => (
              <li key={i}>{item}</li>
            ))}
          </ul>
        </div>
      </details>
    </div>
  );
}
