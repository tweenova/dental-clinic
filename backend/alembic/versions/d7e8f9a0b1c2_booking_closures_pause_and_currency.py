"""booking_closures_pause_and_currency

Revision ID: d7e8f9a0b1c2
Revises: c3d4e5f6a7b8
Create Date: 2026-10-12 10:30:00.000000+00:00

"""
from typing import Sequence, Union
from uuid import uuid4

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "d7e8f9a0b1c2"
down_revision: Union[str, None] = "c3d4e5f6a7b8"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. clinic_working_hours
    op.create_table(
        "clinic_working_hours",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("clinic_id", sa.Uuid(), sa.ForeignKey("clinics.id", ondelete="CASCADE"), nullable=True),
        sa.Column("day_of_week", sa.Integer(), nullable=False),  # 0=Monday, ..., 6=Sunday
        sa.Column("open_time", sa.String(length=10), nullable=True),
        sa.Column("close_time", sa.String(length=10), nullable=True),
        sa.Column("is_closed", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )
    op.create_index("ix_clinic_working_hours_clinic_id", "clinic_working_hours", ["clinic_id"])
    op.create_index("ix_clinic_working_hours_day", "clinic_working_hours", ["day_of_week"])

    # 2. clinic_booking_settings
    op.create_table(
        "clinic_booking_settings",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("clinic_id", sa.Uuid(), sa.ForeignKey("clinics.id", ondelete="CASCADE"), nullable=True),
        sa.Column("booking_mode", sa.String(length=20), nullable=False, server_default="open"),  # open | paused | closed
        sa.Column("pause_message", sa.Text(), nullable=True),
        sa.Column("pause_started_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("pause_started_by_user_id", sa.Uuid(), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("resume_on", sa.Date(), nullable=True),
        sa.Column("advance_booking_days", sa.Integer(), nullable=False, server_default="60"),
        sa.Column("slot_interval_minutes", sa.Integer(), nullable=False, server_default="30"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )
    op.create_index("ix_clinic_booking_settings_clinic_id", "clinic_booking_settings", ["clinic_id"])

    # 3. clinic_closures
    op.create_table(
        "clinic_closures",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("clinic_id", sa.Uuid(), sa.ForeignKey("clinics.id", ondelete="CASCADE"), nullable=True),
        sa.Column("start_date", sa.Date(), nullable=False),
        sa.Column("end_date", sa.Date(), nullable=False),
        sa.Column("reason", sa.String(length=255), nullable=False),
        sa.Column("message", sa.Text(), nullable=True),
        sa.Column("created_by_user_id", sa.Uuid(), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )
    op.create_index("ix_clinic_closures_dates", "clinic_closures", ["start_date", "end_date"])

    # 4. announcements auto banner support
    op.add_column(
        "announcements",
        sa.Column("is_auto_booking_banner", sa.Boolean(), nullable=False, server_default=sa.false()),
    )

    # 5. organization currency and locale settings
    op.add_column(
        "organizations",
        sa.Column("currency_code", sa.String(length=10), nullable=False, server_default="PKR"),
    )
    op.add_column(
        "organizations",
        sa.Column("currency_symbol", sa.String(length=10), nullable=False, server_default="Rs"),
    )
    op.add_column(
        "organizations",
        sa.Column("timezone", sa.String(length=50), nullable=False, server_default="Asia/Karachi"),
    )

    # 6. Seed initial weekly working hours (Sunday closed) and default booking settings
    working_hours_table = sa.table(
        "clinic_working_hours",
        sa.column("id", sa.Uuid()),
        sa.column("day_of_week", sa.Integer()),
        sa.column("open_time", sa.String()),
        sa.column("close_time", sa.String()),
        sa.column("is_closed", sa.Boolean()),
    )

    op.bulk_insert(
        working_hours_table,
        [
            {"id": uuid4(), "day_of_week": 0, "open_time": "08:00", "close_time": "18:00", "is_closed": False},
            {"id": uuid4(), "day_of_week": 1, "open_time": "08:00", "close_time": "18:00", "is_closed": False},
            {"id": uuid4(), "day_of_week": 2, "open_time": "08:00", "close_time": "18:00", "is_closed": False},
            {"id": uuid4(), "day_of_week": 3, "open_time": "08:00", "close_time": "18:00", "is_closed": False},
            {"id": uuid4(), "day_of_week": 4, "open_time": "08:00", "close_time": "14:00", "is_closed": False},
            {"id": uuid4(), "day_of_week": 5, "open_time": "09:00", "close_time": "13:00", "is_closed": False},
            {"id": uuid4(), "day_of_week": 6, "open_time": None, "close_time": None, "is_closed": True},  # Sunday closed
        ],
    )

    settings_table = sa.table(
        "clinic_booking_settings",
        sa.column("id", sa.Uuid()),
        sa.column("booking_mode", sa.String()),
        sa.column("advance_booking_days", sa.Integer()),
        sa.column("slot_interval_minutes", sa.Integer()),
    )
    op.bulk_insert(
        settings_table,
        [
            {
                "id": uuid4(),
                "booking_mode": "open",
                "advance_booking_days": 60,
                "slot_interval_minutes": 30,
            }
        ],
    )


def downgrade() -> None:
    op.drop_column("organizations", "timezone")
    op.drop_column("organizations", "currency_symbol")
    op.drop_column("organizations", "currency_code")
    op.drop_column("announcements", "is_auto_booking_banner")

    op.drop_index("ix_clinic_closures_dates", table_name="clinic_closures")
    op.drop_table("clinic_closures")

    op.drop_index("ix_clinic_booking_settings_clinic_id", table_name="clinic_booking_settings")
    op.drop_table("clinic_booking_settings")

    op.drop_index("ix_clinic_working_hours_day", table_name="clinic_working_hours")
    op.drop_index("ix_clinic_working_hours_clinic_id", table_name="clinic_working_hours")
    op.drop_table("clinic_working_hours")
