import enum
from datetime import datetime

from sqlalchemy import DateTime, Enum, Float, ForeignKey, Integer, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class CycleStatus(str, enum.Enum):
    DRAFT = "draft"
    SIMULATED = "simulated"
    APPROVED = "approved"
    PUBLISHED = "published"


class NrmCycle(Base):
    __tablename__ = "nrm_cycles"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    status: Mapped[CycleStatus] = mapped_column(
        Enum(CycleStatus), default=CycleStatus.DRAFT, nullable=False
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    source_rows: Mapped[list["SourceDataRow"]] = relationship(
        back_populates="cycle", cascade="all, delete-orphan"
    )


class SourceDataRow(Base):
    """Исходные данные для расчёта NRM (редактируемые в UI)."""

    __tablename__ = "source_data_rows"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    cycle_id: Mapped[int] = mapped_column(ForeignKey("nrm_cycles.id", ondelete="CASCADE"))
    row_order: Mapped[int] = mapped_column(Integer, default=0)

    sku: Mapped[str] = mapped_column(String(64), nullable=False)
    product_name: Mapped[str] = mapped_column(String(255), nullable=False)
    category: Mapped[str] = mapped_column(String(128), default="")
    channel: Mapped[str] = mapped_column(String(128), default="modern_trade")

    list_price: Mapped[float] = mapped_column(Float, default=0.0)
    contract_discount_pct: Mapped[float] = mapped_column(Float, default=0.0)
    promo_discount_pct: Mapped[float] = mapped_column(Float, default=0.0)
    off_invoice_pct: Mapped[float] = mapped_column(Float, default=0.0)
    trade_spend_per_unit: Mapped[float] = mapped_column(Float, default=0.0)
    unit_cost: Mapped[float] = mapped_column(Float, default=0.0)
    planned_volume: Mapped[float] = mapped_column(Float, default=0.0)

    cycle: Mapped["NrmCycle"] = relationship(back_populates="source_rows")
