import { useCallback, useEffect, useState } from "react";
import {
  CalcFilters,
  CalculateResponse,
  Cycle,
  CycleStatus,
  Snapshot,
  calculateDimensions,
  createCycle,
  expandMatrix,
  fetchChannelsGrid,
  fetchCustomersGrid,
  fetchCycles,
  fetchDimensionsGrid,
  fetchPromosGrid,
  fetchSnapshotGrid,
  fetchSnapshots,
  fetchSourceGrid,
  saveChannelsGrid,
  saveCustomersGrid,
  savePromosGrid,
  saveSourceGrid,
  updateCycle,
  updateCycleStatus,
  type GridSchema,
} from "./api";
import ExcelGrid from "./ExcelGrid";

type TabId =
  | "source"
  | "promos"
  | "customers"
  | "channels"
  | "dimensions"
  | "snapshots";

const STATUS_LABELS: Record<CycleStatus, string> = {
  draft: "Черновик",
  simulated: "Симуляция",
  approved: "Утверждён",
  published: "Опубликован",
};

export default function App() {
  const [cycles, setCycles] = useState<Cycle[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<TabId>("source");
  const [schemas, setSchemas] = useState<Partial<Record<TabId, GridSchema | null>>>({});
  const [pending, setPending] = useState<Partial<Record<TabId, Record<string, unknown>[]>>>({});
  const [totals, setTotals] = useState<Record<string, number> | null>(null);
  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
  const [selectedSnapshotId, setSelectedSnapshotId] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [pricingDate, setPricingDate] = useState("");
  const [filterCategory, setFilterCategory] = useState("");
  const [filterChannel, setFilterChannel] = useState("");
  const [filterCustomer, setFilterCustomer] = useState("");

  const selected = cycles.find((c) => c.id === selectedId) ?? null;
  const isReadOnly = selected?.status === "published";

  const calcFilters: CalcFilters = {
    category: filterCategory || undefined,
    channel: filterChannel || undefined,
    customer_code: filterCustomer || undefined,
    pricing_date: pricingDate || undefined,
  };

  const loadCycles = useCallback(async () => {
    const list = await fetchCycles();
    setCycles(list);
    if (list.length && !selectedId) setSelectedId(list[0].id);
  }, [selectedId]);

  const loadTab = useCallback(
    async (tab: TabId, cycleId: number) => {
      switch (tab) {
        case "source":
          setSchemas((s) => ({ ...s, source: await fetchSourceGrid(cycleId) }));
          break;
        case "promos":
          setSchemas((s) => ({ ...s, promos: await fetchPromosGrid(cycleId) }));
          break;
        case "customers":
          setSchemas((s) => ({ ...s, customers: await fetchCustomersGrid() }));
          break;
        case "channels":
          setSchemas((s) => ({ ...s, channels: await fetchChannelsGrid() }));
          break;
        case "dimensions":
          setSchemas((s) => ({
            ...s,
            dimensions: await fetchDimensionsGrid(cycleId, calcFilters),
          }));
          break;
        case "snapshots": {
          const list = await fetchSnapshots(cycleId);
          setSnapshots(list);
          if (list.length && !selectedSnapshotId) {
            setSelectedSnapshotId(list[0].id);
            setSchemas((s) => ({
              ...s,
              snapshots: await fetchSnapshotGrid(list[0].id),
            }));
          }
          break;
        }
      }
    },
    [calcFilters, selectedSnapshotId]
  );

  const reloadAll = useCallback(
    async (cycleId: number) => {
      setLoading(true);
      setError(null);
      try {
        await Promise.all([
          loadTab("source", cycleId),
          loadTab("promos", cycleId),
          loadTab("customers", cycleId),
          loadTab("channels", cycleId),
          loadTab("dimensions", cycleId),
          loadTab("snapshots", cycleId),
        ]);
        setPending({});
      } catch (e) {
        setError(e instanceof Error ? e.message : "Ошибка загрузки");
      } finally {
        setLoading(false);
      }
    },
    [loadTab]
  );

  useEffect(() => {
    loadCycles().catch((e) => setError(String(e)));
  }, [loadCycles]);

  useEffect(() => {
    if (!selectedId) return;
    const c = cycles.find((x) => x.id === selectedId);
    if (c) {
      setPricingDate(c.pricing_date?.slice(0, 10) ?? "");
      setFilterCategory(c.filter_category ?? "");
      setFilterChannel(c.filter_channel ?? "");
      setFilterCustomer(c.filter_customer_code ?? "");
    }
    reloadAll(selectedId);
    setTotals(null);
  }, [selectedId, cycles.length]);

  useEffect(() => {
    if (selectedId && activeTab === "dimensions") {
      fetchDimensionsGrid(selectedId, calcFilters)
        .then((g) => setSchemas((s) => ({ ...s, dimensions: g })))
        .catch(() => {});
    }
  }, [filterCategory, filterChannel, filterCustomer, pricingDate, activeTab, selectedId]);

  const displaySchema = (tab: TabId): GridSchema | null => {
    const base = schemas[tab];
    const rows = pending[tab];
    if (!base) return null;
    if (rows) return { ...base, rows };
    return base;
  };

  const handleSaveCycleSettings = async () => {
    if (!selectedId) return;
    await updateCycle(selectedId, {
      pricing_date: pricingDate,
      filter_category: filterCategory || null,
      filter_channel: filterChannel || null,
      filter_customer_code: filterCustomer || null,
    });
    setMessage("Параметры цикла сохранены");
    await loadCycles();
  };

  const handleSaveTab = async () => {
    if (!selectedId) return;
    const rows = pending[activeTab];
    if (!rows) return;
    setLoading(true);
    try {
      if (activeTab === "source") await saveSourceGrid(selectedId, rows);
      else if (activeTab === "promos") await savePromosGrid(selectedId, rows);
      else if (activeTab === "customers") await saveCustomersGrid(rows);
      else if (activeTab === "channels") await saveChannelsGrid(rows);
      setMessage("Сохранено");
      setPending((p) => ({ ...p, [activeTab]: undefined }));
      await reloadAll(selectedId);
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
    if (pending.source) await saveSourceGrid(selectedId, pending.source);
    setLoading(true);
    try {
      const result: CalculateResponse = await calculateDimensions(selectedId, calcFilters);
      setTotals(result.totals);
      setMessage(`Расчёт на ${result.pricing_date}, валюта ${result.currency_code}`);
      setActiveTab("dimensions");
      setSchemas((s) => ({
        ...s,
        dimensions: {
          columns: schemas.dimensions?.columns ?? [],
          rows: result.rows,
        },
      }));
      await loadCycles();
    } catch (e: unknown) {
      const err = e as { response?: { data?: { detail?: string } } };
      setError(err.response?.data?.detail || "Ошибка расчёта");
    } finally {
      setLoading(false);
    }
  };

  const handlePublish = async () => {
    if (!selectedId) return;
    setLoading(true);
    try {
      if (pending.source) await saveSourceGrid(selectedId, pending.source);
      await updateCycleStatus(selectedId, "published");
      setMessage("Опубликовано. Snapshot расчёта сохранён.");
      await loadCycles();
      await reloadAll(selectedId);
    } catch (e: unknown) {
      const err = e as { response?: { data?: { detail?: string } } };
      setError(err.response?.data?.detail || "Ошибка публикации");
    } finally {
      setLoading(false);
    }
  };

  const handleExpandMatrix = async () => {
    if (!selectedId) return;
    const skus = prompt("SKU через запятую:", "SKU-004,SKU-005");
    const custs = prompt("Коды клиентов:", "CUST-AUCHAN,CUST-X5");
    const chs = prompt("Каналы:", "modern_trade,e_com");
    if (!skus || !custs || !chs) return;
    const res = await expandMatrix(
      selectedId,
      skus.split(",").map((s) => s.trim()),
      custs.split(",").map((s) => s.trim()),
      chs.split(",").map((s) => s.trim())
    );
    setMessage(`Добавлено строк матрицы: ${res.created}`);
    await reloadAll(selectedId);
  };

  const addRow = () => {
    const schema = schemas[activeTab];
    if (!schema) return;
    const empty: Record<string, unknown> = { id: null };
    schema.columns.forEach((c) => {
      if (c.type === "checkbox") empty[c.key] = true;
      else if (c.type === "number") empty[c.key] = 0;
      else if (c.key === "scope_type") empty[c.key] = "all";
      else if (c.key === "volume_tiers")
        empty[c.key] = '[{"min_volume":0,"discount_pct":0}]';
      else empty[c.key] = "";
    });
    const rows = [...(pending[activeTab] ?? schema.rows), empty];
    setPending((p) => ({ ...p, [activeTab]: rows }));
  };

  const tabReadOnly =
    isReadOnly ||
    activeTab === "dimensions" ||
    activeTab === "snapshots" ||
    (activeTab === "customers" && false);

  const TABS: { id: TabId; label: string }[] = [
    { id: "source", label: "Матрица цен" },
    { id: "promos", label: "Промо-правила" },
    { id: "customers", label: "Клиенты" },
    { id: "channels", label: "Каналы" },
    { id: "dimensions", label: "Измерения" },
    { id: "snapshots", label: "Snapshots" },
  ];

  return (
    <div className="app">
      <header className="header">
        <div>
          <h1>Demo NRM v2</h1>
          <p className="subtitle">
            Effective dating · Промо stack · Tiers · Валюта · Налог · Snapshot
          </p>
        </div>
        <button
          type="button"
          className="btn secondary"
          onClick={async () => {
            const name = prompt("Название цикла:");
            if (!name) return;
            const c = await createCycle(name);
            await loadCycles();
            setSelectedId(c.id);
          }}
        >
          + Цикл
        </button>
      </header>

      <section className="toolbar">
        <label>
          Цикл
          <select
            value={selectedId ?? ""}
            onChange={(e) => setSelectedId(Number(e.target.value))}
          >
            {cycles.map((c) => (
              <option key={c.id} value={c.id}>
                #{c.id} {c.name} ({STATUS_LABELS[c.status]})
              </option>
            ))}
          </select>
        </label>
        {selected && (
          <span className={`badge status-${selected.status}`}>
            {STATUS_LABELS[selected.status]} · {selected.currency_code}
          </span>
        )}
      </section>

      <section className="filters-panel">
        <h3>Параметры расчёта</h3>
        <div className="filters-row">
          <label>
            Pricing date
            <input
              type="date"
              value={pricingDate}
              onChange={(e) => setPricingDate(e.target.value)}
              disabled={isReadOnly}
            />
          </label>
          <label>
            Фильтр категория
            <input
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
              placeholder="Dairy"
              disabled={isReadOnly}
            />
          </label>
          <label>
            Фильтр канал
            <input
              value={filterChannel}
              onChange={(e) => setFilterChannel(e.target.value)}
              placeholder="modern_trade"
              disabled={isReadOnly}
            />
          </label>
          <label>
            Фильтр клиент
            <input
              value={filterCustomer}
              onChange={(e) => setFilterCustomer(e.target.value)}
              placeholder="CUST-X5"
              disabled={isReadOnly}
            />
          </label>
          <button
            type="button"
            className="btn"
            disabled={isReadOnly || !selectedId}
            onClick={handleSaveCycleSettings}
          >
            Сохранить параметры цикла
          </button>
        </div>
      </section>

      <section className="actions">
        <button
          type="button"
          className="btn"
          disabled={loading || tabReadOnly || !pending[activeTab]}
          onClick={handleSaveTab}
        >
          Сохранить вкладку
        </button>
        <button
          type="button"
          className="btn primary"
          disabled={loading || !selectedId}
          onClick={handleCalculate}
        >
          Рассчитать
        </button>
        <button
          type="button"
          className="btn"
          disabled={loading || selected?.status !== "simulated"}
          onClick={() => selectedId && updateCycleStatus(selectedId, "approved").then(loadCycles)}
        >
          Утвердить
        </button>
        <button
          type="button"
          className="btn"
          disabled={loading || selected?.status !== "approved"}
          onClick={handlePublish}
        >
          Опубликовать + Snapshot
        </button>
        <button
          type="button"
          className="btn secondary"
          disabled={loading || isReadOnly || activeTab !== "source"}
          onClick={handleExpandMatrix}
        >
          Развернуть матрицу
        </button>
        <button
          type="button"
          className="btn secondary"
          disabled={loading || tabReadOnly}
          onClick={addRow}
        >
          + Строка
        </button>
      </section>

      {(message || error) && (
        <div className={`alert ${error ? "error" : "success"}`}>{error || message}</div>
      )}

      {totals && (
        <section className="totals-panel">
          <h3>Итоги</h3>
          <div className="totals-grid">
            {Object.entries(totals).map(([k, v]) => (
              <div key={k}>
                <span>{k}</span>
                <strong>{v.toLocaleString("ru-RU")}</strong>
              </div>
            ))}
          </div>
        </section>
      )}

      <nav className="tabs">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            className={activeTab === t.id ? "active" : ""}
            onClick={() => setActiveTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </nav>

      {activeTab === "snapshots" && snapshots.length > 0 && (
        <div className="snapshot-select">
          <label>
            Snapshot
            <select
              value={selectedSnapshotId ?? ""}
              onChange={async (e) => {
                const id = Number(e.target.value);
                setSelectedSnapshotId(id);
                setSchemas((s) => ({
                  ...s,
                  snapshots: await fetchSnapshotGrid(id),
                }));
              }}
            >
              {snapshots.map((s) => (
                <option key={s.id} value={s.id}>
                  #{s.id} {new Date(s.published_at).toLocaleString("ru-RU")} — {s.pricing_date}
                </option>
              ))}
            </select>
          </label>
        </div>
      )}

      <main className="grid-panel">
        {loading && <div className="overlay">Загрузка…</div>}
        <ExcelGrid
          schema={displaySchema(activeTab)}
          readOnly={tabReadOnly}
          height={activeTab === "dimensions" ? 500 : 440}
          onDataChange={(rows) => {
            setPending((p) => ({ ...p, [activeTab]: rows }));
            setMessage(null);
          }}
        />
      </main>
    </div>
  );
}
