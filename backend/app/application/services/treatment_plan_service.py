from datetime import date, datetime, timezone
import re
from typing import Any, Dict, List, Optional
from uuid import UUID

from fastapi import HTTPException, status as http_status

from app.domain.models.treatment_plan import TreatmentPlanItem
from app.domain.repositories.patient_repo import PatientRepository
from app.domain.repositories.service_repo import ServiceRepository
from app.domain.repositories.treatment_plan_repo import TreatmentPlanRepository
from app.infrastructure.repositories.postgres_activity_repo import (
    PostgresActivityLogRepository,
    record_activity,
)


class TreatmentPlanService:
    def __init__(
        self,
        plan_repo: TreatmentPlanRepository,
        patient_repo: Optional[PatientRepository] = None,
        service_repo: Optional[ServiceRepository] = None,
        activity_repo: Optional[PostgresActivityLogRepository] = None,
    ):
        self.plan_repo = plan_repo
        self.patient_repo = patient_repo
        self.service_repo = service_repo
        self.activity_repo = activity_repo

    @staticmethod
    def _parse_price_to_cents(price_str: Optional[str]) -> int:
        if not price_str:
            return 0
        digits = re.sub(r"[^\d.]", "", price_str)
        try:
            val = float(digits)
            return int(round(val * 100))
        except Exception:
            return 0

    async def get_patient_plan(self, patient_id: UUID) -> Dict[str, Any]:
        items = await self.plan_repo.list_by_patient(patient_id)

        grouped_by_tooth: Dict[str, List[Dict[str, Any]]] = {}
        total_estimated_cents = 0
        accepted_estimated_cents = 0

        for it in items:
            tooth_key = f"Tooth {it.tooth_number}" if it.tooth_number is not None else "General / Full Mouth"
            dto = {
                "id": it.id,
                "patientId": it.patient_id,
                "toothNumber": it.tooth_number,
                "serviceId": it.service_id,
                "procedureName": it.procedure_name,
                "status": it.status,
                "estimatedCostCents": it.estimated_cost_cents,
                "estimatedCostFormatted": f"Rs {(it.estimated_cost_cents / 100):,.0f}" if it.estimated_cost_cents > 0 else "Rs 0",
                "decisionDate": it.decision_date,
                "notes": it.notes,
                "completedProcedureId": it.completed_procedure_id,
                "createdByUserId": it.created_by_user_id,
                "createdAt": it.created_at,
                "updatedAt": it.updated_at,
            }
            grouped_by_tooth.setdefault(tooth_key, []).append(dto)

            if it.status in ("proposed", "accepted"):
                total_estimated_cents += it.estimated_cost_cents
            if it.status == "accepted":
                accepted_estimated_cents += it.estimated_cost_cents

        return {
            "patientId": patient_id,
            "items": [
                {
                    "id": it.id,
                    "patientId": it.patient_id,
                    "toothNumber": it.tooth_number,
                    "serviceId": it.service_id,
                    "procedureName": it.procedure_name,
                    "status": it.status,
                    "estimatedCostCents": it.estimated_cost_cents,
                    "estimatedCostFormatted": f"Rs {(it.estimated_cost_cents / 100):,.0f}" if it.estimated_cost_cents > 0 else "Rs 0",
                    "decisionDate": it.decision_date,
                    "notes": it.notes,
                    "completedProcedureId": it.completed_procedure_id,
                    "createdByUserId": it.created_by_user_id,
                    "createdAt": it.created_at,
                    "updatedAt": it.updated_at,
                }
                for it in items
            ],
            "groupedByTooth": grouped_by_tooth,
            "totalItems": len(items),
            "totalEstimatedCents": total_estimated_cents,
            "totalEstimatedFormatted": f"Rs {(total_estimated_cents / 100):,.0f}",
            "acceptedEstimatedCents": accepted_estimated_cents,
            "acceptedEstimatedFormatted": f"Rs {(accepted_estimated_cents / 100):,.0f}",
        }

    async def add_plan_item(
        self,
        patient_id: UUID,
        procedure_name: str,
        created_by_user_id: UUID,
        tooth_number: Optional[int] = None,
        service_id: Optional[str] = None,
        estimated_cost_cents: Optional[int] = None,
        notes: Optional[str] = None,
    ) -> TreatmentPlanItem:
        if not procedure_name or not procedure_name.strip():
            raise HTTPException(
                status_code=http_status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Procedure name is required for treatment plan item.",
            )

        if tooth_number is not None and not (1 <= tooth_number <= 32):
            raise HTTPException(
                status_code=http_status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Tooth number must be between 1 and 32 (FDI / Universal adult notation).",
            )

        cost_cents = estimated_cost_cents or 0
        if cost_cents == 0 and service_id and self.service_repo:
            try:
                # service_id could be UUID or slug
                svc = None
                try:
                    svc_uuid = UUID(service_id)
                    svc = await self.service_repo.get_by_id(svc_uuid)
                except ValueError:
                    svc = await self.service_repo.get_by_slug(service_id)
                if svc and svc.cash_price:
                    cost_cents = self._parse_price_to_cents(svc.cash_price)
            except Exception:
                pass

        item = TreatmentPlanItem(
            patient_id=patient_id,
            procedure_name=procedure_name.strip(),
            tooth_number=tooth_number,
            service_id=service_id,
            status="proposed",
            estimated_cost_cents=cost_cents,
            notes=notes.strip() if notes else None,
            created_by_user_id=created_by_user_id,
        )
        saved = await self.plan_repo.save(item)

        await record_activity(
            self.activity_repo,
            action="treatment_plan_item_create",
            entity_type="treatment_plan_item",
            entity_id=saved.id,
            user_id=created_by_user_id,
            details={
                "patient_id": str(patient_id),
                "procedure_name": saved.procedure_name,
                "tooth_number": saved.tooth_number,
                "status": saved.status,
            },
        )
        return saved

    async def update_item_status(
        self,
        item_id: UUID,
        new_status: str,
        user_id: UUID,
        decision_date: Optional[date] = None,
        completed_procedure_id: Optional[UUID] = None,
        notes: Optional[str] = None,
    ) -> TreatmentPlanItem:
        valid_statuses = {"proposed", "accepted", "declined", "completed"}
        if new_status not in valid_statuses:
            raise HTTPException(
                status_code=http_status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"Invalid status '{new_status}'. Allowed: {sorted(list(valid_statuses))}",
            )

        item = await self.plan_repo.get_by_id(item_id)
        if not item:
            raise HTTPException(
                status_code=http_status.HTTP_404_NOT_FOUND,
                detail="Treatment plan item not found.",
            )

        old_status = item.status

        # Strict requirement: "Completing an item happens only through a procedure record."
        if new_status == "completed" and not completed_procedure_id and not item.completed_procedure_id:
            raise HTTPException(
                status_code=http_status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Completing a treatment plan item happens only through a procedure record (completed_procedure_id is required).",
            )

        item.status = new_status
        if decision_date:
            item.decision_date = decision_date
        elif new_status in ("accepted", "declined") and not item.decision_date:
            item.decision_date = date.today()

        if completed_procedure_id:
            item.completed_procedure_id = completed_procedure_id
        if notes is not None:
            item.notes = notes

        saved = await self.plan_repo.save(item)

        await record_activity(
            self.activity_repo,
            action="treatment_plan_status_change",
            entity_type="treatment_plan_item",
            entity_id=saved.id,
            user_id=user_id,
            details={
                "from_status": old_status,
                "to_status": new_status,
                "completed_procedure_id": str(completed_procedure_id) if completed_procedure_id else None,
            },
        )
        return saved
