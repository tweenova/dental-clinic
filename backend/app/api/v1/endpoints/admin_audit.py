import csv
import io
import json
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, Query, Request, Response, status
from pydantic import BaseModel

from app.api.deps import get_activity_log_repository, get_current_user, require_admin
from app.domain.models.user import User
from app.infrastructure.repositories.postgres_activity_repo import (
    PostgresActivityLogRepository,
    record_activity,
)

router = APIRouter(
    prefix="/admin/audit",
    tags=["Admin Audit Viewer"],
    dependencies=[Depends(require_admin)],
)


class ActivityLogItemDto(BaseModel):
    id: str
    userId: Optional[str] = None
    userEmail: Optional[str] = None
    userFullName: Optional[str] = None
    userRole: Optional[str] = None
    action: str
    entityType: str
    entityId: Optional[str] = None
    details: Optional[Dict[str, Any]] = None
    ipAddress: Optional[str] = None
    createdAt: Optional[str] = None


class PaginatedActivityLogsResponse(BaseModel):
    items: List[ActivityLogItemDto]
    total: int
    page: int
    pageSize: int
    totalPages: int


@router.get("", response_model=PaginatedActivityLogsResponse)
async def list_audit_logs(
    actor: Optional[str] = Query(None, description="Filter by actor name, email, or user ID"),
    action: Optional[str] = Query(None, description="Filter by action name e.g. read, update, create, void, export"),
    entity: Optional[str] = Query(None, description="Filter by entity type e.g. patient, booking, clinical_note"),
    patient: Optional[str] = Query(None, description="Filter by patient ID"),
    date_from: Optional[datetime] = Query(None, description="Start date ISO datetime"),
    date_to: Optional[datetime] = Query(None, description="End date ISO datetime"),
    page: int = Query(1, ge=1),
    page_size: int = Query(25, ge=1, le=100),
    activity_repo: PostgresActivityLogRepository = Depends(get_activity_log_repository),
) -> PaginatedActivityLogsResponse:
    """
    Read-only paginated audit viewer for platform compliance.
    Strictly append-only; update and delete operations are prohibited.
    """
    offset = (page - 1) * page_size
    items, total = await activity_repo.get_activities(
        actor=actor,
        action=action,
        entity_type=entity,
        start_date=date_from,
        end_date=date_to,
        patient=patient,
        limit=page_size,
        offset=offset,
    )

    total_pages = (total + page_size - 1) // page_size if total > 0 else 1

    return PaginatedActivityLogsResponse(
        items=[ActivityLogItemDto(**item) for item in items],
        total=total,
        page=page,
        pageSize=page_size,
        totalPages=total_pages,
    )


@router.get("/export")
async def export_audit_logs_csv(
    request: Request,
    actor: Optional[str] = Query(None),
    action: Optional[str] = Query(None),
    entity: Optional[str] = Query(None),
    patient: Optional[str] = Query(None),
    date_from: Optional[datetime] = Query(None),
    date_to: Optional[datetime] = Query(None),
    activity_repo: PostgresActivityLogRepository = Depends(get_activity_log_repository),
    current_user: User = Depends(get_current_user),
) -> Response:
    """
    Exports filtered audit activity logs as CSV.
    The export action itself is audit-logged to maintain accountability.
    """
    records = await activity_repo.export_activities(
        actor=actor,
        action=action,
        entity_type=entity,
        start_date=date_from,
        end_date=date_to,
        patient=patient,
        max_records=5000,
    )

    # Audit this export operation itself
    await record_activity(
        activity_repo=activity_repo,
        action="export",
        entity_type="audit_log",
        entity_id="audit_csv_export",
        user_id=current_user.id,
        details={
            "exportedCount": len(records),
            "filters": {
                "actor": actor,
                "action": action,
                "entity": entity,
                "patient": patient,
                "dateFrom": date_from.isoformat() if date_from else None,
                "dateTo": date_to.isoformat() if date_to else None,
            },
        },
        ip_address=request.client.host if request.client else None,
    )

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow([
        "Timestamp (UTC)",
        "Actor Full Name",
        "Actor Email",
        "Actor Role",
        "Action",
        "Entity Type",
        "Entity ID",
        "IP Address",
        "Details",
    ])

    for r in records:
        details_str = json.dumps(r.get("details")) if r.get("details") else ""
        writer.writerow([
            r.get("createdAt") or "",
            r.get("userFullName") or "System / Anonymous",
            r.get("userEmail") or "N/A",
            r.get("userRole") or "N/A",
            r.get("action") or "",
            r.get("entityType") or "",
            r.get("entityId") or "",
            r.get("ipAddress") or "",
            details_str,
        ])

    csv_data = output.getvalue()
    filename = f"marlow_audit_logs_{datetime.now(timezone.utc).strftime('%Y%m%d_%H%M%S')}.csv"

    return Response(
        content=csv_data,
        media_type="text/csv",
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"',
        },
    )
