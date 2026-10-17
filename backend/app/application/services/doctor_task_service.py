from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Tuple
from uuid import UUID

from fastapi import HTTPException, status as http_status

from app.domain.models.booking_crm import Task
from app.domain.repositories.patient_repo import PatientRepository
from app.domain.repositories.task_repo import TaskRepository
from app.domain.repositories.user_repo import UserRepository
from app.infrastructure.repositories.postgres_activity_repo import (
    PostgresActivityLogRepository,
    record_activity,
)


class DoctorTaskService:
    """
    Dedicated clinical task workflow for doctors.
    Strictly isolated: does not expose reception endpoints to doctors.
    """

    def __init__(
        self,
        task_repo: TaskRepository,
        patient_repo: Optional[PatientRepository] = None,
        user_repo: Optional[UserRepository] = None,
        activity_repo: Optional[PostgresActivityLogRepository] = None,
    ):
        self.task_repo = task_repo
        self.patient_repo = patient_repo
        self.user_repo = user_repo
        self.activity_repo = activity_repo

    async def list_doctor_tasks(
        self,
        doctor_user_id: UUID,
        status: Optional[str] = None,
        limit: int = 100,
        offset: int = 0,
    ) -> Tuple[List[Dict[str, Any]], int]:
        tasks, total = await self.task_repo.list_doctor_tasks(
            user_id=doctor_user_id,
            status=status,
            limit=limit,
            offset=offset,
        )

        patient_names: Dict[UUID, str] = {}
        staff_names: Dict[UUID, str] = {}

        results: List[Dict[str, Any]] = []
        for t in tasks:
            p_name = None
            if t.patient_id:
                if t.patient_id not in patient_names and self.patient_repo:
                    p = await self.patient_repo.get_by_id(t.patient_id)
                    if p:
                        patient_names[t.patient_id] = f"{p.first_name} {p.last_name}"
                p_name = patient_names.get(t.patient_id)

            assigned_name = None
            if t.assigned_to_user_id:
                if t.assigned_to_user_id not in staff_names and self.user_repo:
                    u = await self.user_repo.get_by_id(t.assigned_to_user_id)
                    if u:
                        staff_names[t.assigned_to_user_id] = u.full_name
                assigned_name = staff_names.get(t.assigned_to_user_id)

            created_by_name = None
            if t.created_by_user_id:
                if t.created_by_user_id not in staff_names and self.user_repo:
                    u = await self.user_repo.get_by_id(t.created_by_user_id)
                    if u:
                        staff_names[t.created_by_user_id] = u.full_name
                created_by_name = staff_names.get(t.created_by_user_id)

            results.append({
                "id": t.id,
                "title": t.title,
                "description": t.description,
                "status": t.status,
                "priority": t.priority,
                "dueDate": t.due_date,
                "patientId": t.patient_id,
                "patientName": p_name,
                "bookingId": t.booking_id,
                "assignedToUserId": t.assigned_to_user_id,
                "assignedToName": assigned_name,
                "createdByUserId": t.created_by_user_id,
                "createdByName": created_by_name,
                "isAssignedToMe": (t.assigned_to_user_id == doctor_user_id),
                "isCreatedByMe": (t.created_by_user_id == doctor_user_id),
                "createdAt": t.created_at,
                "updatedAt": t.updated_at,
            })

        return results, total

    async def create_reception_task(
        self,
        doctor_user_id: UUID,
        title: str,
        patient_id: UUID,
        description: Optional[str] = None,
        priority: str = "medium",
        due_date: Optional[datetime] = None,
    ) -> Task:
        if not title or not title.strip():
            raise HTTPException(
                status_code=http_status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Task title is required.",
            )

        if not patient_id:
            raise HTTPException(
                status_code=http_status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Patient link is required for doctor tasks sent to reception.",
            )

        if self.patient_repo:
            patient = await self.patient_repo.get_by_id(patient_id)
            if not patient:
                raise HTTPException(
                    status_code=http_status.HTTP_404_NOT_FOUND,
                    detail="Patient not found.",
                )

        task = Task(
            title=title.strip(),
            description=description.strip() if description else None,
            patient_id=patient_id,
            assigned_to_user_id=None,  # Unassigned reception queue
            created_by_user_id=doctor_user_id,
            priority=priority if priority in ("low", "medium", "high", "urgent") else "medium",
            due_date=due_date,
            status="pending",
        )
        saved = await self.task_repo.save(task)

        await record_activity(
            self.activity_repo,
            action="doctor_task_create",
            entity_type="task",
            entity_id=saved.id,
            user_id=doctor_user_id,
            details={
                "title": saved.title,
                "patient_id": str(patient_id),
                "priority": saved.priority,
            },
        )
        return saved

    async def mark_task_done(
        self,
        task_id: UUID,
        user_id: UUID,
    ) -> Task:
        task = await self.task_repo.get_by_id(task_id)
        if not task:
            raise HTTPException(
                status_code=http_status.HTTP_404_NOT_FOUND,
                detail="Task not found.",
            )

        task.status = "done"
        task.updated_at = datetime.now(timezone.utc)
        saved = await self.task_repo.save(task)

        await record_activity(
            self.activity_repo,
            action="doctor_task_done",
            entity_type="task",
            entity_id=saved.id,
            user_id=user_id,
            details={"status": "done"},
        )
        return saved
