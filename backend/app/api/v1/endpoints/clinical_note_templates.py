from typing import Any, Dict, List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, Query, status as http_status
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, require_roles
from app.application.services.clinical_note_template_service import ClinicalNoteTemplateService
from app.core.database import get_db_session
from app.domain.models.user import User, UserRole
from app.infrastructure.repositories.postgres_activity_repo import PostgresActivityLogRepository
from app.infrastructure.repositories.postgres_clinical_note_repo import PostgresClinicalNoteRepository
from app.infrastructure.repositories.postgres_clinical_note_template_repo import PostgresClinicalNoteTemplateRepository

router = APIRouter(tags=["Clinical Note Templates"])


class CreateTemplateRequest(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    subjective: str = ""
    objective: str = ""
    assessment: str = ""
    plan: str = ""
    active: bool = True


class UpdateTemplateRequest(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=100)
    subjective: Optional[str] = None
    objective: Optional[str] = None
    assessment: Optional[str] = None
    plan: Optional[str] = None
    active: Optional[bool] = None


class ApplyTemplateRequest(BaseModel):
    templateId: UUID
    overwriteConfirmed: bool = False


@router.get(
    "/clinical-note-templates",
    summary="List active clinical note templates",
    dependencies=[Depends(require_roles([UserRole.DOCTOR, UserRole.ADMIN]))],
)
async def list_note_templates(
    include_inactive: bool = Query(False),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
) -> List[Dict[str, Any]]:
    template_repo = PostgresClinicalNoteTemplateRepository(db)
    service = ClinicalNoteTemplateService(template_repo=template_repo)
    templates = await service.list_templates(active_only=not include_inactive)
    return [
        {
            "id": t.id,
            "name": t.name,
            "subjective": t.subjective,
            "objective": t.objective,
            "assessment": t.assessment,
            "plan": t.plan,
            "active": t.active,
            "createdAt": t.created_at,
        }
        for t in templates
    ]


@router.post(
    "/admin/note-templates",
    status_code=http_status.HTTP_201_CREATED,
    summary="Create a note template (admin or doctor) - clinic configuration",
    dependencies=[Depends(require_roles([UserRole.ADMIN, UserRole.DOCTOR]))],
)
async def create_note_template(
    payload: CreateTemplateRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
) -> Dict[str, Any]:
    template_repo = PostgresClinicalNoteTemplateRepository(db)
    activity_repo = PostgresActivityLogRepository(db)
    service = ClinicalNoteTemplateService(template_repo=template_repo, activity_repo=activity_repo)
    saved = await service.create_template(
        name=payload.name,
        subjective=payload.subjective,
        objective=payload.objective,
        assessment=payload.assessment,
        plan=payload.plan,
        active=payload.active,
        user_id=current_user.id,
    )
    return {
        "id": saved.id,
        "name": saved.name,
        "subjective": saved.subjective,
        "objective": saved.objective,
        "assessment": saved.assessment,
        "plan": saved.plan,
        "active": saved.active,
    }


@router.put(
    "/admin/note-templates/{template_id}",
    summary="Update a note template (admin or doctor) - clinic configuration",
    dependencies=[Depends(require_roles([UserRole.ADMIN, UserRole.DOCTOR]))],
)
async def update_note_template(
    template_id: UUID,
    payload: UpdateTemplateRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
) -> Dict[str, Any]:
    template_repo = PostgresClinicalNoteTemplateRepository(db)
    activity_repo = PostgresActivityLogRepository(db)
    service = ClinicalNoteTemplateService(template_repo=template_repo, activity_repo=activity_repo)
    saved = await service.update_template(
        template_id=template_id,
        name=payload.name,
        subjective=payload.subjective,
        objective=payload.objective,
        assessment=payload.assessment,
        plan=payload.plan,
        active=payload.active,
        user_id=current_user.id,
    )
    return {
        "id": saved.id,
        "name": saved.name,
        "subjective": saved.subjective,
        "objective": saved.objective,
        "assessment": saved.assessment,
        "plan": saved.plan,
        "active": saved.active,
    }


@router.post(
    "/doctor/clinical-notes/{note_id}/apply-template",
    summary="Doctor applies template to draft note with overwrite protection",
    dependencies=[Depends(require_roles([UserRole.DOCTOR]))],
)
async def apply_template_to_note(
    note_id: UUID,
    payload: ApplyTemplateRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
) -> Dict[str, Any]:
    template_repo = PostgresClinicalNoteTemplateRepository(db)
    clinical_note_repo = PostgresClinicalNoteRepository(db)
    activity_repo = PostgresActivityLogRepository(db)

    service = ClinicalNoteTemplateService(
        template_repo=template_repo,
        clinical_note_repo=clinical_note_repo,
        activity_repo=activity_repo,
    )
    return await service.apply_template_to_draft_note(
        template_id=payload.templateId,
        note_id=note_id,
        user_id=current_user.id,
        overwrite_confirmed=payload.overwriteConfirmed,
    )
