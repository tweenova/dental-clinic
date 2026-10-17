"""add service recall interval days

Revision ID: a6b7c8d9e0f1
Revises: a5b6c7d8e9f0
Create Date: 2026-10-13 13:25:00.000000
"""

from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'a6b7c8d9e0f1'
down_revision: Union[str, None] = 'a5b6c7d8e9f0'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        'services',
        sa.Column('recall_interval_days', sa.Integer(), nullable=True)
    )


def downgrade() -> None:
    op.drop_column('services', 'recall_interval_days')
