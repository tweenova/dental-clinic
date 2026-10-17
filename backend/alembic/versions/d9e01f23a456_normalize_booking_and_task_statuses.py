"""normalize booking and task statuses

Revision ID: d9e01f23a456
Revises: c8f31d20ab47
Create Date: 2026-10-11 19:15:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'd9e01f23a456'
down_revision: Union[str, None] = 'c8f31d20ab47'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Normalize bookings legacy status aliases to canonical values
    op.execute("UPDATE bookings SET status = 'confirmed' WHERE status = 'scheduled'")
    op.execute("UPDATE bookings SET status = 'arrived' WHERE status IN ('checked_in', 'waiting')")

    # 2. Normalize tasks legacy status alias
    op.execute("UPDATE tasks SET status = 'pending' WHERE status = 'open'")


def downgrade() -> None:
    # Reversible mapping back to legacy default aliases
    op.execute("UPDATE bookings SET status = 'scheduled' WHERE status = 'confirmed'")
    op.execute("UPDATE tasks SET status = 'open' WHERE status = 'pending'")
