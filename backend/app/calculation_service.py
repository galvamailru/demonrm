from datetime import date

from sqlalchemy.orm import Session, joinedload

from app.calculator import CalculationFilters, calculate_totals, filter_and_calculate
from app.models import CalculationSnapshot, CycleStatus, NrmCycle, PromoRule, SourceDataRow


def _norm_filter(value: str | None) -> str | None:
    if value is None:
        return None
    if isinstance(value, str) and not value.strip():
        return None
    return str(value).strip()


def build_query_filters(
    category: str | None = None,
    channel: str | None = None,
    customer_code: str | None = None,
) -> CalculationFilters:
    """Фильтры только из запроса/UI. Пустые значения = все строки."""
    return CalculationFilters(
        category=_norm_filter(category),
        channel=_norm_filter(channel),
        customer_code=_norm_filter(customer_code),
    )


def build_filters(
    _cycle: NrmCycle,
    category: str | None = None,
    channel: str | None = None,
    customer_code: str | None = None,
) -> CalculationFilters:
    """Расчёт по параметрам запроса; filter_* в БД цикла не подмешиваются."""
    return build_query_filters(category, channel, customer_code)


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
