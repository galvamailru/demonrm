"""Копирование данных цикла NRM при создании нового сценария."""

from sqlalchemy.orm import Session, joinedload

from app.models import NrmCycle, PromoRule, SourceDataRow, VolumeTier

_SOURCE_ROW_FIELDS = (
    "row_order",
    "sku",
    "product_name",
    "category",
    "channel",
    "customer_code",
    "valid_from",
    "valid_to",
    "currency_code",
    "exchange_rate",
    "uom",
    "units_per_uom",
    "tax_rate_pct",
    "list_price",
    "contract_discount_pct",
    "promo_discount_pct",
    "off_invoice_pct",
    "trade_spend_per_unit",
    "unit_cost",
    "planned_volume",
)

_PROMO_FIELDS = (
    "row_order",
    "name",
    "priority",
    "stackable",
    "discount_pct",
    "scope_type",
    "scope_value",
    "valid_from",
    "valid_to",
)


def apply_cycle_settings(source: NrmCycle, target: NrmCycle) -> None:
    """Параметры расчёта цикла — как у источника."""
    target.pricing_date = source.pricing_date
    target.currency_code = source.currency_code
    target.filter_category = source.filter_category
    target.filter_channel = source.filter_channel
    target.filter_customer_code = source.filter_customer_code


def copy_cycle_data(db: Session, from_cycle_id: int, to_cycle_id: int) -> dict[str, int]:
    """Копирует матрицу цен, volume tiers и промо-правила. Возвращает счётчики."""
    source_rows = (
        db.query(SourceDataRow)
        .options(joinedload(SourceDataRow.volume_tier_rows))
        .filter(SourceDataRow.cycle_id == from_cycle_id)
        .order_by(SourceDataRow.row_order, SourceDataRow.id)
        .all()
    )

    tier_count = 0
    for old_row in source_rows:
        row_data = {f: getattr(old_row, f) for f in _SOURCE_ROW_FIELDS}
        new_row = SourceDataRow(cycle_id=to_cycle_id, **row_data)
        db.add(new_row)
        db.flush()

        for old_tier in sorted(
            old_row.volume_tier_rows, key=lambda t: (t.tier_order, t.id)
        ):
            db.add(
                VolumeTier(
                    source_row_id=new_row.id,
                    tier_order=old_tier.tier_order,
                    min_volume=old_tier.min_volume,
                    discount_pct=old_tier.discount_pct,
                )
            )
            tier_count += 1

    promo_count = 0
    promos = (
        db.query(PromoRule)
        .filter(PromoRule.cycle_id == from_cycle_id)
        .order_by(PromoRule.row_order, PromoRule.id)
        .all()
    )
    for old_promo in promos:
        promo_data = {f: getattr(old_promo, f) for f in _PROMO_FIELDS}
        db.add(PromoRule(cycle_id=to_cycle_id, **promo_data))
        promo_count += 1

    return {
        "source_rows": len(source_rows),
        "tiers": tier_count,
        "promos": promo_count,
    }
