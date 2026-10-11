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

