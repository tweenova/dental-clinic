"""add patient file number guardian and emergency contacts

Revision ID: a5b6c7d8e9f0
Revises: a3b4c5d6e7f8
Create Date: 2026-10-13 11:30:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'a5b6c7d8e9f0'
down_revision: Union[str, None] = 'a3b4c5d6e7f8'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Add file_number_prefix to clinic_booking_settings
    with op.batch_alter_table('clinic_booking_settings', schema=None) as batch_op:
        batch_op.add_column(
            sa.Column('file_number_prefix', sa.String(length=20), nullable=False, server_default='MD-')
        )

    # 2. Add file_number, guardian, and emergency contact fields to patients
    with op.batch_alter_table('patients', schema=None) as batch_op:
        batch_op.add_column(
            sa.Column('file_number', sa.String(length=50), nullable=True)
        )
        batch_op.add_column(
            sa.Column('guardian_name', sa.String(length=150), nullable=True)
        )
        batch_op.add_column(
            sa.Column('guardian_phone', sa.String(length=50), nullable=True)
        )
        batch_op.add_column(
            sa.Column('guardian_relationship', sa.String(length=50), nullable=True)
        )
        batch_op.add_column(
            sa.Column('emergency_contact_name', sa.String(length=150), nullable=True)
        )
        batch_op.add_column(
            sa.Column('emergency_contact_phone', sa.String(length=50), nullable=True)
        )
        batch_op.add_column(
            sa.Column('emergency_contact_relationship', sa.String(length=50), nullable=True)
        )
        batch_op.create_index('ix_patients_file_number', ['file_number'], unique=True)

    # 3. Data migration: backfill sequential file numbers for existing patients without file_number
    bind = op.get_bind()
    patients_table = sa.table(
        'patients',
        sa.column('id', sa.Uuid()),
        sa.column('created_at', sa.DateTime()),
        sa.column('file_number', sa.String())
    )
    select_stmt = sa.select(patients_table.c.id).where(
        patients_table.c.file_number.is_(None)
    ).order_by(patients_table.c.created_at.asc(), patients_table.c.id.asc())
    
    rows = bind.execute(select_stmt).fetchall()
    for idx, row in enumerate(rows, start=1):
        fn = f"MD-{idx:04d}"
        update_stmt = (
            sa.update(patients_table)
            .where(patients_table.c.id == row[0])
            .values(file_number=fn)
        )
        bind.execute(update_stmt)


def downgrade() -> None:
    # 1. Drop index and columns from patients
    with op.batch_alter_table('patients', schema=None) as batch_op:
        batch_op.drop_index('ix_patients_file_number')
        batch_op.drop_column('emergency_contact_relationship')
        batch_op.drop_column('emergency_contact_phone')
        batch_op.drop_column('emergency_contact_name')
        batch_op.drop_column('guardian_relationship')
        batch_op.drop_column('guardian_phone')
        batch_op.drop_column('guardian_name')
        batch_op.drop_column('file_number')

    # 2. Drop file_number_prefix from clinic_booking_settings
    with op.batch_alter_table('clinic_booking_settings', schema=None) as batch_op:
        batch_op.drop_column('file_number_prefix')
