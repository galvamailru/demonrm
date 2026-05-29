from dataclasses import dataclass

from app.models import SourceDataRow


@dataclass
class DimensionRow:
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


def _pct(value: float) -> float:
    return max(0.0, min(value, 100.0)) / 100.0


def calculate_row(row: SourceDataRow) -> DimensionRow:
    list_price = float(row.list_price or 0)
    contract = _pct(float(row.contract_discount_pct or 0))
    promo = _pct(float(row.promo_discount_pct or 0))
    off_inv = _pct(float(row.off_invoice_pct or 0))
    trade = float(row.trade_spend_per_unit or 0)
    cost = float(row.unit_cost or 0)
    volume = float(row.planned_volume or 0)

    invoice_unit = list_price * (1.0 - contract)
    after_promo = invoice_unit * (1.0 - promo)
    net_unit = after_promo * (1.0 - off_inv) - trade
    net_unit = max(net_unit, 0.0)

    gross_revenue = list_price * volume
    invoice_revenue = invoice_unit * volume
    trade_total = trade * volume
    net_revenue = net_unit * volume
    cogs = cost * volume
    gross_margin = net_revenue - cogs
    margin_pct = (gross_margin / net_revenue * 100.0) if net_revenue > 0 else 0.0

    if list_price > 0:
        discount_total_pct = (1.0 - net_unit / list_price) * 100.0
    else:
        discount_total_pct = 0.0

    return DimensionRow(
        source_id=row.id,
        sku=row.sku,
        product_name=row.product_name,
        category=row.category,
        channel=row.channel,
        list_price=round(list_price, 4),
        invoice_unit_price=round(invoice_unit, 4),
        net_unit_price=round(net_unit, 4),
        planned_volume=round(volume, 4),
        gross_revenue=round(gross_revenue, 2),
        invoice_revenue=round(invoice_revenue, 2),
        trade_spend_total=round(trade_total, 2),
        net_revenue=round(net_revenue, 2),
        cogs=round(cogs, 2),
        gross_margin=round(gross_margin, 2),
        margin_pct=round(margin_pct, 2),
        discount_total_pct=round(discount_total_pct, 2),
    )


def calculate_totals(rows: list[DimensionRow]) -> dict[str, float]:
    return {
        "gross_revenue": round(sum(r.gross_revenue for r in rows), 2),
        "invoice_revenue": round(sum(r.invoice_revenue for r in rows), 2),
        "trade_spend_total": round(sum(r.trade_spend_total for r in rows), 2),
        "net_revenue": round(sum(r.net_revenue for r in rows), 2),
        "cogs": round(sum(r.cogs for r in rows), 2),
        "gross_margin": round(sum(r.gross_margin for r in rows), 2),
        "margin_pct": round(
            (
                sum(r.gross_margin for r in rows)
                / sum(r.net_revenue for r in rows)
                * 100.0
            )
            if sum(r.net_revenue for r in rows) > 0
            else 0.0,
            2,
        ),
    }
