import json
from dataclasses import dataclass, field
from datetime import date

from app.models import PromoRule, SourceDataRow
from app.promo_engine import AppliedPromo, resolve_promo_discounts


@dataclass
class CalculationFilters:
    category: str | None = None
    channel: str | None = None
    customer_code: str | None = None


@dataclass
class DimensionRow:
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


def _pct(value: float) -> float:
    return max(0.0, min(float(value), 100.0)) / 100.0


def _is_effective(row: SourceDataRow, pricing_date: date) -> bool:
    if row.valid_from and pricing_date < row.valid_from:
        return False
    if row.valid_to and pricing_date > row.valid_to:
        return False
    return True


def _matches_filters(row: SourceDataRow, filters: CalculationFilters) -> bool:
    if filters.category and (row.category or "").lower() != filters.category.lower():
        return False
    if filters.channel and (row.channel or "").lower() != filters.channel.lower():
        return False
    if filters.customer_code and (row.customer_code or "").lower() != filters.customer_code.lower():
        return False
    return True


def _volume_tier_discount(volume_in_units: float, tiers: list | None) -> float:
    if not tiers:
        return 0.0
    applicable = [0.0]
    for tier in tiers:
        if not isinstance(tier, dict):
            continue
        min_vol = float(tier.get("min_volume", 0) or 0)
        disc = float(tier.get("discount_pct", 0) or 0)
        if volume_in_units >= min_vol:
            applicable.append(disc)
    return max(applicable)


def calculate_row(
    row: SourceDataRow,
    promo_rules: list[PromoRule],
    pricing_date: date,
    cycle_currency: str,
) -> DimensionRow:
    rate = float(row.exchange_rate or 1.0)
    list_price = float(row.list_price or 0) * rate
    contract = _pct(float(row.contract_discount_pct or 0))

    volume_uom = float(row.planned_volume or 0)
    units_per = float(row.units_per_uom or 1.0) or 1.0
    volume_in_units = volume_uom * units_per

    tier_disc = _volume_tier_discount(volume_in_units, row.volume_tiers)
    promo_total_pct, applied_list = resolve_promo_discounts(row, promo_rules, pricing_date)
    promo = _pct(promo_total_pct)
    tier = _pct(tier_disc)

    off_inv = _pct(float(row.off_invoice_pct or 0))
    trade = float(row.trade_spend_per_unit or 0) * rate
    cost = float(row.unit_cost or 0) * rate
    tax_rate = _pct(float(row.tax_rate_pct or 0))

    invoice_unit = list_price * (1.0 - contract)
    after_promo = invoice_unit * (1.0 - promo)
    after_tier = after_promo * (1.0 - tier)
    net_unit = after_tier * (1.0 - off_inv) - trade
    net_unit = max(net_unit, 0.0)

    gross_revenue = list_price * volume_uom
    invoice_revenue = invoice_unit * volume_uom
    trade_total = trade * volume_uom
    net_revenue = net_unit * volume_uom
    tax_amount = net_revenue * tax_rate
    net_after_tax = net_revenue + tax_amount
    cogs = cost * volume_uom
    gross_margin = net_revenue - cogs
    margin_pct = (gross_margin / net_revenue * 100.0) if net_revenue > 0 else 0.0

    if list_price > 0:
        discount_total_pct = (1.0 - net_unit / list_price) * 100.0
    else:
        discount_total_pct = 0.0

    applied_json = json.dumps(
        [
            {
                "rule_id": p.rule_id,
                "name": p.name,
                "discount_pct": p.discount_pct,
                "stackable": p.stackable,
                "priority": p.priority,
            }
            for p in applied_list
        ],
        ensure_ascii=False,
    )

    return DimensionRow(
        source_id=row.id,
        sku=row.sku,
        product_name=row.product_name,
        category=row.category,
        channel=row.channel,
        customer_code=row.customer_code or "",
        currency_code=row.currency_code or cycle_currency,
        uom=row.uom or "EA",
        units_per_uom=round(units_per, 4),
        volume_in_units=round(volume_in_units, 4),
        list_price=round(float(row.list_price or 0), 4),
        list_price_base_currency=round(list_price, 4),
        invoice_unit_price=round(invoice_unit, 4),
        net_unit_price=round(net_unit, 4),
        planned_volume=round(volume_uom, 4),
        tier_discount_pct=round(tier_disc, 2),
        promo_discount_pct=round(promo_total_pct, 2),
        applied_promos=applied_json,
        gross_revenue=round(gross_revenue, 2),
        invoice_revenue=round(invoice_revenue, 2),
        trade_spend_total=round(trade_total, 2),
        net_revenue=round(net_revenue, 2),
        tax_amount=round(tax_amount, 2),
        net_revenue_after_tax=round(net_after_tax, 2),
        cogs=round(cogs, 2),
        gross_margin=round(gross_margin, 2),
        margin_pct=round(margin_pct, 2),
        discount_total_pct=round(discount_total_pct, 2),
    )


def filter_and_calculate(
    rows: list[SourceDataRow],
    promo_rules: list[PromoRule],
    pricing_date: date,
    cycle_currency: str,
    filters: CalculationFilters,
) -> list[DimensionRow]:
    result: list[DimensionRow] = []
    for row in rows:
        if not _is_effective(row, pricing_date):
            continue
        if not _matches_filters(row, filters):
            continue
        result.append(calculate_row(row, promo_rules, pricing_date, cycle_currency))
    return result


def calculate_totals(rows: list[DimensionRow]) -> dict[str, float]:
    net_sum = sum(r.net_revenue for r in rows)
    return {
        "gross_revenue": round(sum(r.gross_revenue for r in rows), 2),
        "invoice_revenue": round(sum(r.invoice_revenue for r in rows), 2),
        "trade_spend_total": round(sum(r.trade_spend_total for r in rows), 2),
        "net_revenue": round(net_sum, 2),
        "tax_amount": round(sum(r.tax_amount for r in rows), 2),
        "net_revenue_after_tax": round(sum(r.net_revenue_after_tax for r in rows), 2),
        "cogs": round(sum(r.cogs for r in rows), 2),
        "gross_margin": round(sum(r.gross_margin for r in rows), 2),
        "margin_pct": round(
            (sum(r.gross_margin for r in rows) / net_sum * 100.0) if net_sum > 0 else 0.0,
            2,
        ),
    }
