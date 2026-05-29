from app.models import SourceDataRow, VolumeTier


def tiers_for_row(row: SourceDataRow) -> list[dict[str, float]]:
    if not row.volume_tier_rows:
        return []
    return [
        {"min_volume": float(t.min_volume), "discount_pct": float(t.discount_pct)}
        for t in sorted(row.volume_tier_rows, key=lambda x: (x.tier_order, x.id))
    ]
