"""migrate messages sent to logged

Revision ID: f2a3b4c5d6e7
Revises: e1f2a3b4c5d6
Create Date: 2026-10-11 21:10:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'f2a3b4c5d6e7'
down_revision: Union[str, None] = 'e1f2a3b4c5d6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Migrate existing messages with status 'sent' to 'logged'
    op.execute("UPDATE messages SET status = 'logged' WHERE status = 'sent'")


def downgrade() -> None:
    # Revert 'logged' back to 'sent'
    op.execute("UPDATE messages SET status = 'sent' WHERE status = 'logged'")
