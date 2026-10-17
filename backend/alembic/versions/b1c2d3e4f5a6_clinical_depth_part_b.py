"""clinical depth part b tables and columns

Revision ID: b1c2d3e4f5a6
Revises: e0f1a2b3c4d5
Create Date: 2026-10-13 22:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'b1c2d3e4f5a6'
down_revision: Union[str, None] = 'e0f1a2b3c4d5'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Add created_by_user_id to tasks for doctor task ownership
    op.add_column(
        'tasks',
        sa.Column('created_by_user_id', sa.Uuid(), sa.ForeignKey('users.id', ondelete='SET NULL'), nullable=True),
    )
    op.create_index('ix_tasks_created_by_user_id', 'tasks', ['created_by_user_id'])

    # 2. Treatment plan items
    op.create_table(
        'treatment_plan_items',
        sa.Column('id', sa.Uuid(), primary_key=True),
        sa.Column('patient_id', sa.Uuid(), sa.ForeignKey('patients.id', ondelete='CASCADE'), nullable=False),
        sa.Column('tooth_number', sa.Integer(), nullable=True),
        sa.Column('service_id', sa.String(length=64), nullable=True),
        sa.Column('procedure_name', sa.String(length=255), nullable=False),
        sa.Column('status', sa.String(length=32), server_default='proposed', nullable=False),
        sa.Column('estimated_cost_cents', sa.Integer(), server_default='0', nullable=False),
        sa.Column('decision_date', sa.Date(), nullable=True),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('completed_procedure_id', sa.Uuid(), sa.ForeignKey('dental_procedures.id', ondelete='SET NULL'), nullable=True),
        sa.Column('created_by_user_id', sa.Uuid(), sa.ForeignKey('users.id', ondelete='RESTRICT'), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), onupdate=sa.func.now(), nullable=False),
    )
    op.create_index('ix_treatment_plan_items_patient_id', 'treatment_plan_items', ['patient_id'])
    op.create_index('ix_treatment_plan_items_tooth_number', 'treatment_plan_items', ['tooth_number'])

    # 3. Clinical note templates
    op.create_table(
        'clinical_note_templates',
        sa.Column('id', sa.Uuid(), primary_key=True),
        sa.Column('name', sa.String(length=100), unique=True, nullable=False),
        sa.Column('subjective', sa.Text(), nullable=False),
        sa.Column('objective', sa.Text(), nullable=False),
        sa.Column('assessment', sa.Text(), nullable=False),
        sa.Column('plan', sa.Text(), nullable=False),
        sa.Column('active', sa.Boolean(), server_default=sa.text('true'), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), onupdate=sa.func.now(), nullable=False),
    )
    op.create_index('ix_clinical_note_templates_name', 'clinical_note_templates', ['name'], unique=True)

    # 4. Patient attachments (private storage)
    op.create_table(
        'patient_attachments',
        sa.Column('id', sa.Uuid(), primary_key=True),
        sa.Column('patient_id', sa.Uuid(), sa.ForeignKey('patients.id', ondelete='CASCADE'), nullable=False),
        sa.Column('encounter_id', sa.Uuid(), sa.ForeignKey('clinical_encounters.id', ondelete='SET NULL'), nullable=True),
        sa.Column('category', sa.String(length=32), nullable=False),
        sa.Column('original_filename', sa.String(length=255), nullable=False),
        sa.Column('content_type', sa.String(length=100), nullable=False),
        sa.Column('size', sa.Integer(), nullable=False),
        sa.Column('stored_name', sa.String(length=255), unique=True, nullable=False),
        sa.Column('uploaded_by', sa.Uuid(), sa.ForeignKey('users.id', ondelete='RESTRICT'), nullable=False),
        sa.Column('uploaded_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('voided', sa.Boolean(), server_default=sa.text('false'), nullable=False),
        sa.Column('void_reason', sa.Text(), nullable=True),
        sa.Column('voided_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('voided_by', sa.Uuid(), sa.ForeignKey('users.id', ondelete='SET NULL'), nullable=True),
    )
    op.create_index('ix_patient_attachments_patient_id', 'patient_attachments', ['patient_id'])
    op.create_index('ix_patient_attachments_encounter_id', 'patient_attachments', ['encounter_id'])
    op.create_index('ix_patient_attachments_category', 'patient_attachments', ['category'])

    # 5. Patient consents
    op.create_table(
        'patient_consents',
        sa.Column('id', sa.Uuid(), primary_key=True),
        sa.Column('patient_id', sa.Uuid(), sa.ForeignKey('patients.id', ondelete='CASCADE'), nullable=False),
        sa.Column('encounter_id', sa.Uuid(), sa.ForeignKey('clinical_encounters.id', ondelete='SET NULL'), nullable=True),
        sa.Column('procedure_id', sa.Uuid(), sa.ForeignKey('dental_procedures.id', ondelete='SET NULL'), nullable=True),
        sa.Column('consent_type', sa.String(length=100), nullable=False),
        sa.Column('consent_text_version', sa.String(length=50), server_default='1.0', nullable=False),
        sa.Column('method', sa.String(length=32), nullable=False),
        sa.Column('signed_name', sa.String(length=255), nullable=False),
        sa.Column('attachment_id', sa.Uuid(), sa.ForeignKey('patient_attachments.id', ondelete='SET NULL'), nullable=True),
        sa.Column('obtained_by', sa.Uuid(), sa.ForeignKey('users.id', ondelete='RESTRICT'), nullable=False),
        sa.Column('recorded_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('voided', sa.Boolean(), server_default=sa.text('false'), nullable=False),
        sa.Column('void_reason', sa.Text(), nullable=True),
        sa.Column('voided_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('voided_by', sa.Uuid(), sa.ForeignKey('users.id', ondelete='SET NULL'), nullable=True),
    )
    op.create_index('ix_patient_consents_patient_id', 'patient_consents', ['patient_id'])
    op.create_index('ix_patient_consents_encounter_id', 'patient_consents', ['encounter_id'])

    # 6. Prescriptions (B5)
    op.create_table(
        'prescriptions',
        sa.Column('id', sa.Uuid(), primary_key=True),
        sa.Column('encounter_id', sa.Uuid(), sa.ForeignKey('clinical_encounters.id', ondelete='CASCADE'), nullable=False),
        sa.Column('patient_id', sa.Uuid(), sa.ForeignKey('patients.id', ondelete='CASCADE'), nullable=False),
        sa.Column('status', sa.String(length=32), server_default='draft', nullable=False),
        sa.Column('items_json', sa.Text(), nullable=False),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('doctor_id', sa.Uuid(), sa.ForeignKey('users.id', ondelete='RESTRICT'), nullable=False),
        sa.Column('signed_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('signed_by_user_id', sa.Uuid(), sa.ForeignKey('users.id', ondelete='SET NULL'), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), onupdate=sa.func.now(), nullable=False),
    )
    op.create_index('ix_prescriptions_encounter_id', 'prescriptions', ['encounter_id'])
    op.create_index('ix_prescriptions_patient_id', 'prescriptions', ['patient_id'])

    # 7. Referral letters (B5)
    op.create_table(
        'referral_letters',
        sa.Column('id', sa.Uuid(), primary_key=True),
        sa.Column('encounter_id', sa.Uuid(), sa.ForeignKey('clinical_encounters.id', ondelete='CASCADE'), nullable=False),
        sa.Column('patient_id', sa.Uuid(), sa.ForeignKey('patients.id', ondelete='CASCADE'), nullable=False),
        sa.Column('status', sa.String(length=32), server_default='draft', nullable=False),
        sa.Column('recipient', sa.String(length=255), nullable=False),
        sa.Column('reason', sa.Text(), nullable=False),
        sa.Column('summary', sa.Text(), nullable=False),
        sa.Column('doctor_id', sa.Uuid(), sa.ForeignKey('users.id', ondelete='RESTRICT'), nullable=False),
        sa.Column('signed_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('signed_by_user_id', sa.Uuid(), sa.ForeignKey('users.id', ondelete='SET NULL'), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), onupdate=sa.func.now(), nullable=False),
    )
    op.create_index('ix_referral_letters_encounter_id', 'referral_letters', ['encounter_id'])
    op.create_index('ix_referral_letters_patient_id', 'referral_letters', ['patient_id'])


def downgrade() -> None:
    op.drop_table('referral_letters')
    op.drop_table('prescriptions')
    op.drop_table('patient_consents')
    op.drop_table('patient_attachments')
    op.drop_table('clinical_note_templates')
    op.drop_table('treatment_plan_items')
    op.drop_index('ix_tasks_created_by_user_id', table_name='tasks')
    op.drop_column('tasks', 'created_by_user_id')
