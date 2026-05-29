from datetime import date, datetime
from typing import Any

from pydantic import BaseModel, Field

from app.models import CycleStatus, PromoScopeType


class CycleCreate(BaseModel):
    name: str
    description: str | None = None
    pricing_date: date | None = None
    currency_code: str = "RUB"


class CycleUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    pricing_date: date | None = None
    currency_code: str | None = None
    filter_category: str | None = None
    filter_channel: str | None = None
    filter_customer_code: str | None = None


class CycleOut(BaseModel):
    id: int
    name: str
    description: str | None
    status: CycleStatus
    pricing_date: date
    currency_code: str
    filter_category: str | None
    filter_channel: str | None
    filter_customer_code: str | None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class CycleStatusUpdate(BaseModel):
    status: CycleStatus


class VolumeTier(BaseModel):
    min_volume: float = 0
    discount_pct: float = 0


class SourceRowIn(BaseModel):
    id: int | None = None
    row_order: int = 0
    sku: str = ""
    product_name: str = ""
    category: str = ""
    channel: str = "modern_trade"
    customer_code: str = ""
    valid_from: date | None = None
    valid_to: date | None = None
    currency_code: str = "RUB"
    exchange_rate: float = 1.0
    uom: str = "EA"
    units_per_uom: float = 1.0
    tax_rate_pct: float = 0.0
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


class TierRowIn(BaseModel):
    id: int | None = None
    source_row_id: int
    tier_order: int = 0
    min_volume: float = 0.0
    discount_pct: float = 0.0


class TierRowOut(TierRowIn):
    id: int
    sku: str = ""
    product_name: str = ""
    customer_code: str = ""

    model_config = {"from_attributes": True}


class TierBulkUpdate(BaseModel):
    rows: list[TierRowIn]


class PromoRuleIn(BaseModel):
    id: int | None = None
    row_order: int = 0
    name: str = ""
    priority: int = 10
    stackable: bool = True
    discount_pct: float = 0.0
    scope_type: PromoScopeType = PromoScopeType.ALL
    scope_value: str = ""
    valid_from: date | None = None
    valid_to: date | None = None


class PromoRuleOut(PromoRuleIn):
    id: int
    cycle_id: int

    model_config = {"from_attributes": True}


class PromoBulkUpdate(BaseModel):
    rows: list[PromoRuleIn]


class MatrixMasterRow(BaseModel):
    id: int | None = None
    code: str = ""
    name: str = ""
    region: str = ""
    active: bool = True


class MatrixExpandRequest(BaseModel):
    skus: list[str]
    customer_codes: list[str]
    channel_codes: list[str]
    template: SourceRowIn | None = None


class DimensionRowOut(BaseModel):
    source_id: int
    sku: str
    product_name: str
    category: str
    channel: str
    customer_code: str
    currency_code: str
    uom: str
    units_per_uom: float
    volume_in_units: float
    list_price: float
    list_price_base_currency: float
    invoice_unit_price: float
    net_unit_price: float
    planned_volume: float
    tier_discount_pct: float
    promo_discount_pct: float
    applied_promos: str
    gross_revenue: float
    invoice_revenue: float
    trade_spend_total: float
    net_revenue: float
    tax_amount: float
    net_revenue_after_tax: float
    cogs: float
    gross_margin: float
    margin_pct: float
    discount_total_pct: float


class CalculateResponse(BaseModel):
    cycle_id: int
    status: CycleStatus
    pricing_date: date
    currency_code: str
    filters: dict[str, str | None]
    rows: list[DimensionRowOut]
    totals: dict[str, float]


class SnapshotOut(BaseModel):
    id: int
    cycle_id: int
    published_at: datetime
    pricing_date: date
    currency_code: str
    filters: dict[str, Any]
    totals: dict[str, Any]

    model_config = {"from_attributes": True}


class SnapshotDetailOut(SnapshotOut):
    rows: list[dict[str, Any]]


class GridColumn(BaseModel):
    key: str
    title: str
    width: int = 120
    editable: bool = True
    type: str = "text"


class GridSchema(BaseModel):
    columns: list[GridColumn]
    rows: list[dict[str, Any]]


class CycleCompareResponse(BaseModel):
    base_cycle_id: int
    compare_cycle_id: int
    base_cycle_name: str
    compare_cycle_name: str
    pricing_date: date
    filters: dict[str, str | None]
    rows: list[dict[str, Any]]
    totals: dict[str, float]
    grid: GridSchema
