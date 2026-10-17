"""add booking lifecycle timestamps and cancellation details

Revision ID: a1b2c3d4e5f6
Revises: f2a3b4c5d6e7
Create Date: 2026-10-11 21:30:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'a1b2c3d4e5f6'
down_revision: Union[str, None] = 'f2a3b4c5d6e7'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('bookings', sa.Column('arrived_at', sa.DateTime(timezone=True), nullable=True))
    op.add_column('bookings', sa.Column('started_at', sa.DateTime(timezone=True), nullable=True))
    op.add_column('bookings', sa.Column('completed_at', sa.DateTime(timezone=True), nullable=True))
    op.add_column('bookings', sa.Column('cancellation_reason', sa.Text(), nullable=True))
    op.add_column(
        'bookings',
        sa.Column(
            'cancelled_by_user_id',
            sa.Uuid(as_uuid=True),
            sa.ForeignKey('users.id', ondelete='SET NULL'),
            nullable=True,
        ),
    )


def downgrade() -> None:
    op.drop_column('bookings', 'cancelled_by_user_id')
    op.drop_column('bookings', 'cancellation_reason')
    op.drop_column('bookings', 'completed_at')
    op.drop_column('bookings', 'started_at')
    op.drop_column('bookings', 'arrived_at')
