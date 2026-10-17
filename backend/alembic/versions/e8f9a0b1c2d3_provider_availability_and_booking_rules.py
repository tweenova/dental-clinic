"""provider_availability_and_booking_rules

Revision ID: e8f9a0b1c2d3
Revises: d7e8f9a0b1c2
Create Date: 2026-10-12 11:45:00.000000+00:00

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "e8f9a0b1c2d3"
down_revision: Union[str, None] = "d7e8f9a0b1c2"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. provider_availability
    op.create_table(
        "provider_availability",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("team_member_id", sa.Uuid(), sa.ForeignKey("team_members.id", ondelete="CASCADE"), nullable=False),
        sa.Column("day_of_week", sa.Integer(), nullable=False),  # 0=Monday, ..., 6=Sunday
        sa.Column("start_time", sa.String(length=10), nullable=False),
        sa.Column("end_time", sa.String(length=10), nullable=False),
        sa.Column("break_start_time", sa.String(length=10), nullable=True),
        sa.Column("break_end_time", sa.String(length=10), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )
    op.create_index("ix_provider_availability_team_member_id", "provider_availability", ["team_member_id"])
    op.create_index("ix_provider_availability_tm_day", "provider_availability", ["team_member_id", "day_of_week"])

    # 2. provider_time_off
    op.create_table(
        "provider_time_off",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("team_member_id", sa.Uuid(), sa.ForeignKey("team_members.id", ondelete="CASCADE"), nullable=False),
        sa.Column("start_date", sa.Date(), nullable=False),
        sa.Column("end_date", sa.Date(), nullable=False),
        sa.Column("reason", sa.String(length=255), nullable=False),
        sa.Column("is_approved", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )
    op.create_index("ix_provider_time_off_team_member", "provider_time_off", ["team_member_id"])
    op.create_index("ix_provider_time_off_dates", "provider_time_off", ["start_date", "end_date"])

    # 3. service_providers
    op.create_table(
        "service_providers",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("service_id", sa.Uuid(), sa.ForeignKey("services.id", ondelete="CASCADE"), nullable=False),
        sa.Column("team_member_id", sa.Uuid(), sa.ForeignKey("team_members.id", ondelete="CASCADE"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.UniqueConstraint("service_id", "team_member_id", name="uq_service_providers_service_team_member"),
    )
    op.create_index("ix_service_providers_service_id", "service_providers", ["service_id"])
    op.create_index("ix_service_providers_team_member_id", "service_providers", ["team_member_id"])

    # 4. services columns: bookable_online and buffer_minutes
    op.add_column(
        "services",
        sa.Column("bookable_online", sa.Boolean(), nullable=False, server_default=sa.true()),
    )
    op.add_column(
        "services",
        sa.Column("buffer_minutes", sa.Integer(), nullable=False, server_default="0"),
    )

    # 5. clinic_booking_settings: min_lead_time_hours and default slot_interval_minutes 15
    op.add_column(
        "clinic_booking_settings",
        sa.Column("min_lead_time_hours", sa.Integer(), nullable=False, server_default="2"),
    )
    op.alter_column(
        "clinic_booking_settings",
        "slot_interval_minutes",
        server_default="15",
    )
    op.execute("UPDATE clinic_booking_settings SET slot_interval_minutes = 15 WHERE slot_interval_minutes = 30")


def downgrade() -> None:
    op.alter_column(
        "clinic_booking_settings",
        "slot_interval_minutes",
        server_default="30",
    )
    op.drop_column("clinic_booking_settings", "min_lead_time_hours")

    op.drop_column("services", "buffer_minutes")
    op.drop_column("services", "bookable_online")

    op.drop_index("ix_service_providers_team_member_id", table_name="service_providers")
    op.drop_index("ix_service_providers_service_id", table_name="service_providers")
    op.drop_table("service_providers")

    op.drop_index("ix_provider_time_off_dates", table_name="provider_time_off")
    op.drop_index("ix_provider_time_off_team_member", table_name="provider_time_off")
    op.drop_table("provider_time_off")

    op.drop_index("ix_provider_availability_tm_day", table_name="provider_availability")
    op.drop_index("ix_provider_availability_team_member_id", table_name="provider_availability")
    op.drop_table("provider_availability")
