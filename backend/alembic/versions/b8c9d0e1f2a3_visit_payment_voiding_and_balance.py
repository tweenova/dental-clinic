"""add visit payment voiding, balance fields, and default payments enabled

Revision ID: b8c9d0e1f2a3
Revises: a8b9c0d1e2f3
Create Date: 2026-10-13 15:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'b8c9d0e1f2a3'
down_revision: Union[str, None] = 'a8b9c0d1e2f3'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Add voiding and charge tracking columns to visit_payments
    with op.batch_alter_table('visit_payments', schema=None) as batch_op:
        batch_op.add_column(
            sa.Column('amount_charged_cents', sa.Integer(), nullable=False, server_default='0')
        )
        batch_op.add_column(
            sa.Column('is_voided', sa.Boolean(), nullable=False, server_default=sa.false())
        )
        batch_op.add_column(
            sa.Column('void_reason', sa.Text(), nullable=True)
        )
        batch_op.add_column(
            sa.Column('voided_at', sa.DateTime(timezone=True), nullable=True)
        )
        batch_op.add_column(
            sa.Column('voided_by_user_id', sa.Uuid(), nullable=True)
        )
        batch_op.create_foreign_key(
            'fk_visit_payments_voided_by_user',
            'users',
            ['voided_by_user_id'],
            ['id'],
            ondelete='SET NULL'
        )

    # Backfill amount_charged_cents = amount_cents for pre-existing records
    op.execute("UPDATE visit_payments SET amount_charged_cents = amount_cents WHERE amount_charged_cents = 0")

    # 2. Update clinic_booking_settings payments_enabled default to true
    with op.batch_alter_table('clinic_booking_settings', schema=None) as batch_op:
        batch_op.alter_column('payments_enabled', server_default=sa.true())

    op.execute("UPDATE clinic_booking_settings SET payments_enabled = true WHERE payments_enabled = false")


def downgrade() -> None:
    # 1. Revert default in clinic_booking_settings to false
    with op.batch_alter_table('clinic_booking_settings', schema=None) as batch_op:
        batch_op.alter_column('payments_enabled', server_default=sa.false())

    # 2. Drop columns from visit_payments
    with op.batch_alter_table('visit_payments', schema=None) as batch_op:
        try:
            batch_op.drop_constraint('fk_visit_payments_voided_by_user', type_='foreignkey')
        except Exception:
            pass
        batch_op.drop_column('voided_by_user_id')
        batch_op.drop_column('voided_at')
        batch_op.drop_column('void_reason')
        batch_op.drop_column('is_voided')
        batch_op.drop_column('amount_charged_cents')
