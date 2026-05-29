from datetime import date

from sqlalchemy.orm import Session, joinedload

from app.calculator import CalculationFilters, calculate_totals, filter_and_calculate
from app.models import CalculationSnapshot, CycleStatus, NrmCycle, PromoRule, SourceDataRow


def build_filters(
    cycle: NrmCycle,
    category: str | None = None,
    channel: str | None = None,
    customer_code: str | None = None,
) -> CalculationFilters:
    return CalculationFilters(
        category=category or cycle.filter_category or None,
        channel=channel or cycle.filter_channel or None,
        customer_code=customer_code or cycle.filter_customer_code or None,
    )


def run_calculation(
    db: Session,
    cycle: NrmCycle,
    filters: CalculationFilters,
    pricing_date: date | None = None,
):
    pdate = pricing_date or cycle.pricing_date
    source = (
        db.query(SourceDataRow)
        .options(joinedload(SourceDataRow.volume_tier_rows))
        .filter(SourceDataRow.cycle_id == cycle.id)
        .order_by(SourceDataRow.row_order, SourceDataRow.id)
        .all()
    )
    promos = (
        db.query(PromoRule)
        .filter(PromoRule.cycle_id == cycle.id)
        .order_by(PromoRule.priority, PromoRule.id)
        .all()
    )
    dimensions = filter_and_calculate(
        source, promos, pdate, cycle.currency_code, filters
    )
    totals = calculate_totals(dimensions)
    return dimensions, totals, pdate, filters


def save_publish_snapshot(
    db: Session,
    cycle: NrmCycle,
    dimensions: list,
    totals: dict,
    pricing_date: date,
    filters: CalculationFilters,
) -> CalculationSnapshot:
    snap = CalculationSnapshot(
        cycle_id=cycle.id,
        pricing_date=pricing_date,
        currency_code=cycle.currency_code,
        filters={
            "category": filters.category,
            "channel": filters.channel,
            "customer_code": filters.customer_code,
        },
        totals=totals,
        rows=[d.__dict__ if hasattr(d, "__dict__") else d for d in dimensions],
    )
    db.add(snap)
    return snap
