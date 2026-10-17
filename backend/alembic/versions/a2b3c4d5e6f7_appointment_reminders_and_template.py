"""add appointment reminders and admin reminder template

Revision ID: a2b3c4d5e6f7
Revises: f9a0b1c2d3e4
Create Date: 2026-10-13 10:15:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'a2b3c4d5e6f7'
down_revision: Union[str, None] = 'f9a0b1c2d3e4'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Add reminded_at and reminded_by_user_id to bookings table
    with op.batch_alter_table('bookings', schema=None) as batch_op:
        batch_op.add_column(
            sa.Column('reminded_at', sa.DateTime(timezone=True), nullable=True)
        )
        batch_op.add_column(
            sa.Column('reminded_by_user_id', sa.UUID(as_uuid=True), nullable=True)
        )
        try:
            batch_op.create_foreign_key(
                'fk_bookings_reminded_by_user_id',
                'users',
                ['reminded_by_user_id'],
                ['id'],
                ondelete='SET NULL'
            )
        except Exception:
            pass

    # 2. Add reminder_template to clinic_booking_settings table
    with op.batch_alter_table('clinic_booking_settings', schema=None) as batch_op:
        batch_op.add_column(
            sa.Column('reminder_template', sa.Text(), nullable=True)
        )


def downgrade() -> None:
    # 1. Remove reminder_template from clinic_booking_settings table
    with op.batch_alter_table('clinic_booking_settings', schema=None) as batch_op:
        batch_op.drop_column('reminder_template')

    # 2. Remove reminded_by_user_id and reminded_at from bookings table
    with op.batch_alter_table('bookings', schema=None) as batch_op:
        try:
            batch_op.drop_constraint('fk_bookings_reminded_by_user_id', type_='foreignkey')
        except Exception:
            pass
        batch_op.drop_column('reminded_by_user_id')
        batch_op.drop_column('reminded_at')
