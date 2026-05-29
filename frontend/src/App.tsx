import { useCallback, useEffect, useState } from "react";
import {
  CalculateResponse,
  Cycle,
  CycleStatus,
  calculateDimensions,
  createCycle,
  fetchCycles,
  fetchDimensionsGrid,
  fetchSourceGrid,
  saveSourceGrid,
  updateCycleStatus,
  type GridSchema,
} from "./api";
import ExcelGrid from "./ExcelGrid";

const STATUS_LABELS: Record<CycleStatus, string> = {
  draft: "Черновик",
  simulated: "Симуляция",
  approved: "Утверждён",
  published: "Опубликован",
};

const WORKFLOW: { status: CycleStatus; label: string; hint: string }[] = [
  { status: "draft", label: "1. План", hint: "Редактирование исходных данных" },
  { status: "simulated", label: "2. Симуляция", hint: "Расчёт измерений NRM" },
  { status: "approved", label: "3. Утверждение", hint: "Согласование сценария" },
  { status: "published", label: "4. Публикация", hint: "Фиксация цен" },
];

export default function App() {
  const [cycles, setCycles] = useState<Cycle[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<"source" | "dimensions">("source");
  const [sourceSchema, setSourceSchema] = useState<GridSchema | null>(null);
  const [dimSchema, setDimSchema] = useState<GridSchema | null>(null);
  const [pendingRows, setPendingRows] = useState<Record<string, unknown>[] | null>(null);
  const [totals, setTotals] = useState<Record<string, number> | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const selected = cycles.find((c) => c.id === selectedId) ?? null;
  const isReadOnly = selected?.status === "published";

  const loadCycles = useCallback(async () => {
    const list = await fetchCycles();
    setCycles(list);
    if (list.length && !selectedId) {
      setSelectedId(list[0].id);
    }
  }, [selectedId]);

  const loadGrids = useCallback(async (cycleId: number) => {
    setLoading(true);
    setError(null);
    try {
      const [src, dim] = await Promise.all([
        fetchSourceGrid(cycleId),
        fetchDimensionsGrid(cycleId),
      ]);
      setSourceSchema(src);
      setDimSchema(dim);
      setPendingRows(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка загрузки");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadCycles().catch((e) => setError(String(e)));
  }, [loadCycles]);

  useEffect(() => {
    if (selectedId) {
      loadGrids(selectedId);
      setTotals(null);
    }
  }, [selectedId, loadGrids]);

  const handleSaveSource = async () => {
    if (!selectedId || !pendingRows) return;
    setLoading(true);
    setError(null);
    try {
      await saveSourceGrid(selectedId, pendingRows);
      setMessage("Исходные данные сохранены");
      await loadGrids(selectedId);
      await loadCycles();
    } catch (e: unknown) {
      const err = e as { response?: { data?: { detail?: string } } };
      setError(err.response?.data?.detail || "Ошибка сохранения");
    } finally {
      setLoading(false);
    }
  };

  const handleCalculate = async () => {
    if (!selectedId) return;
    if (pendingRows) {
      await saveSourceGrid(selectedId, pendingRows);
    }
    setLoading(true);
    setError(null);
    try {
      const result: CalculateResponse = await calculateDimensions(selectedId);
      setTotals(result.totals);
      setMessage("Измерения NRM рассчитаны");
      setActiveTab("dimensions");
      await loadGrids(selectedId);
      await loadCycles();
    } catch (e: unknown) {
      const err = e as { response?: { data?: { detail?: string } } };
      setError(err.response?.data?.detail || "Ошибка расчёта");
    } finally {
      setLoading(false);
    }
  };

  const handleAdvanceStatus = async (target: CycleStatus) => {
    if (!selectedId) return;
    setLoading(true);
    setError(null);
    try {
      if (target === "simulated") {
        await handleCalculate();
        return;
      }
      await updateCycleStatus(selectedId, target);
      setMessage(`Статус: ${STATUS_LABELS[target]}`);
      await loadCycles();
      if (selectedId) await loadGrids(selectedId);
    } catch (e: unknown) {
      const err = e as { response?: { data?: { detail?: string } } };
      setError(err.response?.data?.detail || "Ошибка смены статуса");
    } finally {
      setLoading(false);
    }
  };

  const handleNewCycle = async () => {
    const name = prompt("Название нового цикла NRM:");
    if (!name?.trim()) return;
    const cycle = await createCycle(name.trim());
    await loadCycles();
    setSelectedId(cycle.id);
  };

  const addEmptyRow = () => {
    if (!sourceSchema) return;
    const empty: Record<string, unknown> = { id: null };
    sourceSchema.columns.forEach((c) => {
      empty[c.key] = c.type === "number" ? 0 : "";
    });
    const rows = [...(pendingRows ?? sourceSchema.rows), empty];
    setPendingRows(rows);
    setSourceSchema({ ...sourceSchema, rows });
  };

  const displaySource = pendingRows
    ? { ...sourceSchema!, rows: pendingRows }
    : sourceSchema;

  return (
    <div className="app">
      <header className="header">
        <div>
          <h1>Demo NRM</h1>
          <p className="subtitle">Net Revenue Management — FMCG ценообразование</p>
        </div>
        <button type="button" className="btn secondary" onClick={handleNewCycle}>
          + Новый цикл
        </button>
      </header>

      <section className="toolbar">
        <label>
          Цикл NRM
          <select
            value={selectedId ?? ""}
            onChange={(e) => setSelectedId(Number(e.target.value))}
          >
            {cycles.map((c) => (
              <option key={c.id} value={c.id}>
                #{c.id} — {c.name} ({STATUS_LABELS[c.status]})
              </option>
            ))}
          </select>
        </label>

        {selected && (
          <span className={`badge status-${selected.status}`}>
            {STATUS_LABELS[selected.status]}
          </span>
        )}
      </section>

      <section className="workflow">
        {WORKFLOW.map((step, i) => {
          const active = selected?.status === step.status;
          const done =
            selected &&
            WORKFLOW.findIndex((s) => s.status === selected.status) > i;
          return (
            <div
              key={step.status}
              className={`workflow-step ${active ? "active" : ""} ${done ? "done" : ""}`}
            >
              <strong>{step.label}</strong>
              <small>{step.hint}</small>
            </div>
          );
        })}
      </section>

      <section className="actions">
        <button
          type="button"
          className="btn"
          disabled={loading || isReadOnly || !selectedId}
          onClick={handleSaveSource}
        >
          Сохранить исходные данные
        </button>
        <button
          type="button"
          className="btn primary"
          disabled={loading || !selectedId}
          onClick={handleCalculate}
        >
          Рассчитать измерения
        </button>
        <button
          type="button"
          className="btn"
          disabled={loading || selected?.status !== "simulated"}
          onClick={() => handleAdvanceStatus("approved")}
        >
          Утвердить
        </button>
        <button
          type="button"
          className="btn"
          disabled={loading || selected?.status !== "approved"}
          onClick={() => handleAdvanceStatus("published")}
        >
          Опубликовать
        </button>
        <button
          type="button"
          className="btn secondary"
          disabled={loading || isReadOnly}
          onClick={addEmptyRow}
        >
          + Строка
        </button>
      </section>

      {(message || error) && (
        <div className={`alert ${error ? "error" : "success"}`}>
          {error || message}
        </div>
      )}

      {totals && (
        <section className="totals-panel">
          <h3>Итоги цикла (waterfall)</h3>
          <div className="totals-grid">
            <div>
              <span>Gross Revenue</span>
              <strong>{totals.gross_revenue?.toLocaleString("ru-RU")}</strong>
            </div>
            <div>
              <span>Invoice Revenue</span>
              <strong>{totals.invoice_revenue?.toLocaleString("ru-RU")}</strong>
            </div>
            <div>
              <span>Trade Spend</span>
              <strong>{totals.trade_spend_total?.toLocaleString("ru-RU")}</strong>
            </div>
            <div>
              <span>Net Revenue</span>
              <strong>{totals.net_revenue?.toLocaleString("ru-RU")}</strong>
            </div>
            <div>
              <span>COGS</span>
              <strong>{totals.cogs?.toLocaleString("ru-RU")}</strong>
            </div>
            <div>
              <span>Gross Margin</span>
              <strong>{totals.gross_margin?.toLocaleString("ru-RU")}</strong>
            </div>
            <div>
              <span>Margin %</span>
              <strong>{totals.margin_pct} %</strong>
            </div>
          </div>
        </section>
      )}

      <nav className="tabs">
        <button
          type="button"
          className={activeTab === "source" ? "active" : ""}
          onClick={() => setActiveTab("source")}
        >
          Исходные данные
        </button>
        <button
          type="button"
          className={activeTab === "dimensions" ? "active" : ""}
          onClick={() => setActiveTab("dimensions")}
        >
          Измерения NRM (расчёт)
        </button>
      </nav>

      <main className="grid-panel">
        {loading && <div className="overlay">Загрузка…</div>}
        {activeTab === "source" ? (
          <ExcelGrid
            schema={displaySource}
            readOnly={isReadOnly}
            onDataChange={(rows) => {
              setPendingRows(rows);
              setMessage(null);
            }}
          />
        ) : (
          <ExcelGrid schema={dimSchema} readOnly height={480} />
        )}
      </main>

      <footer className="footer">
        Редактируйте ячейки как в Excel (копирование, вставка, автозаполнение).
        Формулы: List → Invoice → Net price → Net Revenue → Margin.
      </footer>
    </div>
  );
}
