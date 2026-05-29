type CompareTotals = {
  net_revenue_base?: number;
  net_revenue_compare?: number;
  net_revenue_delta?: number;
  net_revenue_delta_pct?: number;
  gross_margin_base?: number;
  gross_margin_compare?: number;
  gross_margin_delta?: number;
};

type Props = {
  totals: CompareTotals;
  baseLabel: string;
  compareLabel: string;
};

const CHART_H = 140;
const PAD = { top: 12, right: 12, bottom: 36, left: 56 };

function fmt(n: number | undefined): string {
  if (n == null || Number.isNaN(n)) return "—";
  return n.toLocaleString("ru-RU", { maximumFractionDigits: 2 });
}

function shortLabel(name: string, max = 18): string {
  return name.length > max ? `${name.slice(0, max - 1)}…` : name;
}

function pairMax(a: number, b: number): number {
  const m = Math.max(Math.abs(a), Math.abs(b));
  return m > 0 ? m : 1;
}

function deltaMax(...values: number[]): number {
  const m = Math.max(...values.map((v) => Math.abs(v)), 0);
  return m > 0 ? m : 1;
}

type BarPairProps = {
  title: string;
  labelA: string;
  labelB: string;
  valueA: number;
  valueB: number;
  colorA?: string;
  colorB?: string;
};

function BarPairChart({
  title,
  labelA,
  labelB,
  valueA,
  valueB,
  colorA = "#2563eb",
  colorB = "#7c3aed",
}: BarPairProps) {
  const w = 280;
  const innerH = CHART_H - PAD.top - PAD.bottom;
  const max = pairMax(valueA, valueB);
  const barW = 52;
  const gap = 40;
  const cx = w / 2;
  const xA = cx - gap / 2 - barW;
  const xB = cx + gap / 2;
  const hA = (Math.abs(valueA) / max) * innerH;
  const hB = (Math.abs(valueB) / max) * innerH;
  const y0 = PAD.top + innerH;

  return (
    <figure className="compare-chart-card">
      <figcaption>{title}</figcaption>
      <svg viewBox={`0 0 ${w} ${CHART_H}`} className="compare-chart-svg" role="img" aria-label={title}>
        {[0.25, 0.5, 0.75, 1].map((t) => {
          const y = PAD.top + innerH * (1 - t);
          const tick = max * t;
          return (
            <g key={t}>
              <line x1={PAD.left} y1={y} x2={w - PAD.right} y2={y} className="compare-chart-grid" />
              <text x={PAD.left - 6} y={y + 4} textAnchor="end" className="compare-chart-tick">
                {fmt(tick)}
              </text>
            </g>
          );
        })}
        <line x1={PAD.left} y1={y0} x2={w - PAD.right} y2={y0} className="compare-chart-axis" />
        <rect
          x={xA}
          y={y0 - hA}
          width={barW}
          height={hA || 2}
          rx={4}
          fill={colorA}
          className="compare-chart-bar"
        />
        <rect
          x={xB}
          y={y0 - hB}
          width={barW}
          height={hB || 2}
          rx={4}
          fill={colorB}
          className="compare-chart-bar"
        />
        <text x={xA + barW / 2} y={y0 - hA - 6} textAnchor="middle" className="compare-chart-value">
          {fmt(valueA)}
        </text>
        <text x={xB + barW / 2} y={y0 - hB - 6} textAnchor="middle" className="compare-chart-value">
          {fmt(valueB)}
        </text>
        <text x={xA + barW / 2} y={CHART_H - 8} textAnchor="middle" className="compare-chart-label">
          {shortLabel(labelA)}
        </text>
        <text x={xB + barW / 2} y={CHART_H - 8} textAnchor="middle" className="compare-chart-label">
          {shortLabel(labelB)}
        </text>
      </svg>
    </figure>
  );
}

type DeltaBarProps = {
  title: string;
  value: number;
  pct?: number;
  unit?: string;
};

function DeltaBarChart({ title, value, pct, unit = "" }: DeltaBarProps) {
  const w = 280;
  const innerH = CHART_H - PAD.top - PAD.bottom;
  const max = deltaMax(value);
  const midY = PAD.top + innerH / 2;
  const barH = 28;
  const trackW = w - PAD.left - PAD.right;
  const half = trackW / 2;
  const fillW = (Math.abs(value) / max) * (half - 8);
  const isPos = value > 0;
  const isNeg = value < 0;
  const isZero = !isPos && !isNeg;
  const fillColor = isZero ? "#94a3b8" : isPos ? "var(--success)" : "var(--error)";

  let barX = PAD.left + half - 1;
  if (isPos) barX = PAD.left + half;
  if (isNeg) barX = PAD.left + half - fillW;

  const subtitle =
    pct != null && !Number.isNaN(pct)
      ? `${fmt(value)}${unit} (${pct > 0 ? "+" : ""}${pct} %)`
      : `${fmt(value)}${unit}`;

  return (
    <figure className="compare-chart-card">
      <figcaption>
        {title}
        <span className="compare-chart-sub">{subtitle}</span>
      </figcaption>
      <svg viewBox={`0 0 ${w} ${CHART_H}`} className="compare-chart-svg" role="img" aria-label={title}>
        <line
          x1={PAD.left}
          y1={midY}
          x2={w - PAD.right}
          y2={midY}
          className="compare-chart-axis"
        />
        <line
          x1={PAD.left + half}
          y1={PAD.top}
          x2={PAD.left + half}
          y2={PAD.top + innerH}
          className="compare-chart-zero"
        />
        <text x={PAD.left} y={midY - 10} className="compare-chart-tick">
          −
        </text>
        <text x={w - PAD.right} y={midY - 10} textAnchor="end" className="compare-chart-tick">
          +
        </text>
        {isZero ? (
          <circle cx={PAD.left + half} cy={midY} r={5} fill={fillColor} />
        ) : (
          <rect
            x={barX}
            y={midY - barH / 2}
            width={Math.max(fillW, 4)}
            height={barH}
            rx={4}
            fill={fillColor}
          />
        )}
        <text x={PAD.left + half} y={CHART_H - 10} textAnchor="middle" className="compare-chart-label">
          {isZero ? "без изменений" : isPos ? "рост" : "снижение"}
        </text>
      </svg>
    </figure>
  );
}

export function CompareCharts({ totals, baseLabel, compareLabel }: Props) {
  const nrA = totals.net_revenue_base ?? 0;
  const nrB = totals.net_revenue_compare ?? 0;
  const nrDelta = totals.net_revenue_delta ?? 0;
  const nrPct = totals.net_revenue_delta_pct ?? 0;
  const gmA = totals.gross_margin_base ?? 0;
  const gmB = totals.gross_margin_compare ?? 0;
  const gmDelta = totals.gross_margin_delta ?? 0;

  return (
    <div className="compare-charts">
      <BarPairChart
        title="Net Revenue: цикл A vs B"
        labelA={`A · ${baseLabel}`}
        labelB={`B · ${compareLabel}`}
        valueA={nrA}
        valueB={nrB}
      />
      <DeltaBarChart title="Δ Net Revenue" value={nrDelta} pct={nrPct} />
      <BarPairChart
        title="Gross Margin: цикл A vs B"
        labelA={`A · ${baseLabel}`}
        labelB={`B · ${compareLabel}`}
        valueA={gmA}
        valueB={gmB}
        colorA="#059669"
        colorB="#0d9488"
      />
      <DeltaBarChart title="Δ Gross Margin" value={gmDelta} />
    </div>
  );
}
