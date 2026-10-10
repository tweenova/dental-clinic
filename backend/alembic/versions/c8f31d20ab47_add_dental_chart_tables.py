"""add_dental_chart_tables

Revision ID: c8f31d20ab47
Revises: b5d89f2e7a33
Create Date: 2026-10-09 14:00:00.000000+00:00

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "c8f31d20ab47"
down_revision: Union[str, None] = "b5d89f2e7a33"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


TOOTH_VALUES = (
    "'1','2','3','4','5','6','7','8','9','10','11','12','13','14','15','16',"
    "'17','18','19','20','21','22','23','24','25','26','27','28','29','30','31','32',"
    "'A','B','C','D','E','F','G','H','I','J','K','L','M','N','O','P','Q','R','S','T'"
)


def upgrade() -> None:
    op.create_table(
        "dental_chart_findings",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("patient_id", sa.Uuid(), sa.ForeignKey("patients.id", ondelete="RESTRICT"), nullable=False),
        sa.Column("clinic_id", sa.Uuid(), sa.ForeignKey("clinics.id", ondelete="SET NULL"), nullable=True),
        sa.Column("encounter_id", sa.Uuid(), sa.ForeignKey("clinical_encounters.id", ondelete="RESTRICT"), nullable=False),
        sa.Column("author_id", sa.Uuid(), sa.ForeignKey("team_members.id", ondelete="RESTRICT"), nullable=False),
        sa.Column("tooth", sa.String(length=2), nullable=False),
        sa.Column("surfaces", sa.String(length=32), nullable=False, server_default=""),
        sa.Column("condition", sa.String(length=50), nullable=False),
        sa.Column("status", sa.String(length=20), nullable=False, server_default="active"),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("correction_reason", sa.Text(), nullable=True),
        sa.Column("corrected_by_id", sa.Uuid(), sa.ForeignKey("team_members.id", ondelete="RESTRICT"), nullable=True),
        sa.Column("corrected_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("resolved_by_id", sa.Uuid(), sa.ForeignKey("team_members.id", ondelete="RESTRICT"), nullable=True),
        sa.Column("resolved_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.CheckConstraint(
            f"tooth IN ({TOOTH_VALUES})",
            name="ck_dental_findings_tooth_valid",
        ),
        sa.CheckConstraint(
            "status IN ('active', 'resolved')",
            name="ck_dental_findings_status_valid",
        ),
        sa.CheckConstraint(
            "surfaces = '' OR surfaces NOT LIKE '% %'",
            name="ck_dental_findings_surfaces_format",
        ),
    )
    op.create_index("ix_dental_chart_findings_patient_id", "dental_chart_findings", ["patient_id"])
    op.create_index("ix_dental_chart_findings_clinic_id", "dental_chart_findings", ["clinic_id"])
    op.create_index("ix_dental_chart_findings_encounter_id", "dental_chart_findings", ["encounter_id"])
    op.create_index("ix_dental_chart_findings_author_id", "dental_chart_findings", ["author_id"])
    op.create_index("ix_dental_chart_findings_status", "dental_chart_findings", ["status"])
    op.create_index("ix_dental_findings_patient_created", "dental_chart_findings", ["patient_id", "created_at"])
    op.create_index("ix_dental_findings_patient_tooth", "dental_chart_findings", ["patient_id", "tooth"])
    op.create_index(
        "uq_dental_findings_active_duplicate",
        "dental_chart_findings",
        ["patient_id", "tooth", "condition", "surfaces"],
        unique=True,
        postgresql_where=sa.text("status = 'active'"),
        sqlite_where=sa.text("status = 'active'"),
    )

    op.create_table(
        "dental_procedures",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("patient_id", sa.Uuid(), sa.ForeignKey("patients.id", ondelete="RESTRICT"), nullable=False),
        sa.Column("clinic_id", sa.Uuid(), sa.ForeignKey("clinics.id", ondelete="SET NULL"), nullable=True),
        sa.Column("encounter_id", sa.Uuid(), sa.ForeignKey("clinical_encounters.id", ondelete="RESTRICT"), nullable=False),
        sa.Column("recorded_by_id", sa.Uuid(), sa.ForeignKey("team_members.id", ondelete="RESTRICT"), nullable=False),
        sa.Column("service_id", sa.Uuid(), sa.ForeignKey("services.id", ondelete="RESTRICT"), nullable=False),
        sa.Column("tooth", sa.String(length=2), nullable=False),
        sa.Column("surfaces", sa.String(length=32), nullable=False, server_default=""),
        sa.Column("status", sa.String(length=20), nullable=False, server_default="planned"),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("completed_by_id", sa.Uuid(), sa.ForeignKey("team_members.id", ondelete="RESTRICT"), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.CheckConstraint(
            f"tooth IN ({TOOTH_VALUES})",
            name="ck_dental_procedures_tooth_valid",
        ),
        sa.CheckConstraint(
            "status IN ('planned', 'in_progress', 'completed', 'cancelled')",
            name="ck_dental_procedures_status_valid",
        ),
        sa.CheckConstraint(
            "surfaces = '' OR surfaces NOT LIKE '% %'",
            name="ck_dental_procedures_surfaces_format",
        ),
        sa.CheckConstraint(
            "(status = 'completed') = (completed_at IS NOT NULL)",
            name="ck_dental_procedures_completion_consistency",
        ),
    )
    op.create_index("ix_dental_procedures_patient_id", "dental_procedures", ["patient_id"])
    op.create_index("ix_dental_procedures_clinic_id", "dental_procedures", ["clinic_id"])
    op.create_index("ix_dental_procedures_encounter_id", "dental_procedures", ["encounter_id"])
    op.create_index("ix_dental_procedures_recorded_by_id", "dental_procedures", ["recorded_by_id"])
    op.create_index("ix_dental_procedures_service_id", "dental_procedures", ["service_id"])
    op.create_index("ix_dental_procedures_status", "dental_procedures", ["status"])
    op.create_index("ix_dental_procedures_patient_created", "dental_procedures", ["patient_id", "created_at"])
    op.create_index("ix_dental_procedures_patient_status", "dental_procedures", ["patient_id", "status"])


def downgrade() -> None:
    op.drop_index("ix_dental_procedures_patient_status", table_name="dental_procedures")
    op.drop_index("ix_dental_procedures_patient_created", table_name="dental_procedures")
    op.drop_index("ix_dental_procedures_status", table_name="dental_procedures")
    op.drop_index("ix_dental_procedures_service_id", table_name="dental_procedures")
    op.drop_index("ix_dental_procedures_recorded_by_id", table_name="dental_procedures")
    op.drop_index("ix_dental_procedures_encounter_id", table_name="dental_procedures")
    op.drop_index("ix_dental_procedures_clinic_id", table_name="dental_procedures")
    op.drop_index("ix_dental_procedures_patient_id", table_name="dental_procedures")
    op.drop_table("dental_procedures")

    op.drop_index("uq_dental_findings_active_duplicate", table_name="dental_chart_findings")
    op.drop_index("ix_dental_findings_patient_tooth", table_name="dental_chart_findings")
    op.drop_index("ix_dental_findings_patient_created", table_name="dental_chart_findings")
    op.drop_index("ix_dental_chart_findings_status", table_name="dental_chart_findings")
    op.drop_index("ix_dental_chart_findings_author_id", table_name="dental_chart_findings")
    op.drop_index("ix_dental_chart_findings_encounter_id", table_name="dental_chart_findings")
    op.drop_index("ix_dental_chart_findings_clinic_id", table_name="dental_chart_findings")
    op.drop_index("ix_dental_chart_findings_patient_id", table_name="dental_chart_findings")
    op.drop_table("dental_chart_findings")

