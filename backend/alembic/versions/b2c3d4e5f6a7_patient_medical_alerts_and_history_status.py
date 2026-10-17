"""add patient medical alerts table and medical history status

Revision ID: b2c3d4e5f6a7
Revises: a1b2c3d4e5f6
Create Date: 2026-10-11 22:50:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'b2c3d4e5f6a7'
down_revision: Union[str, None] = 'a1b2c3d4e5f6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Add medical_history_status to patients table
    op.add_column(
        'patients',
        sa.Column(
            'medical_history_status',
            sa.String(length=50),
            nullable=False,
            server_default='not_asked',
        ),
    )

    # 2. Create patient_medical_alerts table
    op.create_table(
        'patient_medical_alerts',
        sa.Column('id', sa.Uuid(as_uuid=True), primary_key=True),
        sa.Column(
            'patient_id',
            sa.Uuid(as_uuid=True),
            sa.ForeignKey('patients.id', ondelete='CASCADE'),
            nullable=False,
            index=True,
        ),
        sa.Column('type', sa.String(length=50), nullable=False),
        sa.Column('description', sa.Text(), nullable=False),
        sa.Column('severity', sa.String(length=50), nullable=True),
        sa.Column(
            'recorded_by_user_id',
            sa.Uuid(as_uuid=True),
            sa.ForeignKey('users.id', ondelete='SET NULL'),
            nullable=True,
        ),
        sa.Column('recorded_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column('last_reviewed_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default=sa.text('true')),
        sa.Column('is_confirmed', sa.Boolean(), nullable=False, server_default=sa.text('true')),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )


def downgrade() -> None:
    op.drop_table('patient_medical_alerts')
    op.drop_column('patients', 'medical_history_status')
