"""add_clinical_encounters_table

Revision ID: f3b59c2e4a11
Revises: e2a48b9c1d01
Create Date: 2026-10-09 11:30:00.000000+00:00

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "f3b59c2e4a11"
down_revision: Union[str, None] = "e2a48b9c1d01"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "clinical_encounters",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("clinic_id", sa.Uuid(), sa.ForeignKey("clinics.id", ondelete="SET NULL"), nullable=True),
        sa.Column("patient_id", sa.Uuid(), sa.ForeignKey("patients.id", ondelete="RESTRICT"), nullable=False),
        sa.Column("clinician_id", sa.Uuid(), sa.ForeignKey("team_members.id", ondelete="RESTRICT"), nullable=False),
        sa.Column("booking_id", sa.Uuid(), sa.ForeignKey("bookings.id", ondelete="SET NULL"), nullable=True),
        sa.Column("appointment_id", sa.Uuid(), sa.ForeignKey("appointments.id", ondelete="SET NULL"), nullable=True),
        sa.Column("status", sa.String(length=50), nullable=False, server_default="draft"),
        sa.Column("chief_complaint", sa.Text(), nullable=True),
        sa.Column("reason_for_visit", sa.Text(), nullable=True),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("ended_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )
    op.create_index("ix_clinical_encounters_patient_id", "clinical_encounters", ["patient_id"])
    op.create_index("ix_clinical_encounters_clinician_id", "clinical_encounters", ["clinician_id"])
    op.create_index("ix_clinical_encounters_booking_id", "clinical_encounters", ["booking_id"])
    op.create_index("ix_clinical_encounters_status", "clinical_encounters", ["status"])
    op.create_index("ix_clinical_encounters_patient_created", "clinical_encounters", ["patient_id", "created_at"])
    op.create_index("ix_clinical_encounters_clinician_status", "clinical_encounters", ["clinician_id", "status"])
    op.create_index(
        "uq_clinical_encounters_active_booking",
        "clinical_encounters",
        ["booking_id"],
        unique=True,
        postgresql_where=sa.text("status IN ('draft', 'in_progress') AND booking_id IS NOT NULL"),
    )


def downgrade() -> None:
    op.drop_index("uq_clinical_encounters_active_booking", table_name="clinical_encounters")
    op.drop_index("ix_clinical_encounters_clinician_status", table_name="clinical_encounters")
    op.drop_index("ix_clinical_encounters_patient_created", table_name="clinical_encounters")
    op.drop_index("ix_clinical_encounters_status", table_name="clinical_encounters")
    op.drop_index("ix_clinical_encounters_booking_id", table_name="clinical_encounters")
    op.drop_index("ix_clinical_encounters_clinician_id", table_name="clinical_encounters")
    op.drop_index("ix_clinical_encounters_patient_id", table_name="clinical_encounters")
    op.drop_table("clinical_encounters")

