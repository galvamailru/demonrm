from datetime import date

from sqlalchemy.orm import Session

from app.models import (
    Channel,
    Customer,
    NrmCycle,
    PromoRule,
    PromoScopeType,
    SourceDataRow,
    VolumeTier,
)


def _add_tiers(db: Session, source_row_id: int, tiers: list[dict]) -> None:
    for order, tier in enumerate(tiers):
        db.add(
            VolumeTier(
                source_row_id=source_row_id,
                tier_order=order,
                min_volume=float(tier["min_volume"]),
                discount_pct=float(tier["discount_pct"]),
            )
        )


def ensure_master_data(db: Session) -> None:
    """Справочники клиентов и каналов для демо."""
    if db.query(Customer).count() == 0:
        for code, name, region in [
            ("CUST-AUCHAN", "Ашан", "Central"),
            ("CUST-X5", "X5 Retail", "Central"),
            ("CUST-ECOM", "E-com агрегатор", "Online"),
        ]:
            db.add(Customer(code=code, name=name, region=region))

    if db.query(Channel).count() == 0:
        for code, name in [
            ("modern_trade", "Modern Trade"),
            ("e_com", "E-commerce"),
            ("horeca", "HoReCa"),
        ]:
            db.add(Channel(code=code, name=name))

    db.flush()


def populate_cycle_demo_data(db: Session, cycle_id: int) -> dict[str, int]:
    """Матрица цен, tiers и промо-правила для нового цикла."""
    tiers_dairy = [
        {"min_volume": 0, "discount_pct": 0},
        {"min_volume": 10000, "discount_pct": 2},
        {"min_volume": 20000, "discount_pct": 4},
    ]
    tiers_yogurt = [
        {"min_volume": 0, "discount_pct": 0},
        {"min_volume": 5000, "discount_pct": 3},
    ]

    demo_rows = [
        (
            "SKU-001",
            "Молоко 3.2% 1л",
            "Dairy",
            "modern_trade",
            "CUST-AUCHAN",
            date(2026, 1, 1),
            date(2026, 12, 31),
            "RUB",
            1.0,
            "CS",
            12.0,
            20.0,
            89.9,
            5,
            5,
            2,
            3.5,
            52.0,
            1000,
            tiers_dairy,
        ),
        (
            "SKU-001",
            "Молоко 3.2% 1л",
            "Dairy",
            "modern_trade",
            "CUST-X5",
            date(2026, 1, 1),
            date(2026, 6, 30),
            "RUB",
            1.0,
            "CS",
            12.0,
            20.0,
            89.9,
            8,
            0,
            2,
            4.0,
            52.0,
            800,
            tiers_dairy,
        ),
        (
            "SKU-002",
            "Йогурт клубника 125г",
            "Dairy",
            "e_com",
            "CUST-ECOM",
            date(2026, 3, 1),
            date(2026, 9, 30),
            "RUB",
            1.0,
            "EA",
            1.0,
            20.0,
            45.5,
            3,
            10,
            0,
            2.0,
            28.0,
            25000,
            tiers_yogurt,
        ),
        (
            "SKU-003",
            "Сок яблоко 1л",
            "Beverages",
            "horeca",
            "CUST-AUCHAN",
            None,
            None,
            "USD",
            92.5,
            "EA",
            1.0,
            0.0,
            1.29,
            0,
            0,
            5,
            0.05,
            0.77,
            5000,
            [],
        ),
    ]

    source_count = 0
    tier_count = 0
    for i, row in enumerate(demo_rows):
        tiers = row[19]
        src = SourceDataRow(
            cycle_id=cycle_id,
            row_order=i,
            sku=row[0],
            product_name=row[1],
            category=row[2],
            channel=row[3],
            customer_code=row[4],
            valid_from=row[5],
            valid_to=row[6],
            currency_code=row[7],
            exchange_rate=row[8],
            uom=row[9],
            units_per_uom=row[10],
            tax_rate_pct=row[11],
            list_price=row[12],
            contract_discount_pct=row[13],
            promo_discount_pct=row[14],
            off_invoice_pct=row[15],
            trade_spend_per_unit=row[16],
            unit_cost=row[17],
            planned_volume=row[18],
        )
        db.add(src)
        db.flush()
        source_count += 1
        if tiers:
            _add_tiers(db, src.id, tiers)
            tier_count += len(tiers)

    promo_count = 0
    db.add(
        PromoRule(
            cycle_id=cycle_id,
            row_order=0,
            name="Dairy Spring",
            priority=1,
            stackable=True,
            discount_pct=5.0,
            scope_type=PromoScopeType.CATEGORY,
            scope_value="Dairy",
            valid_from=date(2026, 4, 1),
            valid_to=date(2026, 6, 30),
        )
    )
    promo_count += 1
    db.add(
        PromoRule(
            cycle_id=cycle_id,
            row_order=1,
            name="X5 Exclusive",
            priority=2,
            stackable=False,
            discount_pct=12.0,
            scope_type=PromoScopeType.CUSTOMER,
            scope_value="CUST-X5",
            valid_from=date(2026, 1, 1),
            valid_to=date(2026, 12, 31),
        )
    )
    promo_count += 1
    db.add(
        PromoRule(
            cycle_id=cycle_id,
            row_order=2,
            name="Modern Trade Boost",
            priority=5,
            stackable=True,
            discount_pct=3.0,
            scope_type=PromoScopeType.CHANNEL,
            scope_value="modern_trade",
        )
    )
    promo_count += 1

    return {
        "source_rows": source_count,
        "tiers": tier_count,
        "promos": promo_count,
    }


def seed_demo_data(db: Session) -> None:
    ensure_master_data(db)

    if db.query(NrmCycle).count() > 0:
        return

    cycle = NrmCycle(
        name="Q2 2026 — Modern Trade",
        description="Демо-цикл NRM с матрицей клиент×канал",
        pricing_date=date(2026, 4, 15),
        currency_code="RUB",
    )
    db.add(cycle)
    db.flush()
    populate_cycle_demo_data(db, cycle.id)
    db.commit()
