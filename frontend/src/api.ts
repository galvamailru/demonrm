import axios from "axios";

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "",
});

export type CycleStatus = "draft" | "simulated" | "approved" | "published";

export interface Cycle {
  id: number;
  name: string;
  description: string | null;
  status: CycleStatus;
  pricing_date: string;
  currency_code: string;
  filter_category: string | null;
  filter_channel: string | null;
  filter_customer_code: string | null;
  created_at: string;
  updated_at: string;
}

export interface CalcFilters {
  category?: string;
  channel?: string;
  customer_code?: string;
  pricing_date?: string;
}

export interface GridColumn {
  key: string;
  title: string;
  width: number;
  editable: boolean;
  type: string;
}

export interface GridSchema {
  columns: GridColumn[];
  rows: Record<string, unknown>[];
}

export interface CalculateResponse {
  cycle_id: number;
  status: CycleStatus;
  pricing_date: string;
  currency_code: string;
  filters: Record<string, string | null>;
  rows: Record<string, unknown>[];
  totals: Record<string, number>;
}

export interface CycleCompareResult {
  base_cycle_id: number;
  compare_cycle_id: number;
  base_cycle_name: string;
  compare_cycle_name: string;
  pricing_date: string;
  filters: Record<string, string | null>;
  rows: Record<string, unknown>[];
  totals: Record<string, number>;
  grid: GridSchema;
}

export interface Snapshot {
  id: number;
  cycle_id: number;
  published_at: string;
  pricing_date: string;
  currency_code: string;
  filters: Record<string, unknown>;
  totals: Record<string, number>;
}

/** Текст ошибки FastAPI / axios для показа пользователю */
export function extractApiError(e: unknown, fallback: string): string {
  const err = e as { response?: { data?: { detail?: unknown } }; message?: string };
  const detail = err.response?.data?.detail;
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail)) {
    return detail
      .map((x) => (typeof x === "object" && x && "msg" in x ? String((x as { msg: string }).msg) : String(x)))
      .join("; ");
  }
  if (detail && typeof detail === "object") return JSON.stringify(detail);
  return err.message || fallback;
}

function filterParams(f?: CalcFilters): Record<string, string> {
  const p: Record<string, string> = {};
  if (f?.category) p.category = f.category;
  if (f?.channel) p.channel = f.channel;
  if (f?.customer_code) p.customer_code = f.customer_code;
  if (f?.pricing_date) p.pricing_date = f.pricing_date;
  return p;
}

export async function fetchCycles(): Promise<Cycle[]> {
  const { data } = await api.get<Cycle[]>("/api/cycles");
  return data;
}

export async function createCycle(
  name: string,
  description?: string,
  copyFromCycleId?: number
): Promise<Cycle> {
  const { data } = await api.post<Cycle>("/api/cycles", {
    name,
    description,
    copy_from_cycle_id: copyFromCycleId ?? null,
  });
  return data;
}

export async function updateCycle(
  cycleId: number,
  patch: Partial<{
    name: string;
    pricing_date: string;
    currency_code: string;
    filter_category: string | null;
    filter_channel: string | null;
    filter_customer_code: string | null;
  }>
): Promise<Cycle> {
  const { data } = await api.patch<Cycle>(`/api/cycles/${cycleId}`, patch);
  return data;
}

export async function updateCycleStatus(
  cycleId: number,
  status: CycleStatus
): Promise<Cycle> {
  const { data } = await api.patch<Cycle>(`/api/cycles/${cycleId}/status`, { status });
  return data;
}

/** Публикация + snapshot (из draft / simulated / approved) */
export async function publishCycle(cycleId: number): Promise<Cycle> {
  const { data } = await api.post<Cycle>(`/api/cycles/${cycleId}/publish`);
  return data;
}

export async function fetchSourceGrid(cycleId: number): Promise<GridSchema> {
  const { data } = await api.get<GridSchema>(`/api/cycles/${cycleId}/source/grid`);
  return data;
}

export async function fetchPromosGrid(cycleId: number): Promise<GridSchema> {
  const { data } = await api.get<GridSchema>(`/api/cycles/${cycleId}/promos/grid`);
  return data;
}

export async function fetchCustomersGrid(): Promise<GridSchema> {
  const { data } = await api.get<GridSchema>("/api/customers/grid");
  return data;
}

export async function fetchChannelsGrid(): Promise<GridSchema> {
  const { data } = await api.get<GridSchema>("/api/channels/grid");
  return data;
}

function rowToSource(row: Record<string, unknown>, index: number) {
  return {
    id: row.id ? Number(row.id) : null,
    row_order: index,
    sku: String(row.sku ?? ""),
    product_name: String(row.product_name ?? ""),
    category: String(row.category ?? ""),
    channel: String(row.channel ?? "modern_trade"),
    customer_code: String(row.customer_code ?? ""),
    valid_from: row.valid_from ? String(row.valid_from).slice(0, 10) : null,
    valid_to: row.valid_to ? String(row.valid_to).slice(0, 10) : null,
    currency_code: String(row.currency_code ?? "RUB"),
    exchange_rate: Number(row.exchange_rate) || 1,
    uom: String(row.uom ?? "EA"),
    units_per_uom: Number(row.units_per_uom) || 1,
    tax_rate_pct: Number(row.tax_rate_pct) || 0,
    list_price: Number(row.list_price) || 0,
    contract_discount_pct: Number(row.contract_discount_pct) || 0,
    promo_discount_pct: Number(row.promo_discount_pct) || 0,
    off_invoice_pct: Number(row.off_invoice_pct) || 0,
    trade_spend_per_unit: Number(row.trade_spend_per_unit) || 0,
    unit_cost: Number(row.unit_cost) || 0,
    planned_volume: Number(row.planned_volume) || 0,
  };
}

export async function fetchTiersGrid(cycleId: number): Promise<GridSchema> {
  const { data } = await api.get<GridSchema>(`/api/cycles/${cycleId}/tiers/grid`);
  return data;
}

export async function saveTiersGrid(
  cycleId: number,
  rows: Record<string, unknown>[]
): Promise<void> {
  const payload = rows.map((row, index) => ({
    id: row.id ? Number(row.id) : null,
    source_row_id: Number(row.source_row_id) || 0,
    tier_order: index,
    min_volume: Number(row.min_volume) || 0,
    discount_pct: Number(row.discount_pct) || 0,
  }));
  await api.put(`/api/cycles/${cycleId}/tiers`, { rows: payload });
}

export async function saveSourceGrid(
  cycleId: number,
  rows: Record<string, unknown>[]
): Promise<void> {
  await api.put(`/api/cycles/${cycleId}/source`, {
    rows: rows.map(rowToSource),
  });
}

export async function savePromosGrid(
  cycleId: number,
  rows: Record<string, unknown>[]
): Promise<void> {
  const payload = rows.map((row, index) => ({
    id: row.id ? Number(row.id) : null,
    row_order: index,
    name: String(row.name ?? ""),
    priority: Number(row.priority) || 10,
    stackable: row.stackable === true || row.stackable === "true",
    discount_pct: Number(row.discount_pct) || 0,
    scope_type: String(row.scope_type ?? "all"),
    scope_value: String(row.scope_value ?? ""),
    valid_from: row.valid_from ? String(row.valid_from).slice(0, 10) : null,
    valid_to: row.valid_to ? String(row.valid_to).slice(0, 10) : null,
  }));
  await api.put(`/api/cycles/${cycleId}/promos`, { rows: payload });
}

export async function saveCustomersGrid(rows: Record<string, unknown>[]): Promise<void> {
  await api.put("/api/customers", rows.map(masterRow));
}

export async function saveChannelsGrid(rows: Record<string, unknown>[]): Promise<void> {
  await api.put("/api/channels", rows.map(masterRow));
}

function masterRow(row: Record<string, unknown>) {
  return {
    id: row.id ? Number(row.id) : null,
    code: String(row.code ?? ""),
    name: String(row.name ?? ""),
    region: String(row.region ?? ""),
    active: row.active === true || row.active === "true" || row.active === 1,
  };
}

export async function calculateDimensions(
  cycleId: number,
  filters?: CalcFilters
): Promise<CalculateResponse> {
  const { data } = await api.post<CalculateResponse>(
    `/api/cycles/${cycleId}/calculate`,
    null,
    { params: filterParams(filters) }
  );
  return data;
}

export async function fetchDimensionsGrid(
  cycleId: number,
  filters?: CalcFilters
): Promise<GridSchema> {
  const { data } = await api.get<GridSchema>(
    `/api/cycles/${cycleId}/dimensions/grid`,
    { params: filterParams(filters) }
  );
  return data;
}

export async function fetchSnapshots(cycleId: number): Promise<Snapshot[]> {
  const { data } = await api.get<Snapshot[]>(`/api/cycles/${cycleId}/snapshots`);
  return data;
}

export async function fetchSnapshotGrid(snapshotId: number): Promise<GridSchema> {
  const { data } = await api.get<GridSchema>(`/api/snapshots/${snapshotId}/grid`);
  return data;
}

export async function compareCycles(
  baseCycleId: number,
  compareCycleId: number,
  filters?: CalcFilters
): Promise<CycleCompareResult> {
  const { data } = await api.get<CycleCompareResult>("/api/cycles/compare", {
    params: {
      base_cycle_id: baseCycleId,
      compare_cycle_id: compareCycleId,
      ...filterParams(filters),
    },
  });
  return data;
}
