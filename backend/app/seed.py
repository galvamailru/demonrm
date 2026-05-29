from sqlalchemy.orm import Session

from app.models import NrmCycle, SourceDataRow


def seed_demo_data(db: Session) -> None:
    if db.query(NrmCycle).count() > 0:
        return

    cycle = NrmCycle(
        name="Q2 2026 — Modern Trade",
        description="Демо-цикл Net Revenue Management для канала modern trade",
    )
    db.add(cycle)
    db.flush()

    demo_rows = [
        ("SKU-001", "Молоко 3.2% 1л", "Dairy", "modern_trade", 89.9, 5, 10, 2, 3.5, 52.0, 12000),
        ("SKU-002", "Йогурт клубника 125г", "Dairy", "modern_trade", 45.5, 3, 15, 0, 2.0, 28.0, 25000),
        ("SKU-003", "Сок яблоко 1л", "Beverages", "e_com", 119.0, 8, 5, 3, 5.0, 71.0, 8000),
        ("SKU-004", "Печенье овсяное 300г", "Snacks", "horeca", 65.0, 0, 0, 5, 1.5, 38.0, 15000),
        ("SKU-005", "Вода 0.5л x6", "Beverages", "modern_trade", 199.0, 10, 8, 2, 4.0, 95.0, 18000),
    ]

    for i, row in enumerate(demo_rows):
        db.add(
            SourceDataRow(
                cycle_id=cycle.id,
                row_order=i,
                sku=row[0],
                product_name=row[1],
                category=row[2],
                channel=row[3],
                list_price=row[4],
                contract_discount_pct=row[5],
                promo_discount_pct=row[6],
                off_invoice_pct=row[7],
                trade_spend_per_unit=row[8],
                unit_cost=row[9],
                planned_volume=row[10],
            )
        )

    db.commit()
