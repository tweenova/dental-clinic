"""link tasks and messages to patients

Revision ID: e1f2a3b4c5d6
Revises: d9e01f23a456
Create Date: 2026-10-11 20:15:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'e1f2a3b4c5d6'
down_revision: Union[str, None] = 'd9e01f23a456'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Add patient_id and booking_id to tasks
    op.add_column('tasks', sa.Column('patient_id', sa.Uuid(as_uuid=True), sa.ForeignKey('patients.id', ondelete='SET NULL'), nullable=True))
    op.add_column('tasks', sa.Column('booking_id', sa.Uuid(as_uuid=True), sa.ForeignKey('bookings.id', ondelete='SET NULL'), nullable=True))
    op.create_index('ix_tasks_patient_id', 'tasks', ['patient_id'])
    op.create_index('ix_tasks_booking_id', 'tasks', ['booking_id'])

    # 2. Add patient_id to messages
    op.add_column('messages', sa.Column('patient_id', sa.Uuid(as_uuid=True), sa.ForeignKey('patients.id', ondelete='SET NULL'), nullable=True))
    op.create_index('ix_messages_patient_id', 'messages', ['patient_id'])


def downgrade() -> None:
    op.drop_index('ix_messages_patient_id', table_name='messages')
    op.drop_column('messages', 'patient_id')
    op.drop_index('ix_tasks_booking_id', table_name='tasks')
    op.drop_index('ix_tasks_patient_id', table_name='tasks')
    op.drop_column('tasks', 'booking_id')
    op.drop_column('tasks', 'patient_id')
