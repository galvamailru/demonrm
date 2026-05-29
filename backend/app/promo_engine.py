from dataclasses import dataclass
from datetime import date

from app.models import PromoRule, PromoScopeType, SourceDataRow


@dataclass
class AppliedPromo:
    rule_id: int | None
    name: str
    discount_pct: float
    stackable: bool
    priority: int


def _in_date_range(
    pricing_date: date, valid_from: date | None, valid_to: date | None
) -> bool:
    if valid_from and pricing_date < valid_from:
        return False
    if valid_to and pricing_date > valid_to:
        return False
    return True


def _matches_scope(rule: PromoRule, row: SourceDataRow) -> bool:
    if rule.scope_type == PromoScopeType.ALL:
        return True
    if rule.scope_type == PromoScopeType.SKU:
        return rule.scope_value.lower() == row.sku.lower()
    if rule.scope_type == PromoScopeType.CATEGORY:
        return rule.scope_value.lower() == (row.category or "").lower()
    if rule.scope_type == PromoScopeType.CHANNEL:
        return rule.scope_value.lower() == (row.channel or "").lower()
    if rule.scope_type == PromoScopeType.CUSTOMER:
        return rule.scope_value.lower() == (row.customer_code or "").lower()
    return False


def resolve_promo_discounts(
    row: SourceDataRow,
    rules: list[PromoRule],
    pricing_date: date,
) -> tuple[float, list[AppliedPromo]]:
    """
    Возвращает суммарный % промо-скидки (для мультипликативного применения)
    и список применённых правил.
    """
    applicable = [
        r
        for r in rules
        if _in_date_range(pricing_date, r.valid_from, r.valid_to)
        and _matches_scope(r, row)
    ]
    applicable.sort(key=lambda r: r.priority)

    applied: list[AppliedPromo] = []
    if row.promo_discount_pct and row.promo_discount_pct > 0:
        applied.append(
            AppliedPromo(
                rule_id=None,
                name="Row promo",
                discount_pct=float(row.promo_discount_pct),
                stackable=True,
                priority=999,
            )
        )

    non_stackable = [r for r in applicable if not r.stackable]
    stackable = [r for r in applicable if r.stackable]

    if non_stackable:
        best = min(non_stackable, key=lambda r: r.priority)
        applied.append(
            AppliedPromo(
                rule_id=best.id,
                name=best.name,
                discount_pct=float(best.discount_pct),
                stackable=False,
                priority=best.priority,
            )
        )
        combined_factor = 1.0 - _pct(best.discount_pct)
        for sp in applied:
            if sp.rule_id is None:
                combined_factor *= 1.0 - _pct(sp.discount_pct)
        total_pct = (1.0 - combined_factor) * 100.0
        return total_pct, applied

    for rule in stackable:
        applied.append(
            AppliedPromo(
                rule_id=rule.id,
                name=rule.name,
                discount_pct=float(rule.discount_pct),
                stackable=True,
                priority=rule.priority,
            )
        )

    combined_factor = 1.0
    for item in applied:
        combined_factor *= 1.0 - _pct(item.discount_pct)
    total_pct = (1.0 - combined_factor) * 100.0
    return total_pct, applied


def _pct(value: float) -> float:
    return max(0.0, min(float(value), 100.0)) / 100.0
