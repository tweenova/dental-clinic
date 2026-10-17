"""remove unused slots table

Revision ID: f9a0b1c2d3e4
Revises: e8f9a0b1c2d3
Create Date: 2026-10-13 10:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'f9a0b1c2d3e4'
down_revision: Union[str, None] = 'e8f9a0b1c2d3'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Drop FK constraint on bookings.slot_id referencing slots.id
    with op.batch_alter_table('bookings', schema=None) as batch_op:
        try:
            batch_op.drop_constraint('bookings_slot_id_fkey', type_='foreignkey')
        except Exception:
            pass

    # 2. Drop indexes on slots table
    try:
        op.drop_index(op.f('ix_slots_team_member_id'), table_name='slots')
    except Exception:
        pass
    try:
        op.drop_index(op.f('ix_slots_start_time'), table_name='slots')
    except Exception:
        pass
    try:
        op.drop_index(op.f('ix_slots_clinic_id'), table_name='slots')
    except Exception:
        pass

    # 3. Drop slots table
    op.drop_table('slots')


def downgrade() -> None:
    # 1. Re-create slots table
    op.create_table(
        'slots',
        sa.Column('id', sa.Uuid(), nullable=False),
        sa.Column('clinic_id', sa.Uuid(), nullable=True),
        sa.Column('team_member_id', sa.Uuid(), nullable=True),
        sa.Column('start_time', sa.DateTime(timezone=True), nullable=False),
        sa.Column('end_time', sa.DateTime(timezone=True), nullable=False),
        sa.Column('is_booked', sa.Boolean(), nullable=False, server_default=sa.text('false')),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default=sa.text('true')),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['clinic_id'], ['clinics.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['team_member_id'], ['team_members.id'], ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_slots_clinic_id'), 'slots', ['clinic_id'], unique=False)
    op.create_index(op.f('ix_slots_start_time'), 'slots', ['start_time'], unique=False)
    op.create_index(op.f('ix_slots_team_member_id'), 'slots', ['team_member_id'], unique=False)

    # 2. Re-create FK constraint on bookings.slot_id referencing slots.id
    with op.batch_alter_table('bookings', schema=None) as batch_op:
        batch_op.create_foreign_key('bookings_slot_id_fkey', 'slots', ['slot_id'], ['id'], ondelete='SET NULL')
