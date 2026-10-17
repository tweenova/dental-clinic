from datetime import datetime
from typing import Any, Dict, List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, Query, status as http_status
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, require_roles
from app.application.services.doctor_task_service import DoctorTaskService
from app.core.database import get_db_session
from app.domain.models.user import User, UserRole
from app.infrastructure.repositories.postgres_activity_repo import PostgresActivityLogRepository
from app.infrastructure.repositories.postgres_patient_repo import PostgresPatientRepository
from app.infrastructure.repositories.postgres_task_repo import PostgresTaskRepository
from app.infrastructure.repositories.postgres_user_repo import PostgresUserRepository

router = APIRouter(prefix="/doctor/tasks", tags=["Doctor Tasks"])


class CreateDoctorTaskRequest(BaseModel):
    title: str = Field(..., min_length=1, max_length=255)
    patientId: UUID
    description: Optional[str] = None
    priority: str = Field("medium", pattern="^(low|medium|high|urgent)$")
    dueDate: Optional[datetime] = None


@router.get(
    "",
    summary="List tasks assigned to or created by the doctor",
    dependencies=[Depends(require_roles([UserRole.DOCTOR, UserRole.ADMIN]))],
)
async def list_doctor_tasks(
    status: Optional[str] = Query(None, description="Filter by status (open, pending, in_progress, done)"),
    limit: int = Query(100, ge=1, le=200),
    offset: int = Query(0, ge=0),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
) -> Dict[str, Any]:
    task_repo = PostgresTaskRepository(db)
    patient_repo = PostgresPatientRepository(db)
    user_repo = PostgresUserRepository(db)
    activity_repo = PostgresActivityLogRepository(db)

    service = DoctorTaskService(
        task_repo=task_repo,
        patient_repo=patient_repo,
        user_repo=user_repo,
        activity_repo=activity_repo,
    )
    items, total = await service.list_doctor_tasks(
        doctor_user_id=current_user.id,
        status=status,
        limit=limit,
        offset=offset,
    )
    return {"items": items, "total": total}


@router.post(
    "",
    status_code=http_status.HTTP_201_CREATED,
    summary="Doctor creates a patient-linked task for reception",
    dependencies=[Depends(require_roles([UserRole.DOCTOR, UserRole.ADMIN]))],
)
async def create_doctor_task(
    payload: CreateDoctorTaskRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
) -> Dict[str, Any]:
    task_repo = PostgresTaskRepository(db)
    patient_repo = PostgresPatientRepository(db)
    activity_repo = PostgresActivityLogRepository(db)

    service = DoctorTaskService(
        task_repo=task_repo,
        patient_repo=patient_repo,
        activity_repo=activity_repo,
    )
    saved = await service.create_reception_task(
        doctor_user_id=current_user.id,
        title=payload.title,
        patient_id=payload.patientId,
        description=payload.description,
        priority=payload.priority,
        due_date=payload.dueDate,
    )
    return {
        "id": saved.id,
        "title": saved.title,
        "description": saved.description,
        "patientId": saved.patient_id,
        "status": saved.status,
        "priority": saved.priority,
        "createdByUserId": saved.created_by_user_id,
        "createdAt": saved.created_at,
    }


@router.post(
    "/{task_id}/done",
    summary="Doctor marks a task done",
    dependencies=[Depends(require_roles([UserRole.DOCTOR, UserRole.ADMIN]))],
)
async def mark_doctor_task_done(
    task_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
) -> Dict[str, Any]:
    task_repo = PostgresTaskRepository(db)
    activity_repo = PostgresActivityLogRepository(db)

    service = DoctorTaskService(
        task_repo=task_repo,
        activity_repo=activity_repo,
    )
    saved = await service.mark_task_done(task_id=task_id, user_id=current_user.id)
    return {
        "id": saved.id,
        "status": saved.status,
        "updatedAt": saved.updated_at,
    }
