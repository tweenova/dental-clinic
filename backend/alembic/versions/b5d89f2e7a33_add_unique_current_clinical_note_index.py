"""add_unique_current_clinical_note_index

Revision ID: b5d89f2e7a33
Revises: a4c78e1b9f22
Create Date: 2026-10-09 12:00:00.000000+00:00

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "b5d89f2e7a33"
down_revision: Union[str, None] = "a4c78e1b9f22"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_index(
        "uq_clinical_notes_current_per_encounter",
        "clinical_notes",
        ["encounter_id"],
        unique=True,
        postgresql_where=sa.text("is_current = true"),
    )


def downgrade() -> None:
    op.drop_index("uq_clinical_notes_current_per_encounter", table_name="clinical_notes")

