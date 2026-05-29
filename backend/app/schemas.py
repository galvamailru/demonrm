from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field

from app.models import CycleStatus


class CycleCreate(BaseModel):
    name: str
    description: str | None = None


class CycleOut(BaseModel):
    id: int
    name: str
    description: str | None
    status: CycleStatus
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class CycleStatusUpdate(BaseModel):
    status: CycleStatus


class SourceRowIn(BaseModel):
    id: int | None = None
    row_order: int = 0
    sku: str = ""
    product_name: str = ""
    category: str = ""
    channel: str = "modern_trade"
    list_price: float = 0.0
    contract_discount_pct: float = 0.0
    promo_discount_pct: float = 0.0
    off_invoice_pct: float = 0.0
    trade_spend_per_unit: float = 0.0
    unit_cost: float = 0.0
    planned_volume: float = 0.0


class SourceRowOut(SourceRowIn):
    id: int
    cycle_id: int

    model_config = {"from_attributes": True}


class SourceBulkUpdate(BaseModel):
    rows: list[SourceRowIn]


class DimensionRowOut(BaseModel):
    source_id: int
    sku: str
    product_name: str
    category: str
    channel: str
    list_price: float
    invoice_unit_price: float
    net_unit_price: float
    planned_volume: float
    gross_revenue: float
    invoice_revenue: float
    trade_spend_total: float
    net_revenue: float
    cogs: float
    gross_margin: float
    margin_pct: float
    discount_total_pct: float


class CalculateResponse(BaseModel):
    cycle_id: int
    status: CycleStatus
    rows: list[DimensionRowOut]
    totals: dict[str, float]


class GridColumn(BaseModel):
    key: str
    title: str
    width: int = 120
    editable: bool = True
    type: str = "text"


class GridSchema(BaseModel):
    columns: list[GridColumn]
    rows: list[dict[str, Any]]
