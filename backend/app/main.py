import json
import time
from datetime import date
from typing import Any

from fastapi import Depends, FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session

from app.calculation_service import (
    build_filters,
    run_calculation,
    save_publish_snapshot,
)
from app.config import settings
from app.database import Base, engine, get_db
from app.models import (
    CalculationSnapshot,
    Channel,
    Customer,
    CycleStatus,
    NrmCycle,
    PromoRule,
    PromoScopeType,
    SourceDataRow,
    VolumeTier,
)
from app.schemas import (
    CalculateResponse,
    CycleCreate,
    CycleOut,
    CycleStatusUpdate,
    CycleUpdate,
    DimensionRowOut,
    GridSchema,
    MatrixExpandRequest,
    MatrixMasterRow,
    PromoBulkUpdate,
    PromoRuleIn,
    PromoRuleOut,
    SnapshotDetailOut,
    SnapshotOut,
    SourceBulkUpdate,
    SourceRowIn,
    SourceRowOut,
    TierBulkUpdate,
    TierRowIn,
)
from app.seed import seed_demo_data

app = FastAPI(title="Demo NRM API", version="2.0.0")

origins = [o.strip() for o in settings.cors_origins.split(",") if o.strip()]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins or ["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

STATUS_TRANSITIONS: dict[CycleStatus, set[CycleStatus]] = {
    CycleStatus.DRAFT: {CycleStatus.SIMULATED},
    CycleStatus.SIMULATED: {CycleStatus.APPROVED, CycleStatus.DRAFT},
    CycleStatus.APPROVED: {CycleStatus.PUBLISHED, CycleStatus.DRAFT},
    CycleStatus.PUBLISHED: set(),
}

SOURCE_COLUMNS = [
    ("sku", "SKU", 90),
    ("product_name", "Наименование", 160),
    ("category", "Категория", 100),
    ("channel", "Канал", 110),
    ("customer_code", "Клиент", 110),
    ("valid_from", "Действует с", 110),
    ("valid_to", "Действует по", 110),
    ("currency_code", "Валюта", 70),
    ("exchange_rate", "Курс", 80),
    ("uom", "UoM", 60),
    ("units_per_uom", "Ед/UoM", 80),
    ("tax_rate_pct", "НДС %", 70),
    ("list_price", "List Price", 90),
    ("contract_discount_pct", "Контракт %", 90),
    ("promo_discount_pct", "Промо строки %", 100),
    ("off_invoice_pct", "Off-invoice %", 100),
    ("trade_spend_per_unit", "Trade/ед", 90),
    ("unit_cost", "Себест.", 80),
    ("planned_volume", "Объём (UoM)", 100),
]

TIER_COLUMNS = [
    ("source_row_id", "ID строки", 90, True),
    ("sku", "SKU", 90, False),
    ("product_name", "Товар", 130, False),
    ("customer_code", "Клиент", 100, False),
    ("min_volume", "Мин. объём (ед)", 120, True),
    ("discount_pct", "Скидка %", 100, True),
]

PROMO_COLUMNS = [
    ("name", "Название", 160),
    ("priority", "Приоритет", 90),
    ("stackable", "Stackable", 90),
    ("discount_pct", "Скидка %", 90),
    ("scope_type", "Scope", 100),
    ("scope_value", "Значение", 120),
    ("valid_from", "С", 110),
    ("valid_to", "По", 110),
]

CUSTOMER_COLUMNS = [
    ("code", "Код", 120),
    ("name", "Название", 200),
    ("region", "Регион", 120),
    ("active", "Активен", 80),
]

CHANNEL_COLUMNS = [
    ("code", "Код", 120),
    ("name", "Название", 200),
    ("active", "Активен", 80),
]

DIMENSION_COLUMNS = [
    ("sku", "SKU", 90),
    ("customer_code", "Клиент", 100),
    ("channel", "Канал", 90),
    ("category", "Категория", 90),
    ("uom", "UoM", 50),
    ("volume_in_units", "Объём (ед)", 90),
    ("list_price_base_currency", "List (база)", 100),
    ("invoice_unit_price", "Invoice", 90),
    ("net_unit_price", "Net", 80),
    ("tier_discount_pct", "Tier %", 70),
    ("promo_discount_pct", "Promo %", 80),
    ("gross_revenue", "Gross Rev", 100),
    ("net_revenue", "Net Rev", 100),
    ("tax_amount", "Налог", 90),
    ("net_revenue_after_tax", "С налогом", 100),
    ("cogs", "COGS", 90),
    ("gross_margin", "Margin", 100),
    ("margin_pct", "Margin %", 80),
    ("applied_promos", "Промо", 200),
]

NUMBER_KEYS = {
    "list_price",
    "contract_discount_pct",
    "promo_discount_pct",
    "off_invoice_pct",
    "trade_spend_per_unit",
    "unit_cost",
    "planned_volume",
    "exchange_rate",
    "units_per_uom",
    "tax_rate_pct",
    "priority",
    "discount_pct",
    "invoice_unit_price",
    "net_unit_price",
    "gross_revenue",
    "invoice_revenue",
    "trade_spend_total",
    "net_revenue",
    "cogs",
    "gross_margin",
    "margin_pct",
    "discount_total_pct",
    "tier_discount_pct",
    "promo_discount_pct",
    "tax_amount",
    "net_revenue_after_tax",
    "volume_in_units",
    "list_price_base_currency",
}


def _wait_for_db(max_attempts: int = 30) -> None:
    for _ in range(max_attempts):
        try:
            with engine.connect() as conn:
                conn.execute(__import__("sqlalchemy").text("SELECT 1"))
            return
        except Exception:
            time.sleep(1)
    raise RuntimeError("Database not available")


@app.on_event("startup")
def on_startup() -> None:
    _wait_for_db()
    Base.metadata.create_all(bind=engine)
    from app.database import SessionLocal

    db = SessionLocal()
    try:
        seed_demo_data(db)
    finally:
        db.close()


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


# --- Cycles ---


@app.get("/api/cycles", response_model=list[CycleOut])
def list_cycles(db: Session = Depends(get_db)) -> list[NrmCycle]:
    return db.query(NrmCycle).order_by(NrmCycle.id.desc()).all()


@app.post("/api/cycles", response_model=CycleOut, status_code=201)
def create_cycle(payload: CycleCreate, db: Session = Depends(get_db)) -> NrmCycle:
    cycle = NrmCycle(
        name=payload.name,
        description=payload.description,
        pricing_date=payload.pricing_date or date.today(),
        currency_code=payload.currency_code,
    )
    db.add(cycle)
    db.commit()
    db.refresh(cycle)
    return cycle


@app.patch("/api/cycles/{cycle_id}", response_model=CycleOut)
def update_cycle(
    cycle_id: int, payload: CycleUpdate, db: Session = Depends(get_db)
) -> NrmCycle:
    cycle = _require_cycle(db, cycle_id)
    if cycle.status == CycleStatus.PUBLISHED:
        raise HTTPException(400, "Published cycle settings are read-only")
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(cycle, field, value)
    db.commit()
    db.refresh(cycle)
    return cycle


@app.get("/api/cycles/{cycle_id}", response_model=CycleOut)
def get_cycle(cycle_id: int, db: Session = Depends(get_db)) -> NrmCycle:
    return _require_cycle(db, cycle_id)


@app.patch("/api/cycles/{cycle_id}/status", response_model=CycleOut)
def update_cycle_status(
    cycle_id: int, payload: CycleStatusUpdate, db: Session = Depends(get_db)
) -> NrmCycle:
    cycle = _require_cycle(db, cycle_id)
    allowed = STATUS_TRANSITIONS.get(cycle.status, set())
    if payload.status != cycle.status and payload.status not in allowed:
        raise HTTPException(
            400,
            f"Transition {cycle.status.value} -> {payload.status.value} not allowed",
        )

    if payload.status == CycleStatus.PUBLISHED:
        filters = build_filters(cycle)
        dimensions, totals, pdate, filters = run_calculation(db, cycle, filters)
        if not dimensions:
            raise HTTPException(400, "No rows match filters/pricing date for snapshot")
        save_publish_snapshot(db, cycle, dimensions, totals, pdate, filters)

    cycle.status = payload.status
    db.commit()
    db.refresh(cycle)
    return cycle


@app.post("/api/cycles/{cycle_id}/publish", response_model=CycleOut)
def publish_cycle(cycle_id: int, db: Session = Depends(get_db)) -> NrmCycle:
    """Публикация с snapshot: допустимо из draft, simulated или approved."""
    cycle = _require_cycle(db, cycle_id)
    if cycle.status == CycleStatus.PUBLISHED:
        raise HTTPException(400, "Cycle is already published")

    filters = build_filters(cycle)
    dimensions, totals, pdate, filters = run_calculation(db, cycle, filters)
    if not dimensions:
        raise HTTPException(
            400,
            "No rows match filters/pricing date for snapshot. "
            "Check pricing_date, filters and valid_from/valid_to on rows.",
        )

    save_publish_snapshot(db, cycle, dimensions, totals, pdate, filters)
    cycle.status = CycleStatus.PUBLISHED
    db.commit()
    db.refresh(cycle)
    return cycle


# --- Source data ---


@app.get("/api/cycles/{cycle_id}/source", response_model=list[SourceRowOut])
def list_source_rows(cycle_id: int, db: Session = Depends(get_db)) -> list[SourceDataRow]:
    _require_cycle(db, cycle_id)
    return (
        db.query(SourceDataRow)
        .filter(SourceDataRow.cycle_id == cycle_id)
        .order_by(SourceDataRow.row_order, SourceDataRow.id)
        .all()
    )


def _source_row_dict(row_in: SourceRowIn, order: int) -> dict:
    data = row_in.model_dump(exclude={"id"})
    data["row_order"] = order
    return data


@app.put("/api/cycles/{cycle_id}/source", response_model=list[SourceRowOut])
def bulk_update_source(
    cycle_id: int, payload: SourceBulkUpdate, db: Session = Depends(get_db)
) -> list[SourceDataRow]:
    cycle = _require_cycle(db, cycle_id)
    if cycle.status == CycleStatus.PUBLISHED:
        raise HTTPException(400, "Published cycle is read-only")

    existing = {
        r.id: r
        for r in db.query(SourceDataRow).filter(SourceDataRow.cycle_id == cycle_id).all()
    }
    kept_ids: set[int] = set()

    for i, row_in in enumerate(payload.rows):
        data = _source_row_dict(row_in, i)
        if row_in.id and row_in.id in existing:
            obj = existing[row_in.id]
            for k, v in data.items():
                setattr(obj, k, v)
            kept_ids.add(row_in.id)
        else:
            db.add(SourceDataRow(cycle_id=cycle_id, **data))

    for rid, obj in existing.items():
        if rid not in kept_ids:
            db.delete(obj)

    if cycle.status != CycleStatus.DRAFT:
        cycle.status = CycleStatus.DRAFT
    db.commit()
    return list_source_rows(cycle_id, db)


@app.get("/api/cycles/{cycle_id}/source/grid", response_model=GridSchema)
def source_grid(cycle_id: int, db: Session = Depends(get_db)) -> GridSchema:
    rows = list_source_rows(cycle_id, db)
    return _to_grid(SOURCE_COLUMNS, rows, editable=True)


def _tier_grid_objects(cycle_id: int, db: Session) -> list[dict[str, Any]]:
    pairs = (
        db.query(VolumeTier, SourceDataRow)
        .join(SourceDataRow, VolumeTier.source_row_id == SourceDataRow.id)
        .filter(SourceDataRow.cycle_id == cycle_id)
        .order_by(SourceDataRow.row_order, VolumeTier.tier_order, VolumeTier.id)
        .all()
    )
    result: list[dict[str, Any]] = []
    for tier, src in pairs:
        result.append(
            {
                "id": tier.id,
                "source_row_id": tier.source_row_id,
                "sku": src.sku,
                "product_name": src.product_name,
                "customer_code": src.customer_code or "",
                "min_volume": tier.min_volume,
                "discount_pct": tier.discount_pct,
            }
        )
    return result


@app.get("/api/cycles/{cycle_id}/tiers/grid", response_model=GridSchema)
def tiers_grid(cycle_id: int, db: Session = Depends(get_db)) -> GridSchema:
    _require_cycle(db, cycle_id)
    return _to_grid(TIER_COLUMNS, _tier_grid_objects(cycle_id, db), editable=True)


@app.put("/api/cycles/{cycle_id}/tiers")
def bulk_update_tiers(
    cycle_id: int, payload: TierBulkUpdate, db: Session = Depends(get_db)
):
    cycle = _require_cycle(db, cycle_id)
    if cycle.status == CycleStatus.PUBLISHED:
        raise HTTPException(400, "Published cycle is read-only")

    valid_source_ids = {
        r.id
        for r in db.query(SourceDataRow).filter(SourceDataRow.cycle_id == cycle_id).all()
    }
    existing = {
        t.id: t
        for t in db.query(VolumeTier)
        .join(SourceDataRow)
        .filter(SourceDataRow.cycle_id == cycle_id)
        .all()
    }
    kept: set[int] = set()

    for row_in in payload.rows:
        if row_in.source_row_id not in valid_source_ids:
            raise HTTPException(400, f"Invalid source_row_id {row_in.source_row_id}")
        data = {
            "source_row_id": row_in.source_row_id,
            "tier_order": row_in.tier_order,
            "min_volume": float(row_in.min_volume or 0),
            "discount_pct": float(row_in.discount_pct or 0),
        }
        if row_in.id and row_in.id in existing:
            obj = existing[row_in.id]
            for k, v in data.items():
                setattr(obj, k, v)
            kept.add(row_in.id)
        else:
            db.add(VolumeTier(**data))

    for tid, obj in existing.items():
        if tid not in kept:
            db.delete(obj)

    if cycle.status != CycleStatus.DRAFT:
        cycle.status = CycleStatus.DRAFT
    db.commit()
    return {"ok": True, "rows": len(payload.rows)}


# --- Promo rules ---


@app.get("/api/cycles/{cycle_id}/promos/grid", response_model=GridSchema)
def promos_grid(cycle_id: int, db: Session = Depends(get_db)) -> GridSchema:
    _require_cycle(db, cycle_id)
    rows = (
        db.query(PromoRule)
        .filter(PromoRule.cycle_id == cycle_id)
        .order_by(PromoRule.row_order, PromoRule.id)
        .all()
    )
    return _to_grid(PROMO_COLUMNS, rows, editable=True)


@app.put("/api/cycles/{cycle_id}/promos", response_model=list[PromoRuleOut])
def bulk_update_promos(
    cycle_id: int, payload: PromoBulkUpdate, db: Session = Depends(get_db)
) -> list[PromoRule]:
    cycle = _require_cycle(db, cycle_id)
    if cycle.status == CycleStatus.PUBLISHED:
        raise HTTPException(400, "Published cycle is read-only")

    existing = {
        r.id: r for r in db.query(PromoRule).filter(PromoRule.cycle_id == cycle_id).all()
    }
    kept: set[int] = set()
    for i, row_in in enumerate(payload.rows):
        data = row_in.model_dump(exclude={"id"})
        data["row_order"] = i
        if isinstance(data.get("stackable"), str):
            data["stackable"] = data["stackable"] in (True, "true", "1", 1)
        if data.get("scope_type"):
            data["scope_type"] = PromoScopeType(str(data["scope_type"]))
        if row_in.id and row_in.id in existing:
            obj = existing[row_in.id]
            for k, v in data.items():
                setattr(obj, k, v)
            kept.add(row_in.id)
        else:
            db.add(PromoRule(cycle_id=cycle_id, **data))
    for rid, obj in existing.items():
        if rid not in kept:
            db.delete(obj)
    if cycle.status != CycleStatus.DRAFT:
        cycle.status = CycleStatus.DRAFT
    db.commit()
    return (
        db.query(PromoRule)
        .filter(PromoRule.cycle_id == cycle_id)
        .order_by(PromoRule.row_order)
        .all()
    )


# --- Matrix masters ---


@app.get("/api/customers/grid", response_model=GridSchema)
def customers_grid(db: Session = Depends(get_db)) -> GridSchema:
    rows = db.query(Customer).order_by(Customer.code).all()
    return _to_grid(CUSTOMER_COLUMNS, rows, editable=True)


@app.put("/api/customers")
def update_customers(payload: list[MatrixMasterRow], db: Session = Depends(get_db)):
    _bulk_master(Customer, payload, db, extra_fields=["region"])
    db.commit()
    return {"ok": True}


@app.get("/api/channels/grid", response_model=GridSchema)
def channels_grid(db: Session = Depends(get_db)) -> GridSchema:
    rows = db.query(Channel).order_by(Channel.code).all()
    return _to_grid(CHANNEL_COLUMNS, rows, editable=True)


@app.put("/api/channels")
def update_channels(payload: list[MatrixMasterRow], db: Session = Depends(get_db)):
    _bulk_master(Channel, payload, db)
    db.commit()
    return {"ok": True}


@app.post("/api/cycles/{cycle_id}/matrix/expand")
def expand_matrix(
    cycle_id: int, payload: MatrixExpandRequest, db: Session = Depends(get_db)
):
    cycle = _require_cycle(db, cycle_id)
    if cycle.status == CycleStatus.PUBLISHED:
        raise HTTPException(400, "Published cycle is read-only")
    template = payload.template or SourceRowIn()
    existing_keys = {
        (r.sku, r.customer_code, r.channel)
        for r in db.query(SourceDataRow).filter(SourceDataRow.cycle_id == cycle_id).all()
    }
    order = (
        db.query(SourceDataRow)
        .filter(SourceDataRow.cycle_id == cycle_id)
        .count()
    )
    created = 0
    for sku in payload.skus:
        for cust in payload.customer_codes:
            for ch in payload.channel_codes:
                key = (sku, cust, ch)
                if key in existing_keys:
                    continue
                data = template.model_dump(exclude={"id"})
                data["sku"] = sku
                data["customer_code"] = cust
                data["channel"] = ch
                data["product_name"] = data.get("product_name") or sku
                allowed = {c.name for c in SourceDataRow.__table__.columns} - {"id", "cycle_id"}
                db.add(
                    SourceDataRow(
                        cycle_id=cycle_id,
                        row_order=order,
                        **{k: v for k, v in data.items() if k in allowed},
                    )
                )
                order += 1
                created += 1
    db.commit()
    return {"created": created}


# --- Calculate ---


@app.post("/api/cycles/{cycle_id}/calculate", response_model=CalculateResponse)
def calculate(
    cycle_id: int,
    db: Session = Depends(get_db),
    category: str | None = Query(None),
    channel: str | None = Query(None),
    customer_code: str | None = Query(None),
    pricing_date: date | None = Query(None),
) -> CalculateResponse:
    cycle = _require_cycle(db, cycle_id)
    filters = build_filters(cycle, category, channel, customer_code)
    dimensions, totals, pdate, filters = run_calculation(
        db, cycle, filters, pricing_date
    )
    if not dimensions:
        raise HTTPException(
            400,
            "No rows match pricing date and filters (category/channel/customer)",
        )

    if cycle.status == CycleStatus.DRAFT:
        cycle.status = CycleStatus.SIMULATED
        db.commit()
        db.refresh(cycle)

    return CalculateResponse(
        cycle_id=cycle_id,
        status=cycle.status,
        pricing_date=pdate,
        currency_code=cycle.currency_code,
        filters={
            "category": filters.category,
            "channel": filters.channel,
            "customer_code": filters.customer_code,
        },
        rows=[DimensionRowOut.model_validate(d.__dict__) for d in dimensions],
        totals=totals,
    )


@app.get("/api/cycles/{cycle_id}/dimensions/grid", response_model=GridSchema)
def dimensions_grid(
    cycle_id: int,
    db: Session = Depends(get_db),
    category: str | None = Query(None),
    channel: str | None = Query(None),
    customer_code: str | None = Query(None),
    pricing_date: date | None = Query(None),
) -> GridSchema:
    cycle = _require_cycle(db, cycle_id)
    filters = build_filters(cycle, category, channel, customer_code)
    dimensions, _, _, _ = run_calculation(db, cycle, filters, pricing_date)
    return _to_grid(DIMENSION_COLUMNS, dimensions, editable=False)


# --- Snapshots ---


@app.get("/api/cycles/{cycle_id}/snapshots", response_model=list[SnapshotOut])
def list_snapshots(cycle_id: int, db: Session = Depends(get_db)) -> list[CalculationSnapshot]:
    _require_cycle(db, cycle_id)
    return (
        db.query(CalculationSnapshot)
        .filter(CalculationSnapshot.cycle_id == cycle_id)
        .order_by(CalculationSnapshot.published_at.desc())
        .all()
    )


@app.get("/api/snapshots/{snapshot_id}", response_model=SnapshotDetailOut)
def get_snapshot(snapshot_id: int, db: Session = Depends(get_db)) -> CalculationSnapshot:
    snap = db.get(CalculationSnapshot, snapshot_id)
    if not snap:
        raise HTTPException(404, "Snapshot not found")
    return snap


@app.get("/api/snapshots/{snapshot_id}/grid", response_model=GridSchema)
def snapshot_grid(snapshot_id: int, db: Session = Depends(get_db)) -> GridSchema:
    snap = db.get(CalculationSnapshot, snapshot_id)
    if not snap:
        raise HTTPException(404, "Snapshot not found")
    return _to_grid(DIMENSION_COLUMNS, snap.rows or [], editable=False)


# --- Helpers ---


def _require_cycle(db: Session, cycle_id: int) -> NrmCycle:
    cycle = db.get(NrmCycle, cycle_id)
    if not cycle:
        raise HTTPException(404, "Cycle not found")
    return cycle


def _bulk_master(model, payload: list[MatrixMasterRow], db: Session, extra_fields=None):
    extra_fields = extra_fields or []
    existing = {r.id: r for r in db.query(model).all() if r.id}
    by_code = {r.code: r for r in db.query(model).all()}
    kept: set[int] = set()
    for row in payload:
        if row.id and row.id in existing:
            obj = existing[row.id]
            obj.code = row.code
            obj.name = row.name
            obj.active = row.active
            for f in extra_fields:
                setattr(obj, f, getattr(row, f, ""))
            kept.add(row.id)
        elif row.code in by_code:
            obj = by_code[row.code]
            obj.name = row.name
            obj.active = row.active
            for f in extra_fields:
                setattr(obj, f, getattr(row, f, ""))
            kept.add(obj.id)
        else:
            kwargs = {"code": row.code, "name": row.name, "active": row.active}
            for f in extra_fields:
                kwargs[f] = getattr(row, f, "")
            db.add(model(**kwargs))
    for rid, obj in existing.items():
        if rid not in kept:
            db.delete(obj)


def _to_grid(
    columns_spec: list[tuple],
    rows: list[Any],
    editable: bool,
) -> GridSchema:
    from app.schemas import GridColumn

    columns = []
    col_keys: list[str] = []
    for spec in columns_spec:
        k, t, w = spec[0], spec[1], spec[2]
        col_editable = spec[3] if len(spec) > 3 else editable
        col_keys.append(k)
        columns.append(
            GridColumn(
                key=k,
                title=t,
                width=w,
                editable=col_editable and k not in ("id",),
                type=_col_type(k),
            )
        )
    grid_rows: list[dict[str, Any]] = []
    for row in rows:
        if isinstance(row, dict):
            item = {"id": row.get("id") or row.get("source_id")}
            source = row
        else:
            item = {"id": getattr(row, "id", None) or getattr(row, "source_id", None)}
            source = row
        for key in col_keys:
            val = source[key] if isinstance(source, dict) else getattr(source, key, None)
            if key == "stackable":
                item[key] = bool(val) if val is not None else False
            elif key in ("valid_from", "valid_to") and val is not None:
                item[key] = str(val)
            else:
                item[key] = val if val is not None else ""
        grid_rows.append(item)
    return GridSchema(columns=columns, rows=grid_rows)


def _col_type(key: str) -> str:
    if key in NUMBER_KEYS:
        return "number"
    if key in ("valid_from", "valid_to"):
        return "date"
    if key == "stackable":
        return "checkbox"
    return "text"
