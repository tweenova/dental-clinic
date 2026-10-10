"""add_clinical_notes_table

Revision ID: a4c78e1b9f22
Revises: f3b59c2e4a11
Create Date: 2026-10-09 11:45:00.000000+00:00

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "a4c78e1b9f22"
down_revision: Union[str, None] = "f3b59c2e4a11"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "clinical_notes",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("encounter_id", sa.Uuid(), sa.ForeignKey("clinical_encounters.id", ondelete="RESTRICT"), nullable=False),
        sa.Column("patient_id", sa.Uuid(), sa.ForeignKey("patients.id", ondelete="RESTRICT"), nullable=False),
        sa.Column("clinic_id", sa.Uuid(), sa.ForeignKey("clinics.id", ondelete="SET NULL"), nullable=True),
        sa.Column("author_id", sa.Uuid(), sa.ForeignKey("team_members.id", ondelete="RESTRICT"), nullable=False),
        sa.Column("revision_number", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("is_current", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("status", sa.String(length=50), nullable=False, server_default="draft"),
        sa.Column("subjective", sa.Text(), nullable=True),
        sa.Column("objective", sa.Text(), nullable=True),
        sa.Column("assessment", sa.Text(), nullable=True),
        sa.Column("plan", sa.Text(), nullable=True),
        sa.Column("is_signed", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("signed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("signed_by_id", sa.Uuid(), sa.ForeignKey("team_members.id", ondelete="RESTRICT"), nullable=True),
        sa.Column("amendment_reason", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )
    op.create_index("ix_clinical_notes_encounter_id", "clinical_notes", ["encounter_id"])
    op.create_index("ix_clinical_notes_patient_id", "clinical_notes", ["patient_id"])
    op.create_index("ix_clinical_notes_author_id", "clinical_notes", ["author_id"])
    op.create_index("ix_clinical_notes_clinic_id", "clinical_notes", ["clinic_id"])
    op.create_index("ix_clinical_notes_is_current", "clinical_notes", ["is_current"])
    op.create_index("ix_clinical_notes_status", "clinical_notes", ["status"])
    op.create_index(
        "ix_clinical_notes_encounter_revision",
        "clinical_notes",
        ["encounter_id", "revision_number"],
        unique=True,
    )


def downgrade() -> None:
    op.drop_index("ix_clinical_notes_encounter_revision", table_name="clinical_notes")
    op.drop_index("ix_clinical_notes_status", table_name="clinical_notes")
    op.drop_index("ix_clinical_notes_is_current", table_name="clinical_notes")
    op.drop_index("ix_clinical_notes_clinic_id", table_name="clinical_notes")
    op.drop_index("ix_clinical_notes_author_id", table_name="clinical_notes")
    op.drop_index("ix_clinical_notes_patient_id", table_name="clinical_notes")
    op.drop_index("ix_clinical_notes_encounter_id", table_name="clinical_notes")
    op.drop_table("clinical_notes")

