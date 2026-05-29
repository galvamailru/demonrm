import { useCallback, useEffect, useMemo, useState } from "react";
import {
  CalcFilters,
  CalculateResponse,
  Cycle,
  CycleStatus,
  Snapshot,
  calculateDimensions,
  compareCycles,
  createCycle,
  extractApiError,
  type CycleCompareResult,
  fetchChannelsGrid,
  fetchCustomersGrid,
  fetchCycles,
  fetchDimensionsGrid,
  fetchPromosGrid,
  fetchSnapshotGrid,
  fetchSnapshots,
  fetchSourceGrid,
  fetchTiersGrid,
  saveChannelsGrid,
  saveCustomersGrid,
  savePromosGrid,
  saveSourceGrid,
  saveTiersGrid,
  publishCycle,
  updateCycle,
  updateCycleStatus,
  type GridSchema,
} from "./api";
import ExcelGrid from "./ExcelGrid";
import MethodologyPanel from "./MethodologyPanel";
import RoadmapPanel from "./RoadmapPanel";
import type { HelpPageId } from "./methodology";

type TabId =
  | "source"
  | "promos"
  | "customers"
  | "channels"
  | "dimensions"
  | "snapshots"
  | "compare"
  | "roadmap";

type GridKey = TabId | "tiers";

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
  const [schemas, setSchemas] = useState<Partial<Record<GridKey, GridSchema | null>>>({});
  const [pending, setPending] = useState<Partial<Record<GridKey, Record<string, unknown>[]>>>({});
  const [selectedSourceRow, setSelectedSourceRow] = useState<Record<string, unknown> | null>(
    null
  );
  const [filterTiersBySelection, setFilterTiersBySelection] = useState(true);
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
  const [compareBaseId, setCompareBaseId] = useState<number | null>(null);
  const [compareOtherId, setCompareOtherId] = useState<number | null>(null);
  const [compareResult, setCompareResult] = useState<CycleCompareResult | null>(null);

  const selected = cycles.find((c) => c.id === selectedId) ?? null;
  const isReadOnly = selected?.status === "published";

  const calcFilters: CalcFilters = useMemo(
    () => ({
      category: filterCategory.trim() || undefined,
      channel: filterChannel.trim() || undefined,
      customer_code: filterCustomer.trim() || undefined,
      pricing_date: pricingDate || undefined,
    }),
    [filterCategory, filterChannel, filterCustomer, pricingDate]
  );

  const loadCycles = useCallback(async () => {
    const list = await fetchCycles();
    setCycles(list);
    if (list.length && !selectedId) setSelectedId(list[0].id);
  }, [selectedId]);

  const loadTab = useCallback(
    async (tab: TabId, cycleId: number) => {
      switch (tab) {
        case "source": {
          const [grid, tiers] = await Promise.all([
            fetchSourceGrid(cycleId),
            fetchTiersGrid(cycleId),
          ]);
          setSchemas((s) => ({ ...s, source: grid, tiers }));
          break;
        }
        case "promos": {
          const grid = await fetchPromosGrid(cycleId);
          setSchemas((s) => ({ ...s, promos: grid }));
          break;
        }
        case "customers": {
          const grid = await fetchCustomersGrid();
          setSchemas((s) => ({ ...s, customers: grid }));
          break;
        }
        case "channels": {
          const grid = await fetchChannelsGrid();
          setSchemas((s) => ({ ...s, channels: grid }));
          break;
        }
        case "dimensions": {
          const grid = await fetchDimensionsGrid(cycleId, calcFilters);
          setSchemas((s) => ({ ...s, dimensions: grid }));
          break;
        }
        case "snapshots": {
          const list = await fetchSnapshots(cycleId);
          setSnapshots(list);
          if (list.length) {
            const snapId = selectedSnapshotId ?? list[0].id;
            if (!selectedSnapshotId) setSelectedSnapshotId(snapId);
            const grid = await fetchSnapshotGrid(snapId);
            setSchemas((s) => ({ ...s, snapshots: grid }));
          } else {
            setSchemas((s) => ({ ...s, snapshots: { columns: [], rows: [] } }));
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
    if (activeTab !== "compare" || cycles.length < 2) return;

    setCompareBaseId((base) => {
      const resolvedBase =
        base != null && cycles.some((c) => c.id === base)
          ? base
          : (selectedId ?? cycles[0].id);
      setCompareOtherId((other) => {
        if (
          other != null &&
          other !== resolvedBase &&
          cycles.some((c) => c.id === other)
        ) {
          return other;
        }
        return cycles.find((c) => c.id !== resolvedBase)?.id ?? cycles[1].id;
      });
      return resolvedBase;
    });
  }, [activeTab, cycles, selectedId]);

  useEffect(() => {
    if (!selectedId) return;
    const c = cycles.find((x) => x.id === selectedId);
    if (c) {
      setPricingDate(c.pricing_date?.slice(0, 10) ?? "");
      setFilterCategory("");
      setFilterChannel("");
      setFilterCustomer("");
    }
    reloadAll(selectedId);
    setTotals(null);
  }, [selectedId, cycles.length]);

  useEffect(() => {
    if (selectedId && activeTab === "dimensions") {
      fetchDimensionsGrid(selectedId, calcFilters)
        .then((g) => setSchemas((s) => ({ ...s, dimensions: g })))
        .catch((e) => setError(extractApiError(e, "Не удалось загрузить измерения")));
    }
  }, [filterCategory, filterChannel, filterCustomer, pricingDate, activeTab, selectedId, calcFilters]);

  const displaySchema = (tab: GridKey): GridSchema | null => {
    const base = schemas[tab];
    const rows = pending[tab];
    if (!base) return null;
    if (rows) return { ...base, rows };
    return base;
  };

  const displayTiersSchema = (): GridSchema | null => {
    const base = displaySchema("tiers");
    if (!base) return null;
    if (!filterTiersBySelection || !selectedSourceRow?.id) return base;
    const sid = Number(selectedSourceRow.id);
    return {
      ...base,
      rows: base.rows.filter((r) => Number(r.source_row_id) === sid),
    };
  };

  const allTiersRows = (): Record<string, unknown>[] => {
    const base = pending.tiers ?? schemas.tiers?.rows ?? [];
    return base as Record<string, unknown>[];
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
    const tierRows = pending.tiers;
    if (!rows && activeTab !== "source") return;
    if (activeTab === "source" && !rows && !tierRows) return;
    setLoading(true);
    try {
      if (activeTab === "source") {
        if (rows) await saveSourceGrid(selectedId, rows);
        if (tierRows) await saveTiersGrid(selectedId, tierRows);
      } else if (activeTab === "promos" && rows) await savePromosGrid(selectedId, rows);
      else if (activeTab === "customers") await saveCustomersGrid(rows);
      else if (activeTab === "channels") await saveChannelsGrid(rows);
      setMessage("Сохранено");
      setPending((p) => {
        const next = { ...p, [activeTab]: undefined };
        if (activeTab === "source") next.tiers = undefined;
        return next;
      });
      await reloadAll(selectedId);
      await loadCycles();
    } catch (e: unknown) {
      setError(extractApiError(e, "Ошибка сохранения"));
    } finally {
      setLoading(false);
    }
  };

  const syncCycleParamsToServer = async (cycleId: number) => {
    await updateCycle(cycleId, {
      pricing_date: pricingDate || undefined,
      filter_category: filterCategory || null,
      filter_channel: filterChannel || null,
      filter_customer_code: filterCustomer || null,
    });
  };

  const handleCalculate = async () => {
    if (!selectedId) return;
    setLoading(true);
    setError(null);
    try {
      if (pending.source) await saveSourceGrid(selectedId, pending.source);
      if (pending.tiers) await saveTiersGrid(selectedId, pending.tiers);
      setPending((p) => ({ ...p, source: undefined, tiers: undefined }));

      await syncCycleParamsToServer(selectedId);

      const result: CalculateResponse = await calculateDimensions(selectedId, calcFilters);
      const grid = await fetchDimensionsGrid(selectedId, calcFilters);

      setTotals(result.totals);
      setSchemas((s) => ({ ...s, dimensions: grid }));
      setMessage(
        `Расчёт: ${result.rows.length} строк, ${result.pricing_date}, ${result.currency_code}`
      );
      setActiveTab("dimensions");
      await loadCycles();
    } catch (e: unknown) {
      setError(extractApiError(e, "Ошибка расчёта"));
    } finally {
      setLoading(false);
    }
  };

  const handlePublish = async () => {
    if (!selectedId) return;
    setLoading(true);
    setError(null);
    try {
      if (pending.source) await saveSourceGrid(selectedId, pending.source);
      await publishCycle(selectedId);
      setMessage("Опубликовано. Snapshot расчёта сохранён.");
      await loadCycles();
      await reloadAll(selectedId);
    } catch (e: unknown) {
      setError(extractApiError(e, "Ошибка публикации"));
    } finally {
      setLoading(false);
    }
  };

  const addRow = () => {
    const schema = schemas[activeTab];
    if (!schema) return;
    const empty: Record<string, unknown> = { id: null };
    schema.columns.forEach((c) => {
      if (c.type === "checkbox") empty[c.key] = true;
      else if (c.type === "number") empty[c.key] = 0;
      else if (c.key === "scope_type") empty[c.key] = "all";
      else empty[c.key] = "";
    });
    const rows = [...(pending[activeTab] ?? schema.rows), empty];
    setPending((p) => ({ ...p, [activeTab]: rows }));
  };

  const addTierRow = () => {
    const sid = selectedSourceRow?.id ? Number(selectedSourceRow.id) : 0;
    if (!sid) {
      setError("Сначала выберите строку в матрице цен (в таблице выше)");
      return;
    }
    setError(null);
    const empty: Record<string, unknown> = {
      id: null,
      source_row_id: sid,
      sku: selectedSourceRow?.sku ?? "",
      product_name: selectedSourceRow?.product_name ?? "",
      customer_code: selectedSourceRow?.customer_code ?? "",
      min_volume: 0,
      discount_pct: 0,
    };
    const rows = [...allTiersRows(), empty];
    setPending((p) => ({ ...p, tiers: rows }));
  };

  const tabReadOnly =
    isReadOnly ||
    activeTab === "dimensions" ||
    activeTab === "snapshots" ||
    (activeTab === "customers" && false);

  const runCompare = useCallback(async () => {
    if (!compareBaseId || !compareOtherId || compareBaseId === compareOtherId) {
      setCompareResult(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const result = await compareCycles(compareBaseId, compareOtherId, calcFilters);
      setCompareResult(result);
      setMessage(`Сравнение: ${result.base_cycle_name} vs ${result.compare_cycle_name}`);
    } catch (e: unknown) {
      setCompareResult(null);
      setError(extractApiError(e, "Ошибка сравнения"));
    } finally {
      setLoading(false);
    }
  }, [compareBaseId, compareOtherId, calcFilters]);

  useEffect(() => {
    if (activeTab !== "compare") return;
    void runCompare();
  }, [activeTab, runCompare]);

  const pickOtherCycle = (baseId: number) =>
    cycles.find((c) => c.id !== baseId)?.id ?? null;

  const handleCompareBaseChange = (id: number) => {
    setCompareBaseId(id);
    if (id === compareOtherId) {
      const other = pickOtherCycle(id);
      if (other) setCompareOtherId(other);
    }
  };

  const handleCompareOtherChange = (id: number) => {
    setCompareOtherId(id);
    if (id === compareBaseId) {
      const base = pickOtherCycle(id);
      if (base) setCompareBaseId(base);
    }
  };

  const helpPage: HelpPageId =
    activeTab === "compare"
      ? "compare"
      : activeTab === "roadmap"
        ? "source"
        : (activeTab as HelpPageId);

  const isRoadmapTab = activeTab === "roadmap";

  const TABS: { id: TabId; label: string }[] = [
    { id: "source", label: "Матрица цен" },
    { id: "promos", label: "Промо-правила" },
    { id: "customers", label: "Клиенты" },
    { id: "channels", label: "Каналы" },
    { id: "dimensions", label: "Измерения" },
    { id: "compare", label: "Сравнение циклов" },
    { id: "snapshots", label: "Snapshots" },
    { id: "roadmap", label: "Развитие NRM" },
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
            const copyFrom = selectedId ?? undefined;
            const c = await createCycle(name, undefined, copyFrom);
            await loadCycles();
            setSelectedId(c.id);
            setPricingDate(c.pricing_date?.slice(0, 10) ?? "");
            setFilterCategory("");
            setFilterChannel("");
            setFilterCustomer("");
            setTotals(null);
            setCompareResult(null);
            setMessage(
              copyFrom
                ? `Цикл «${name}» создан: скопированы данные из #${copyFrom}.`
                : `Цикл «${name}» создан с демо-данными (матрица, tiers, промо).`
            );
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

      {!isRoadmapTab && <MethodologyPanel page={helpPage} />}

      {!isRoadmapTab && (
      <section className="filters-panel">
        <h3>Параметры расчёта</h3>
        <p className="filters-hint">
          Пустые фильтры — все строки матрицы. Заполните только чтобы сузить срез.
        </p>
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
              placeholder="все"
              disabled={isReadOnly}
            />
          </label>
          <label>
            Фильтр канал
            <input
              value={filterChannel}
              onChange={(e) => setFilterChannel(e.target.value)}
              placeholder="все"
              disabled={isReadOnly}
            />
          </label>
          <label>
            Фильтр клиент
            <input
              value={filterCustomer}
              onChange={(e) => setFilterCustomer(e.target.value)}
              placeholder="все"
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
      )}

      {!isRoadmapTab && (
      <section className="actions">
        {activeTab !== "compare" && (
          <button
            type="button"
            className="btn"
            disabled={
              loading ||
              tabReadOnly ||
              (activeTab === "source"
                ? !pending.source && !pending.tiers
                : !pending[activeTab])
            }
            onClick={handleSaveTab}
          >
            Сохранить вкладку
          </button>
        )}
        {activeTab !== "compare" && (
          <button
            type="button"
            className="btn primary"
            disabled={loading || !selectedId}
            onClick={handleCalculate}
          >
            Рассчитать
          </button>
        )}
        {activeTab !== "compare" && (
          <>
            <button
              type="button"
              className="btn"
              disabled={loading || selected?.status !== "simulated"}
              onClick={() =>
                selectedId && updateCycleStatus(selectedId, "approved").then(loadCycles)
              }
            >
              Утвердить
            </button>
            <button
              type="button"
              className="btn"
              disabled={loading || !selectedId || selected?.status === "published"}
              onClick={handlePublish}
              title="Расчёт, snapshot и статус Published"
            >
              Опубликовать + Snapshot
            </button>
            <button
              type="button"
              className="btn secondary"
              disabled={loading || tabReadOnly}
              onClick={addRow}
            >
              + Строка {activeTab === "source" ? "матрицы" : ""}
            </button>
            {activeTab === "source" && (
              <button
                type="button"
                className="btn secondary"
                disabled={loading || isReadOnly}
                onClick={addTierRow}
              >
                + Ступень tier
              </button>
            )}
          </>
        )}
      </section>
      )}

      {(message || error) && (
        <div className={`alert ${error ? "error" : "success"}`}>{error || message}</div>
      )}

      {!isRoadmapTab && totals && (
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

      {activeTab === "compare" && (
        <section className="compare-toolbar">
          {cycles.length < 2 ? (
            <p className="compare-hint">
              Для сравнения создайте минимум два цикла (кнопка «+ Цикл» в шапке).
            </p>
          ) : (
            <>
              <label>
                Цикл A (база)
                <select
                  value={compareBaseId ?? ""}
                  onChange={(e) => handleCompareBaseChange(Number(e.target.value))}
                >
                  {cycles.map((c) => (
                    <option key={c.id} value={c.id}>
                      #{c.id} {c.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Цикл B (сравнение)
                <select
                  value={compareOtherId ?? ""}
                  onChange={(e) => handleCompareOtherChange(Number(e.target.value))}
                >
                  {cycles.map((c) => (
                    <option key={c.id} value={c.id}>
                      #{c.id} {c.name}
                    </option>
                  ))}
                </select>
              </label>
              <button
                type="button"
                className="btn secondary"
                disabled={loading || !compareBaseId || !compareOtherId}
                onClick={() => void runCompare()}
              >
                Обновить
              </button>
              <p className="compare-hint">
                Сравнение пересчитывается при смене циклов и параметров расчёта выше.
              </p>
            </>
          )}
        </section>
      )}

      {activeTab === "compare" && compareResult && (
        <section className="totals-panel">
          <h3>Итоги сравнения</h3>
          <div className="compare-summary">
            <div>
              <span>Net Revenue A</span>
              <strong>{compareResult.totals.net_revenue_base?.toLocaleString("ru-RU")}</strong>
            </div>
            <div>
              <span>Net Revenue B</span>
              <strong>
                {compareResult.totals.net_revenue_compare?.toLocaleString("ru-RU")}
              </strong>
            </div>
            <div>
              <span>Δ Net Revenue</span>
              <strong>{compareResult.totals.net_revenue_delta?.toLocaleString("ru-RU")}</strong>
              <span> ({compareResult.totals.net_revenue_delta_pct} %)</span>
            </div>
            <div>
              <span>Δ Gross Margin</span>
              <strong>{compareResult.totals.gross_margin_delta?.toLocaleString("ru-RU")}</strong>
            </div>
          </div>
        </section>
      )}

      {activeTab === "snapshots" && snapshots.length > 0 && (
        <div className="snapshot-select">
          <label>
            Snapshot
            <select
              value={selectedSnapshotId ?? ""}
              onChange={async (e) => {
                const id = Number(e.target.value);
                setSelectedSnapshotId(id);
                const grid = await fetchSnapshotGrid(id);
                setSchemas((s) => ({ ...s, snapshots: grid }));
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

      <main
        className={`grid-panel ${isRoadmapTab ? "grid-panel-roadmap" : ""} ${activeTab === "source" || activeTab === "compare" ? "grid-panel-split" : ""}`}
      >
        {loading && !isRoadmapTab && <div className="overlay">Загрузка…</div>}
        {isRoadmapTab ? (
          <RoadmapPanel />
        ) : activeTab === "source" ? (
          <div className="split-grids">
            <div className="split-pane">
              <h3 className="pane-title">Матрица цен</h3>
              <ExcelGrid
                schema={displaySchema("source")}
                readOnly={isReadOnly}
                height={380}
                onRowSelect={(row) => setSelectedSourceRow(row)}
                onDataChange={(rows) => {
                  setPending((p) => ({ ...p, source: rows }));
                  setMessage(null);
                }}
              />
            </div>
            <div className="split-pane">
              <div className="pane-title-row">
                <h3 className="pane-title">Volume tiers (под матрицей)</h3>
                <label className="tier-filter">
                  <input
                    type="checkbox"
                    checked={filterTiersBySelection}
                    onChange={(e) => setFilterTiersBySelection(e.target.checked)}
                  />
                  Только выбранная строка
                  {selectedSourceRow?.id ? (
                    <span className="tier-hint">
                      ID {String(selectedSourceRow.id)} · {String(selectedSourceRow.sku)}
                    </span>
                  ) : (
                    <span className="tier-hint">— выберите строку в таблице выше</span>
                  )}
                </label>
              </div>
              <ExcelGrid
                schema={displayTiersSchema()}
                readOnly={isReadOnly}
                height={280}
                onDataChange={(rows) => {
                  if (filterTiersBySelection && selectedSourceRow?.id) {
                    const sid = Number(selectedSourceRow.id);
                    const others = allTiersRows().filter(
                      (r) => Number(r.source_row_id) !== sid
                    );
                    setPending((p) => ({ ...p, tiers: [...others, ...rows] }));
                  } else {
                    setPending((p) => ({ ...p, tiers: rows }));
                  }
                  setMessage(null);
                }}
              />
            </div>
          </div>
        ) : activeTab === "compare" ? (
          cycles.length < 2 ? (
            <div className="grid-placeholder">Нужно минимум два цикла.</div>
          ) : loading && !compareResult ? (
            <div className="grid-placeholder">Загрузка сравнения…</div>
          ) : (
            <ExcelGrid schema={compareResult?.grid ?? null} readOnly height={520} />
          )
        ) : (
          <ExcelGrid
            schema={displaySchema(activeTab)}
            readOnly={tabReadOnly}
            height={activeTab === "dimensions" ? 500 : 440}
            onDataChange={(rows) => {
              setPending((p) => ({ ...p, [activeTab]: rows }));
              setMessage(null);
            }}
          />
        )}
      </main>
    </div>
  );
}
