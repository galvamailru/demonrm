from dataclasses import dataclass

from app.calculator import DimensionRow


@dataclass
class CompareRow:
    sku: str
    customer_code: str
    channel: str
    product_name: str
    net_revenue_base: float
    net_revenue_compare: float
    net_revenue_delta: float
    net_revenue_delta_pct: float
    gross_margin_base: float
    gross_margin_compare: float
    gross_margin_delta: float
    margin_pct_base: float
    margin_pct_compare: float
    margin_pct_delta: float


def _row_key(row: DimensionRow) -> tuple[str, str, str]:
    return (row.sku, row.customer_code or "", row.channel or "")


def _pct_delta(base: float, compare: float) -> float:
    if base == 0:
        return 0.0 if compare == 0 else 100.0
    return round((compare - base) / base * 100.0, 2)


def compare_dimensions(
    base_rows: list[DimensionRow],
    compare_rows: list[DimensionRow],
) -> tuple[list[CompareRow], dict[str, float]]:
    base_map = {_row_key(r): r for r in base_rows}
    compare_map = {_row_key(r): r for r in compare_rows}
    keys = sorted(set(base_map) | set(compare_map))

    result: list[CompareRow] = []
    totals_base_nr = 0.0
    totals_cmp_nr = 0.0
    totals_base_gm = 0.0
    totals_cmp_gm = 0.0

    for key in keys:
        b = base_map.get(key)
        c = compare_map.get(key)
        nr_b = b.net_revenue if b else 0.0
        nr_c = c.net_revenue if c else 0.0
        gm_b = b.gross_margin if b else 0.0
        gm_c = c.gross_margin if c else 0.0
        mp_b = b.margin_pct if b else 0.0
        mp_c = c.margin_pct if c else 0.0

        totals_base_nr += nr_b
        totals_cmp_nr += nr_c
        totals_base_gm += gm_b
        totals_cmp_gm += gm_c

        name = (b or c).product_name if (b or c) else key[0]
        result.append(
            CompareRow(
                sku=key[0],
                customer_code=key[1],
                channel=key[2],
                product_name=name,
                net_revenue_base=round(nr_b, 2),
                net_revenue_compare=round(nr_c, 2),
                net_revenue_delta=round(nr_c - nr_b, 2),
                net_revenue_delta_pct=_pct_delta(nr_b, nr_c),
                gross_margin_base=round(gm_b, 2),
                gross_margin_compare=round(gm_c, 2),
                gross_margin_delta=round(gm_c - gm_b, 2),
                margin_pct_base=round(mp_b, 2),
                margin_pct_compare=round(mp_c, 2),
                margin_pct_delta=round(mp_c - mp_b, 2),
            )
        )

    summary = {
        "net_revenue_base": round(totals_base_nr, 2),
        "net_revenue_compare": round(totals_cmp_nr, 2),
        "net_revenue_delta": round(totals_cmp_nr - totals_base_nr, 2),
        "net_revenue_delta_pct": _pct_delta(totals_base_nr, totals_cmp_nr),
        "gross_margin_base": round(totals_base_gm, 2),
        "gross_margin_compare": round(totals_cmp_gm, 2),
        "gross_margin_delta": round(totals_cmp_gm - totals_base_gm, 2),
    }
    return result, summary
