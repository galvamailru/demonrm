import time
from typing import Any

from fastapi import Depends, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session

from app.calculator import calculate_row, calculate_totals
from app.config import settings
from app.database import Base, engine, get_db
from app.models import CycleStatus, NrmCycle, SourceDataRow
from app.schemas import (
    CalculateResponse,
    CycleCreate,
    CycleOut,
    CycleStatusUpdate,
    DimensionRowOut,
    GridSchema,
    SourceBulkUpdate,
    SourceRowIn,
    SourceRowOut,
)
from app.seed import seed_demo_data

app = FastAPI(title="Demo NRM API", version="1.0.0")

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
    ("sku", "SKU", 100),
    ("product_name", "Наименование", 200),
    ("category", "Категория", 120),
    ("channel", "Канал", 130),
    ("list_price", "List Price", 110),
    ("contract_discount_pct", "Скидка контракт %", 140),
    ("promo_discount_pct", "Промо %", 100),
    ("off_invoice_pct", "Off-invoice %", 120),
    ("trade_spend_per_unit", "Trade spend/ед", 130),
    ("unit_cost", "Себестоимость", 120),
    ("planned_volume", "Объём план", 110),
]

DIMENSION_COLUMNS = [
    ("sku", "SKU", 100),
    ("product_name", "Наименование", 180),
    ("list_price", "List Price", 100),
    ("invoice_unit_price", "Invoice Price", 120),
    ("net_unit_price", "Net Price", 110),
    ("planned_volume", "Объём", 90),
    ("gross_revenue", "Gross Revenue", 130),
    ("invoice_revenue", "Invoice Revenue", 130),
    ("trade_spend_total", "Trade Spend", 120),
    ("net_revenue", "Net Revenue", 120),
    ("cogs", "COGS", 100),
    ("gross_margin", "Gross Margin", 120),
    ("margin_pct", "Margin %", 90),
    ("discount_total_pct", "Total Disc %", 110),
]


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


@app.get("/api/cycles", response_model=list[CycleOut])
def list_cycles(db: Session = Depends(get_db)) -> list[NrmCycle]:
    return db.query(NrmCycle).order_by(NrmCycle.id.desc()).all()


@app.post("/api/cycles", response_model=CycleOut, status_code=201)
def create_cycle(payload: CycleCreate, db: Session = Depends(get_db)) -> NrmCycle:
    cycle = NrmCycle(name=payload.name, description=payload.description)
    db.add(cycle)
    db.commit()
    db.refresh(cycle)
    return cycle


@app.get("/api/cycles/{cycle_id}", response_model=CycleOut)
def get_cycle(cycle_id: int, db: Session = Depends(get_db)) -> NrmCycle:
    cycle = db.get(NrmCycle, cycle_id)
    if not cycle:
        raise HTTPException(404, "Cycle not found")
    return cycle


@app.patch("/api/cycles/{cycle_id}/status", response_model=CycleOut)
def update_cycle_status(
    cycle_id: int, payload: CycleStatusUpdate, db: Session = Depends(get_db)
) -> NrmCycle:
    cycle = db.get(NrmCycle, cycle_id)
    if not cycle:
        raise HTTPException(404, "Cycle not found")

    allowed = STATUS_TRANSITIONS.get(cycle.status, set())
    if payload.status != cycle.status and payload.status not in allowed:
        raise HTTPException(
            400,
            f"Transition {cycle.status.value} -> {payload.status.value} not allowed",
        )

    if payload.status == CycleStatus.SIMULATED:
        rows = (
            db.query(SourceDataRow)
            .filter(SourceDataRow.cycle_id == cycle_id)
            .order_by(SourceDataRow.row_order)
            .all()
        )
        if not rows:
            raise HTTPException(400, "No source data to simulate")

    cycle.status = payload.status
    db.commit()
    db.refresh(cycle)
    return cycle


@app.get("/api/cycles/{cycle_id}/source", response_model=list[SourceRowOut])
def list_source_rows(cycle_id: int, db: Session = Depends(get_db)) -> list[SourceDataRow]:
    _require_cycle(db, cycle_id)
    return (
        db.query(SourceDataRow)
        .filter(SourceDataRow.cycle_id == cycle_id)
        .order_by(SourceDataRow.row_order, SourceDataRow.id)
        .all()
    )


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
        data = row_in.model_dump(exclude={"id"})
        data["row_order"] = i
        if row_in.id and row_in.id in existing:
            obj = existing[row_in.id]
            for k, v in data.items():
                setattr(obj, k, v)
            kept_ids.add(row_in.id)
        else:
            obj = SourceDataRow(cycle_id=cycle_id, **data)
            db.add(obj)

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


@app.post("/api/cycles/{cycle_id}/calculate", response_model=CalculateResponse)
def calculate(cycle_id: int, db: Session = Depends(get_db)) -> CalculateResponse:
    cycle = _require_cycle(db, cycle_id)
    source = list_source_rows(cycle_id, db)
    if not source:
        raise HTTPException(400, "No source data")

    dimensions = [calculate_row(r) for r in source]
    totals = calculate_totals(dimensions)

    if cycle.status == CycleStatus.DRAFT:
        cycle.status = CycleStatus.SIMULATED
        db.commit()
        db.refresh(cycle)

    return CalculateResponse(
        cycle_id=cycle_id,
        status=cycle.status,
        rows=[DimensionRowOut.model_validate(d.__dict__) for d in dimensions],
        totals=totals,
    )


@app.get("/api/cycles/{cycle_id}/dimensions/grid", response_model=GridSchema)
def dimensions_grid(cycle_id: int, db: Session = Depends(get_db)) -> GridSchema:
    _require_cycle(db, cycle_id)
    source = list_source_rows(cycle_id, db)
    dimensions = [calculate_row(r) for r in source]
    return _to_grid(DIMENSION_COLUMNS, dimensions, editable=False)


def _require_cycle(db: Session, cycle_id: int) -> NrmCycle:
    cycle = db.get(NrmCycle, cycle_id)
    if not cycle:
        raise HTTPException(404, "Cycle not found")
    return cycle


def _to_grid(
    columns_spec: list[tuple[str, str, int]],
    rows: list[Any],
    editable: bool,
) -> GridSchema:
    from app.schemas import GridColumn

    columns = [
        GridColumn(key=k, title=t, width=w, editable=editable, type=_col_type(k))
        for k, t, w in columns_spec
    ]
    grid_rows: list[dict[str, Any]] = []
    for row in rows:
        item: dict[str, Any] = {"id": getattr(row, "id", None) or getattr(row, "source_id", None)}
        for key, _, _ in columns_spec:
            val = getattr(row, key, None)
            item[key] = val if val is not None else ""
        grid_rows.append(item)
    return GridSchema(columns=columns, rows=grid_rows)


def _col_type(key: str) -> str:
    if key in {
        "list_price",
        "contract_discount_pct",
        "promo_discount_pct",
        "off_invoice_pct",
        "trade_spend_per_unit",
        "unit_cost",
        "planned_volume",
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
    }:
        return "number"
    return "text"
