"""add messaging provider quiet hours patient opt out and delivery statuses

Revision ID: c9d0e1f2a3b4
Revises: b8c9d0e1f2a3
Create Date: 2026-10-13 16:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'c9d0e1f2a3b4'
down_revision: Union[str, None] = 'b8c9d0e1f2a3'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Add messaging_opt_out to patients table
    with op.batch_alter_table('patients', schema=None) as batch_op:
        batch_op.add_column(
            sa.Column('messaging_opt_out', sa.Boolean(), nullable=False, server_default=sa.false())
        )

    # 2. Add quiet hours & provider mode to clinic_booking_settings
    with op.batch_alter_table('clinic_booking_settings', schema=None) as batch_op:
        batch_op.add_column(
            sa.Column('quiet_hours_enabled', sa.Boolean(), nullable=False, server_default=sa.true())
        )
        batch_op.add_column(
            sa.Column('quiet_hours_start', sa.String(length=5), nullable=False, server_default='21:00')
        )
        batch_op.add_column(
            sa.Column('quiet_hours_end', sa.String(length=5), nullable=False, server_default='08:00')
        )
        batch_op.add_column(
            sa.Column('messaging_provider_mode', sa.String(length=32), nullable=False, server_default='simulated')
        )

    # 3. Add booking link and delivery status to messages
    with op.batch_alter_table('messages', schema=None) as batch_op:
        batch_op.add_column(
            sa.Column('booking_id', sa.Uuid(), nullable=True)
        )
        batch_op.add_column(
            sa.Column('delivery_status', sa.String(length=50), nullable=False, server_default='simulated')
        )
        batch_op.add_column(
            sa.Column('error_detail', sa.Text(), nullable=True)
        )
        batch_op.create_foreign_key(
            'fk_messages_booking_id',
            'bookings',
            ['booking_id'],
            ['id'],
            ondelete='SET NULL'
        )
        batch_op.create_index(
            'ix_messages_booking_id',
            ['booking_id'],
            unique=False
        )


def downgrade() -> None:
    # 1. Revert messages table additions
    with op.batch_alter_table('messages', schema=None) as batch_op:
        try:
            batch_op.drop_index('ix_messages_booking_id')
        except Exception:
            pass
        try:
            batch_op.drop_constraint('fk_messages_booking_id', type_='foreignkey')
        except Exception:
            pass
        batch_op.drop_column('error_detail')
        batch_op.drop_column('delivery_status')
        batch_op.drop_column('booking_id')

    # 2. Revert clinic_booking_settings additions
    with op.batch_alter_table('clinic_booking_settings', schema=None) as batch_op:
        batch_op.drop_column('messaging_provider_mode')
        batch_op.drop_column('quiet_hours_end')
        batch_op.drop_column('quiet_hours_start')
        batch_op.drop_column('quiet_hours_enabled')

    # 3. Revert patients addition
    with op.batch_alter_table('patients', schema=None) as batch_op:
        batch_op.drop_column('messaging_opt_out')
