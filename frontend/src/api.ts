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
  created_at: string;
  updated_at: string;
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
  rows: Record<string, unknown>[];
  totals: Record<string, number>;
}

export async function fetchCycles(): Promise<Cycle[]> {
  const { data } = await api.get<Cycle[]>("/api/cycles");
  return data;
}

export async function createCycle(name: string, description?: string): Promise<Cycle> {
  const { data } = await api.post<Cycle>("/api/cycles", { name, description });
  return data;
}

export async function updateCycleStatus(
  cycleId: number,
  status: CycleStatus
): Promise<Cycle> {
  const { data } = await api.patch<Cycle>(`/api/cycles/${cycleId}/status`, { status });
  return data;
}

export async function fetchSourceGrid(cycleId: number): Promise<GridSchema> {
  const { data } = await api.get<GridSchema>(`/api/cycles/${cycleId}/source/grid`);
  return data;
}

export async function saveSourceGrid(
  cycleId: number,
  rows: Record<string, unknown>[]
): Promise<void> {
  const payload = rows.map((row, index) => ({
    id: row.id ? Number(row.id) : null,
    row_order: index,
    sku: String(row.sku ?? ""),
    product_name: String(row.product_name ?? ""),
    category: String(row.category ?? ""),
    channel: String(row.channel ?? "modern_trade"),
    list_price: Number(row.list_price) || 0,
    contract_discount_pct: Number(row.contract_discount_pct) || 0,
    promo_discount_pct: Number(row.promo_discount_pct) || 0,
    off_invoice_pct: Number(row.off_invoice_pct) || 0,
    trade_spend_per_unit: Number(row.trade_spend_per_unit) || 0,
    unit_cost: Number(row.unit_cost) || 0,
    planned_volume: Number(row.planned_volume) || 0,
  }));
  await api.put(`/api/cycles/${cycleId}/source`, { rows: payload });
}

export async function calculateDimensions(cycleId: number): Promise<CalculateResponse> {
  const { data } = await api.post<CalculateResponse>(
    `/api/cycles/${cycleId}/calculate`
  );
  return data;
}

export async function fetchDimensionsGrid(cycleId: number): Promise<GridSchema> {
  const { data } = await api.get<GridSchema>(
    `/api/cycles/${cycleId}/dimensions/grid`
  );
  return data;
}
