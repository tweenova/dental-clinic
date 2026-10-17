from datetime import date
from typing import Any, Dict, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, status as http_status
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, require_doctor_strictly, require_roles
from app.application.services.treatment_plan_service import TreatmentPlanService
from app.core.database import get_db_session
from app.domain.models.user import User, UserRole
from app.infrastructure.repositories.postgres_activity_repo import PostgresActivityLogRepository
from app.infrastructure.repositories.postgres_patient_repo import PostgresPatientRepository
from app.infrastructure.repositories.postgres_service_repo import PostgresServiceRepository
from app.infrastructure.repositories.postgres_treatment_plan_repo import PostgresTreatmentPlanRepository

router = APIRouter(prefix="/doctor/treatment-plans", tags=["Doctor Treatment Plans"])


class AddPlanItemRequest(BaseModel):
    patientId: UUID
    procedureName: str = Field(..., min_length=1, max_length=255)
    toothNumber: Optional[int] = Field(None, ge=1, le=32)
    serviceId: Optional[str] = None
    estimatedCostCents: Optional[int] = Field(None, ge=0)
    notes: Optional[str] = None


class UpdatePlanItemStatusRequest(BaseModel):
    status: str = Field(..., pattern="^(proposed|accepted|declined|completed)$")
    decisionDate: Optional[date] = None
    completedProcedureId: Optional[UUID] = None
    notes: Optional[str] = None


@router.get(
    "/patient/{patient_id}",
    summary="Get patient's treatment plan grouped by tooth with catalog estimates",
    dependencies=[Depends(require_roles([UserRole.DOCTOR, UserRole.ADMIN]))],
)
async def get_patient_treatment_plan(
    patient_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
) -> Dict[str, Any]:
    plan_repo = PostgresTreatmentPlanRepository(db)
    service_repo = PostgresServiceRepository(db)
    activity_repo = PostgresActivityLogRepository(db)

    service = TreatmentPlanService(
        plan_repo=plan_repo,
        service_repo=service_repo,
        activity_repo=activity_repo,
    )
    return await service.get_patient_plan(patient_id)


@router.post(
    "",
    status_code=http_status.HTTP_201_CREATED,
    summary="Add an item to a patient's treatment plan",
    dependencies=[Depends(require_doctor_strictly)],
)
async def add_treatment_plan_item(
    payload: AddPlanItemRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
) -> Dict[str, Any]:
    plan_repo = PostgresTreatmentPlanRepository(db)
    service_repo = PostgresServiceRepository(db)
    activity_repo = PostgresActivityLogRepository(db)

    service = TreatmentPlanService(
        plan_repo=plan_repo,
        service_repo=service_repo,
        activity_repo=activity_repo,
    )
    saved = await service.add_plan_item(
        patient_id=payload.patientId,
        procedure_name=payload.procedureName,
        created_by_user_id=current_user.id,
        tooth_number=payload.toothNumber,
        service_id=payload.serviceId,
        estimated_cost_cents=payload.estimatedCostCents,
        notes=payload.notes,
    )
    return {
        "id": saved.id,
        "patientId": saved.patient_id,
        "toothNumber": saved.tooth_number,
        "serviceId": saved.service_id,
        "procedureName": saved.procedure_name,
        "status": saved.status,
        "estimatedCostCents": saved.estimated_cost_cents,
        "notes": saved.notes,
        "createdAt": saved.created_at,
    }


@router.patch(
    "/{item_id}/status",
    summary="Update treatment plan item status (proposed, accepted, declined, completed)",
    dependencies=[Depends(require_doctor_strictly)],
)
async def update_treatment_plan_item_status(
    item_id: UUID,
    payload: UpdatePlanItemStatusRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
) -> Dict[str, Any]:
    plan_repo = PostgresTreatmentPlanRepository(db)
    activity_repo = PostgresActivityLogRepository(db)

    service = TreatmentPlanService(
        plan_repo=plan_repo,
        activity_repo=activity_repo,
    )
    saved = await service.update_item_status(
        item_id=item_id,
        new_status=payload.status,
        user_id=current_user.id,
        decision_date=payload.decisionDate,
        completed_procedure_id=payload.completedProcedureId,
        notes=payload.notes,
    )
    return {
        "id": saved.id,
        "status": saved.status,
        "decisionDate": saved.decision_date,
        "completedProcedureId": saved.completed_procedure_id,
        "updatedAt": saved.updated_at,
    }
