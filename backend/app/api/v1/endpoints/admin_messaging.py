from datetime import date, timedelta
from typing import Any, Dict, List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, Query, status

from app.api.deps import get_reception_service, require_admin
from app.application.dtos.reception_dto import (
    MessageLogItemDto,
    MessagingSettingsDto,
    RunSchedulerResponseDto,
    SendTestMessageRequest,
    SendTestMessageResponse,
    UpdateMessagingSettingsRequest,
)
from app.application.services.reception_service import ReceptionService
from app.domain.models.user import User

router = APIRouter(
    prefix="/admin/messaging",
    tags=["Admin Messaging & Reminders"],
    dependencies=[Depends(require_admin)],
)


@router.get("/settings", response_model=MessagingSettingsDto)
async def get_messaging_settings(
    clinic_id: Optional[UUID] = Query(None),
    current_user: User = Depends(require_admin),
    reception_service: ReceptionService = Depends(get_reception_service),
) -> MessagingSettingsDto:
    """Returns messaging provider configuration, quiet hours window, and reminder template."""
    res = await reception_service.get_messaging_settings(clinic_id=clinic_id)
    return MessagingSettingsDto(**res)


@router.put("/settings", response_model=MessagingSettingsDto)
async def update_messaging_settings(
    req: UpdateMessagingSettingsRequest,
    clinic_id: Optional[UUID] = Query(None),
    current_user: User = Depends(require_admin),
    reception_service: ReceptionService = Depends(get_reception_service),
) -> MessagingSettingsDto:
    """Updates messaging provider mode, quiet hours window, or reminder template. Audited."""
    req_dict = req.model_dump(exclude_unset=True)
    res = await reception_service.update_messaging_settings(
        req_data=req_dict,
        user_id=current_user.id,
        clinic_id=clinic_id,
    )
    return MessagingSettingsDto(**res)


@router.post("/test", response_model=SendTestMessageResponse)
@router.post("/send-test", response_model=SendTestMessageResponse)
async def send_test_message(
    req: SendTestMessageRequest,
    clinic_id: Optional[UUID] = Query(None),
    current_user: User = Depends(require_admin),
    reception_service: ReceptionService = Depends(get_reception_service),
) -> SendTestMessageResponse:
    """Dispatches a test message to number X through the active messaging provider. Admin only."""
    res = await reception_service.send_test_message(
        recipient=req.recipient,
        message=req.message,
        channel=req.channel,
        clinic_id=clinic_id,
        user_id=current_user.id,
    )
    return SendTestMessageResponse(**res)


@router.get("/logs", response_model=Dict[str, Any])
async def list_message_logs(
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    current_user: User = Depends(require_admin),
    reception_service: ReceptionService = Depends(get_reception_service),
) -> Dict[str, Any]:
    """Returns paginated list of all transactional and automated messages with honest simulated delivery statuses."""
    items, total = await reception_service.list_all_messages(limit=limit, offset=offset)
    return {
        "items": [MessageLogItemDto(**m) for m in items],
        "total": total,
        "limit": limit,
        "offset": offset,
    }


@router.post("/run-scheduler", response_model=RunSchedulerResponseDto)
async def run_reminder_scheduler(
    target_date: Optional[date] = Query(None),
    force_quiet_hours: bool = Query(False),
    clinic_id: Optional[UUID] = Query(None),
    current_user: User = Depends(require_admin),
    reception_service: ReceptionService = Depends(get_reception_service),
) -> RunSchedulerResponseDto:
    """
    Manually triggers automated reminder dispatch for confirmed appointments on target_date (default tomorrow).
    Respects quiet hours (21:00-08:00 PKT) unless force_quiet_hours=True. Skips opted-out patients.
    Audited with simulated delivery status.
    """
    target = target_date or (date.today() + timedelta(days=1))
    res = await reception_service.run_automated_reminders(
        target_date=target,
        clinic_id=clinic_id,
        user_id=current_user.id,
        force_quiet_hours=force_quiet_hours,
    )
    return RunSchedulerResponseDto(**res)
