"""add visit payments table and payments enabled setting

Revision ID: a8b9c0d1e2f3
Revises: a6b7c8d9e0f1
Create Date: 2026-10-13 14:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'a8b9c0d1e2f3'
down_revision: Union[str, None] = 'a6b7c8d9e0f1'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Add payments_enabled to clinic_booking_settings
    with op.batch_alter_table('clinic_booking_settings', schema=None) as batch_op:
        batch_op.add_column(
            sa.Column('payments_enabled', sa.Boolean(), nullable=False, server_default=sa.false())
        )

    # 2. Create visit_payments table
    op.create_table(
        'visit_payments',
        sa.Column('id', sa.Uuid(), nullable=False),
        sa.Column('clinic_id', sa.Uuid(), nullable=True),
        sa.Column('booking_id', sa.Uuid(), nullable=True),
        sa.Column('patient_id', sa.Uuid(), nullable=True),
        sa.Column('amount_cents', sa.Integer(), nullable=False),
        sa.Column('currency', sa.String(length=3), nullable=False, server_default='PKR'),
        sa.Column('method', sa.String(length=32), nullable=False, server_default='cash'),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('recorded_by_user_id', sa.Uuid(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(['booking_id'], ['bookings.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['clinic_id'], ['clinics.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['patient_id'], ['patients.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['recorded_by_user_id'], ['users.id'], ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id'),
    )
    with op.batch_alter_table('visit_payments', schema=None) as batch_op:
        batch_op.create_index(batch_op.f('ix_visit_payments_booking_id'), ['booking_id'], unique=False)
        batch_op.create_index(batch_op.f('ix_visit_payments_clinic_id'), ['clinic_id'], unique=False)
        batch_op.create_index(batch_op.f('ix_visit_payments_patient_id'), ['patient_id'], unique=False)
        batch_op.create_index(batch_op.f('ix_visit_payments_recorded_by_user_id'), ['recorded_by_user_id'], unique=False)


def downgrade() -> None:
    # 1. Drop visit_payments table
    op.drop_table('visit_payments')

    # 2. Drop payments_enabled column from clinic_booking_settings
    with op.batch_alter_table('clinic_booking_settings', schema=None) as batch_op:
        batch_op.drop_column('payments_enabled')
