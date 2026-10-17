import json
from datetime import datetime, timezone
from typing import Optional
from uuid import UUID, uuid4

from sqlalchemy.ext.asyncio import AsyncSession

from app.infrastructure.database.orm_models import ActivityLogORM


class PostgresActivityLogRepository:
    """
    Repository for persisting tamper-resistant system and clinical audit activity logs.
    """

    def __init__(self, session: AsyncSession):
        self.session = session

    async def log_activity(
        self,
        action: str,
        entity_type: str,
        entity_id: Optional[str] = None,
        user_id: Optional[UUID] = None,
        details: Optional[dict] = None,
        ip_address: Optional[str] = None,
    ) -> None:
        """
        Appends an audit log entry.
        Note: Clinical PHI text is scrubbed and excluded from details.
        """
        orm = ActivityLogORM(
            id=uuid4(),
            user_id=user_id,
            action=action,
            entity_type=entity_type,
            entity_id=entity_id,
            details_json=json.dumps(details) if details else None,
            ip_address=ip_address,
            created_at=datetime.now(timezone.utc),
        )
        self.session.add(orm)
        await self.session.flush()

    async def get_activities(
        self,
        actor: Optional[str] = None,
        action: Optional[str] = None,
        entity_type: Optional[str] = None,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None,
        patient: Optional[str] = None,
        limit: int = 50,
        offset: int = 0,
    ) -> tuple[list[dict], int]:
        """
        Query audit activity logs with optional filters and pagination.
        Includes user account details for who performed the action.
        """
        from sqlalchemy import String, cast, desc, func, or_, select
        from app.infrastructure.database.orm_models import UserORM

        conditions = []
        if action and action.strip():
            conditions.append(ActivityLogORM.action.ilike(f"%{action.strip()}%"))
        if entity_type and entity_type.strip():
            conditions.append(ActivityLogORM.entity_type.ilike(f"%{entity_type.strip()}%"))
        if start_date:
            conditions.append(ActivityLogORM.created_at >= start_date)
        if end_date:
            conditions.append(ActivityLogORM.created_at <= end_date)
        if patient and patient.strip():
            p_val = patient.strip()
            conditions.append(
                or_(
                    ActivityLogORM.entity_id == p_val,
                    ActivityLogORM.details_json.ilike(f"%{p_val}%"),
                )
            )
        if actor and actor.strip():
            a_val = actor.strip()
            conditions.append(
                or_(
                    UserORM.full_name.ilike(f"%{a_val}%"),
                    UserORM.email.ilike(f"%{a_val}%"),
                    cast(ActivityLogORM.user_id, String).ilike(f"%{a_val}%"),
                )
            )

        # Count total matching records
        count_stmt = select(func.count(ActivityLogORM.id)).outerjoin(
            UserORM, ActivityLogORM.user_id == UserORM.id
        )
        if conditions:
            count_stmt = count_stmt.where(*conditions)

        total_res = await self.session.execute(count_stmt)
        total = total_res.scalar() or 0

        # Query paginated rows
        query = (
            select(
                ActivityLogORM,
                UserORM.email.label("user_email"),
                UserORM.full_name.label("user_full_name"),
                UserORM.role.label("user_role"),
            )
            .outerjoin(UserORM, ActivityLogORM.user_id == UserORM.id)
            .order_by(desc(ActivityLogORM.created_at))
        )
        if conditions:
            query = query.where(*conditions)

        query = query.limit(limit).offset(offset)
        rows_res = await self.session.execute(query)
        rows = rows_res.all()

        results = []
        for log, user_email, user_full_name, user_role in rows:
            details = None
            if log.details_json:
                try:
                    details = json.loads(log.details_json)
                except Exception:
                    details = {"raw": log.details_json}
            results.append({
                "id": str(log.id),
                "userId": str(log.user_id) if log.user_id else None,
                "userEmail": user_email,
                "userFullName": user_full_name,
                "userRole": user_role,
                "action": log.action,
                "entityType": log.entity_type,
                "entityId": log.entity_id,
                "details": details,
                "ipAddress": log.ip_address,
                "createdAt": log.created_at.isoformat() if log.created_at else None,
            })

        return results, total

    async def export_activities(
        self,
        actor: Optional[str] = None,
        action: Optional[str] = None,
        entity_type: Optional[str] = None,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None,
        patient: Optional[str] = None,
        max_records: int = 5000,
    ) -> list[dict]:
        """
        Exports audit log records up to max_records for CSV generation.
        """
        items, _ = await self.get_activities(
            actor=actor,
            action=action,
            entity_type=entity_type,
            start_date=start_date,
            end_date=end_date,
            patient=patient,
            limit=max_records,
            offset=0,
        )
        return items


async def record_activity(
    activity_repo: Optional[PostgresActivityLogRepository],
    action: str,
    entity_type: str,
    entity_id: Optional[Any] = None,
    user_id: Optional[UUID] = None,
    details: Optional[dict] = None,
    ip_address: Optional[str] = None,
) -> None:
    """
    Convenience one-line helper to record activity logs safely across service and endpoint layers.
    """
    if activity_repo:
        await activity_repo.log_activity(
            action=action,
            entity_type=entity_type,
            entity_id=str(entity_id) if entity_id is not None else None,
            user_id=user_id,
            details=details,
            ip_address=ip_address,
        )


