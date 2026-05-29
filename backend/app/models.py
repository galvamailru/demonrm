import enum
from datetime import date, datetime

from sqlalchemy import JSON, Boolean, Date, DateTime, Enum, Float, ForeignKey, Integer, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class CycleStatus(str, enum.Enum):
    DRAFT = "draft"
    SIMULATED = "simulated"
    APPROVED = "approved"
    PUBLISHED = "published"


class PromoScopeType(str, enum.Enum):
    ALL = "all"
    SKU = "sku"
    CATEGORY = "category"
    CHANNEL = "channel"
    CUSTOMER = "customer"


class Customer(Base):
    __tablename__ = "customers"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    code: Mapped[str] = mapped_column(String(64), unique=True, nullable=False)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    region: Mapped[str] = mapped_column(String(128), default="")
    active: Mapped[bool] = mapped_column(Boolean, default=True)


class Channel(Base):
    __tablename__ = "channels"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    code: Mapped[str] = mapped_column(String(64), unique=True, nullable=False)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    active: Mapped[bool] = mapped_column(Boolean, default=True)


class NrmCycle(Base):
    __tablename__ = "nrm_cycles"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    status: Mapped[CycleStatus] = mapped_column(
        Enum(CycleStatus), default=CycleStatus.DRAFT, nullable=False
    )
    pricing_date: Mapped[date] = mapped_column(Date, nullable=False, server_default=func.current_date())
    currency_code: Mapped[str] = mapped_column(String(3), default="RUB")
    filter_category: Mapped[str | None] = mapped_column(String(128), nullable=True)
    filter_channel: Mapped[str | None] = mapped_column(String(128), nullable=True)
    filter_customer_code: Mapped[str | None] = mapped_column(String(64), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    source_rows: Mapped[list["SourceDataRow"]] = relationship(
        back_populates="cycle", cascade="all, delete-orphan"
    )
    promo_rules: Mapped[list["PromoRule"]] = relationship(
        back_populates="cycle", cascade="all, delete-orphan"
    )
    snapshots: Mapped[list["CalculationSnapshot"]] = relationship(
        back_populates="cycle", cascade="all, delete-orphan"
    )


class SourceDataRow(Base):
    __tablename__ = "source_data_rows"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    cycle_id: Mapped[int] = mapped_column(ForeignKey("nrm_cycles.id", ondelete="CASCADE"))
    row_order: Mapped[int] = mapped_column(Integer, default=0)

    sku: Mapped[str] = mapped_column(String(64), nullable=False)
    product_name: Mapped[str] = mapped_column(String(255), nullable=False)
    category: Mapped[str] = mapped_column(String(128), default="")
    channel: Mapped[str] = mapped_column(String(128), default="modern_trade")
    customer_code: Mapped[str] = mapped_column(String(64), default="")

    valid_from: Mapped[date | None] = mapped_column(Date, nullable=True)
    valid_to: Mapped[date | None] = mapped_column(Date, nullable=True)

    currency_code: Mapped[str] = mapped_column(String(3), default="RUB")
    exchange_rate: Mapped[float] = mapped_column(Float, default=1.0)
    uom: Mapped[str] = mapped_column(String(16), default="EA")
    units_per_uom: Mapped[float] = mapped_column(Float, default=1.0)
    tax_rate_pct: Mapped[float] = mapped_column(Float, default=0.0)

    list_price: Mapped[float] = mapped_column(Float, default=0.0)
    contract_discount_pct: Mapped[float] = mapped_column(Float, default=0.0)
    promo_discount_pct: Mapped[float] = mapped_column(Float, default=0.0)
    off_invoice_pct: Mapped[float] = mapped_column(Float, default=0.0)
    trade_spend_per_unit: Mapped[float] = mapped_column(Float, default=0.0)
    unit_cost: Mapped[float] = mapped_column(Float, default=0.0)
    planned_volume: Mapped[float] = mapped_column(Float, default=0.0)

    cycle: Mapped["NrmCycle"] = relationship(back_populates="source_rows")
    volume_tier_rows: Mapped[list["VolumeTier"]] = relationship(
        back_populates="source_row",
        cascade="all, delete-orphan",
        order_by="VolumeTier.tier_order",
    )


class VolumeTier(Base):
    """Ступени скидки по объёму, связанные со строкой матрицы цен."""

    __tablename__ = "volume_tiers"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    source_row_id: Mapped[int] = mapped_column(
        ForeignKey("source_data_rows.id", ondelete="CASCADE"), index=True
    )
    tier_order: Mapped[int] = mapped_column(Integer, default=0)
    min_volume: Mapped[float] = mapped_column(Float, default=0.0)
    discount_pct: Mapped[float] = mapped_column(Float, default=0.0)

    source_row: Mapped["SourceDataRow"] = relationship(back_populates="volume_tier_rows")


class PromoRule(Base):
    __tablename__ = "promo_rules"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    cycle_id: Mapped[int] = mapped_column(ForeignKey("nrm_cycles.id", ondelete="CASCADE"))
    row_order: Mapped[int] = mapped_column(Integer, default=0)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    priority: Mapped[int] = mapped_column(Integer, default=10)
    stackable: Mapped[bool] = mapped_column(Boolean, default=True)
    discount_pct: Mapped[float] = mapped_column(Float, default=0.0)
    scope_type: Mapped[PromoScopeType] = mapped_column(
        Enum(PromoScopeType), default=PromoScopeType.ALL
    )
    scope_value: Mapped[str] = mapped_column(String(128), default="")
    valid_from: Mapped[date | None] = mapped_column(Date, nullable=True)
    valid_to: Mapped[date | None] = mapped_column(Date, nullable=True)

    cycle: Mapped["NrmCycle"] = relationship(back_populates="promo_rules")


class CalculationSnapshot(Base):
    __tablename__ = "calculation_snapshots"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    cycle_id: Mapped[int] = mapped_column(ForeignKey("nrm_cycles.id", ondelete="CASCADE"))
    published_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    pricing_date: Mapped[date] = mapped_column(Date, nullable=False)
    currency_code: Mapped[str] = mapped_column(String(3), default="RUB")
    filters: Mapped[dict | None] = mapped_column(JSON, default=dict)
    totals: Mapped[dict | None] = mapped_column(JSON, default=dict)
    rows: Mapped[list | None] = mapped_column(JSON, default=list)

    cycle: Mapped["NrmCycle"] = relationship(back_populates="snapshots")
