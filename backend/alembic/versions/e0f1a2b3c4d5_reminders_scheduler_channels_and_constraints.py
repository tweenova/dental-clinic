"""reminders scheduler channels and constraints

Revision ID: e0f1a2b3c4d5
Revises: c9d0e1f2a3b4
Create Date: 2026-10-13 20:10:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'e0f1a2b3c4d5'
down_revision: Union[str, None] = 'c9d0e1f2a3b4'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. messages columns
    op.add_column(
        'messages',
        sa.Column('provider', sa.String(length=32), server_default='simulated', nullable=False),
    )
    op.add_column(
        'messages',
        sa.Column('provider_message_id', sa.String(length=128), nullable=True),
    )
    op.add_column(
        'messages',
        sa.Column('attempts', sa.Integer(), server_default='0', nullable=False),
    )
    op.add_column(
        'messages',
        sa.Column('scheduled_for', sa.DateTime(timezone=True), nullable=True),
    )
    op.add_column(
        'messages',
        sa.Column('sent_at', sa.DateTime(timezone=True), nullable=True),
    )
    op.add_column(
        'messages',
        sa.Column('reminder_type', sa.String(length=32), nullable=True),
    )

    # Unique constraint on (booking_id, reminder_type) where not null and not cancelled
    op.create_index(
        'uq_messages_booking_reminder_type',
        'messages',
        ['booking_id', 'reminder_type'],
        unique=True,
        postgresql_where=sa.text("booking_id IS NOT NULL AND reminder_type IS NOT NULL AND delivery_status != 'cancelled'"),
    )
    op.create_index(
        'ix_messages_scheduled_for_delivery_status',
        'messages',
        ['scheduled_for', 'delivery_status'],
    )

    # 2. patients preferred_channel
    op.add_column(
        'patients',
        sa.Column('preferred_channel', sa.String(length=16), server_default='sms', nullable=False),
    )

    # 3. clinic_booking_settings reminder switches & Urdu template
    op.add_column(
        'clinic_booking_settings',
        sa.Column('reminder_24h_enabled', sa.Boolean(), server_default=sa.text('true'), nullable=False),
    )
    op.add_column(
        'clinic_booking_settings',
        sa.Column('reminder_2h_enabled', sa.Boolean(), server_default=sa.text('true'), nullable=False),
    )
    op.add_column(
        'clinic_booking_settings',
        sa.Column('reminder_template_urdu', sa.Text(), nullable=True),
    )


def downgrade() -> None:
    op.drop_column('clinic_booking_settings', 'reminder_template_urdu')
    op.drop_column('clinic_booking_settings', 'reminder_2h_enabled')
    op.drop_column('clinic_booking_settings', 'reminder_24h_enabled')

    op.drop_column('patients', 'preferred_channel')

    op.drop_index('ix_messages_scheduled_for_delivery_status', table_name='messages')
    op.drop_index('uq_messages_booking_reminder_type', table_name='messages')

    op.drop_column('messages', 'reminder_type')
    op.drop_column('messages', 'sent_at')
    op.drop_column('messages', 'scheduled_for')
    op.drop_column('messages', 'attempts')
    op.drop_column('messages', 'provider_message_id')
    op.drop_column('messages', 'provider')
