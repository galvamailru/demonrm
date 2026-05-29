import { PAGE_HELP, type HelpPageId } from "./methodology";

interface MethodologyPanelProps {
  page: HelpPageId;
}

export default function MethodologyPanel({ page }: MethodologyPanelProps) {
  const help = PAGE_HELP[page];
  return (
    <section className="methodology-panel">
      <h3>{help.title} — что сделать</h3>
      <p className="methodology-purpose">{help.purpose}</p>
      <ol className="methodology-steps">
        {help.steps.map((step, i) => (
          <li key={i}>{step}</li>
        ))}
      </ol>
    </section>
  );
}
