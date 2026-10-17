from datetime import date
from typing import List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, Query, status

from app.api.deps import get_booking_settings_service, require_admin
from app.application.dtos.booking_settings_dto import (
    AffectedBookingDto,
    BookingModeUpdateRequest,
    BookingModeUpdateResponse,
    BookingSettingsResponse,
    ClinicClosureCreateRequest,
    ClinicClosureDto,
    ClinicClosureUpdateRequest,
    CreateClosureResponse,
    CreateProviderAvailabilityResponse,
    CreateProviderTimeOffResponse,
    OnlineBookingRulesUpdateRequest,
    ProviderAvailabilityCreateRequest,
    ProviderAvailabilityDto,
    ProviderTimeOffCreateRequest,
    ProviderTimeOffDto,
    ReminderTemplateUpdateRequest,
    RescheduleTasksRequest,
    RescheduleTasksResponse,
    WorkingHoursDto,
    WorkingHoursUpdateRequest,
)
from app.application.services.booking_settings_service import BookingSettingsService
from app.domain.models.user import User

router = APIRouter(prefix="/admin/booking", tags=["Admin Booking Settings"], dependencies=[Depends(require_admin)])


@router.get("/settings", response_model=BookingSettingsResponse)
async def get_booking_settings(
    service: BookingSettingsService = Depends(get_booking_settings_service),
) -> BookingSettingsResponse:
    """Returns current emergency booking mode, pause metadata, and advance booking window."""
    return await service.get_admin_settings()


@router.post("/mode", response_model=BookingModeUpdateResponse)
async def update_booking_mode(
    req: BookingModeUpdateRequest,
    current_user: User = Depends(require_admin),
    service: BookingSettingsService = Depends(get_booking_settings_service),
) -> BookingModeUpdateResponse:
    """
    Updates emergency booking mode (open | paused | closed).
    Synchronizes public marquee announcement banner and returns affected future bookings.
    Audited with before and after state.
    """
    settings_resp, affected = await service.update_booking_mode(
        mode=req.mode,
        message=req.message,
        resume_on=req.resumeOn,
        user_id=current_user.id,
    )
    return BookingModeUpdateResponse(
        settings=settings_resp,
        affectedBookings=affected,
    )


@router.get("/affected-bookings", response_model=List[AffectedBookingDto])
async def get_affected_bookings(
    start_date: date = Query(..., alias="startDate"),
    end_date: Optional[date] = Query(None, alias="endDate"),
    service: BookingSettingsService = Depends(get_booking_settings_service),
) -> List[AffectedBookingDto]:
    """Retrieves non-cancelled future bookings scheduled in the specified period."""
    return await service.get_affected_bookings(start_date=start_date, end_date=end_date)


@router.post("/reschedule-tasks", response_model=RescheduleTasksResponse, status_code=status.HTTP_201_CREATED)
async def create_reschedule_tasks(
    req: RescheduleTasksRequest,
    current_user: User = Depends(require_admin),
    service: BookingSettingsService = Depends(get_booking_settings_service),
) -> RescheduleTasksResponse:
    """
    Creates one high-priority reception reschedule task per affected booking:
    'Call to reschedule: <patient> (<date>)'.
    Idempotent: running multiple times does not duplicate tasks.
    NEVER cancels or moves bookings automatically.
    """
    task_ids = await service.create_reschedule_tasks(
        booking_ids=req.bookingIds,
        user_id=current_user.id,
    )
    return RescheduleTasksResponse(
        tasksCreated=len(task_ids),
        taskIds=task_ids,
    )


@router.get("/closures", response_model=List[ClinicClosureDto])
async def list_closures(
    service: BookingSettingsService = Depends(get_booking_settings_service),
) -> List[ClinicClosureDto]:
    """Lists all planned calendar closures."""
    return await service.list_closures()


@router.post("/closures", response_model=CreateClosureResponse, status_code=status.HTTP_201_CREATED)
async def create_closure(
    req: ClinicClosureCreateRequest,
    current_user: User = Depends(require_admin),
    service: BookingSettingsService = Depends(get_booking_settings_service),
) -> CreateClosureResponse:
    """
    Creates a new planned closure date range, discovers affected bookings, and writes audit log.
    """
    closure_dto, affected = await service.create_closure(
        start_date=req.startDate,
        end_date=req.endDate,
        reason=req.reason,
        message=req.message,
        user_id=current_user.id,
    )
    return CreateClosureResponse(
        closure=closure_dto,
        affectedBookings=affected,
    )


@router.put("/closures/{closure_id}", response_model=ClinicClosureDto)
async def update_closure(
    closure_id: UUID,
    req: ClinicClosureUpdateRequest,
    current_user: User = Depends(require_admin),
    service: BookingSettingsService = Depends(get_booking_settings_service),
) -> ClinicClosureDto:
    """Updates an existing calendar closure. Audited with before and after."""
    return await service.update_closure(
        closure_id=closure_id,
        start_date=req.startDate,
        end_date=req.endDate,
        reason=req.reason,
        message=req.message,
        user_id=current_user.id,
    )


@router.delete("/closures/{closure_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_closure(
    closure_id: UUID,
    current_user: User = Depends(require_admin),
    service: BookingSettingsService = Depends(get_booking_settings_service),
) -> None:
    """Deletes a calendar closure. Audited."""
    await service.delete_closure(closure_id=closure_id, user_id=current_user.id)


@router.get("/working-hours", response_model=List[WorkingHoursDto])
async def get_working_hours(
    service: BookingSettingsService = Depends(get_booking_settings_service),
) -> List[WorkingHoursDto]:
    """Retrieves single source of truth clinic working hours across all 7 days of the week."""
    return await service.get_public_working_hours()


@router.put("/working-hours", response_model=List[WorkingHoursDto])
async def update_working_hours(
    updates: List[WorkingHoursUpdateRequest],
    current_user: User = Depends(require_admin),
    service: BookingSettingsService = Depends(get_booking_settings_service),
) -> List[WorkingHoursDto]:
    """
    Updates clinic working hours and closed flags.
    The public footer, contact hours, and booking calendar automatically reflect these hours.
    Audited with before and after.
    """
    raw_updates = [u.model_dump() for u in updates]
    return await service.update_working_hours(updates=raw_updates, user_id=current_user.id)


@router.put("/rules", response_model=BookingSettingsResponse)
async def update_online_booking_rules(
    req: OnlineBookingRulesUpdateRequest,
    current_user: User = Depends(require_admin),
    service: BookingSettingsService = Depends(get_booking_settings_service),
) -> BookingSettingsResponse:
    """Updates online booking rules: slot interval minutes, min lead time hours, advance booking days, and optional reminder template."""
    return await service.update_online_booking_rules(
        slot_interval_minutes=req.slotIntervalMinutes,
        min_lead_time_hours=req.minLeadTimeHours,
        advance_booking_days=req.advanceBookingDays,
        reminder_template=req.reminderTemplate,
        waiting_threshold_minutes=req.waitingThresholdMinutes,
        file_number_prefix=req.fileNumberPrefix,
        payments_enabled=req.paymentsEnabled,
        user_id=current_user.id,
    )


@router.put("/reminder-template", response_model=BookingSettingsResponse)
async def update_reminder_template(
    req: ReminderTemplateUpdateRequest,
    current_user: User = Depends(require_admin),
    service: BookingSettingsService = Depends(get_booking_settings_service),
) -> BookingSettingsResponse:
    """Updates appointment WhatsApp/SMS reminder template (strictly non-clinical logistics). Audited."""
    return await service.update_reminder_template(
        template=req.template,
        user_id=current_user.id,
    )


@router.get("/provider-availability", response_model=List[ProviderAvailabilityDto])
async def list_provider_availabilities(
    teamMemberId: Optional[UUID] = Query(None),
    service: BookingSettingsService = Depends(get_booking_settings_service),
) -> List[ProviderAvailabilityDto]:
    """Retrieves weekly recurring shift schedules and breaks for clinicians."""
    return await service.list_provider_availabilities(team_member_id=teamMemberId)


@router.post("/provider-availability", response_model=CreateProviderAvailabilityResponse)
async def save_provider_availability(
    req: ProviderAvailabilityCreateRequest,
    current_user: User = Depends(require_admin),
    service: BookingSettingsService = Depends(get_booking_settings_service),
) -> CreateProviderAvailabilityResponse:
    """Creates or updates a recurring clinician shift schedule. Returns affected future bookings."""
    dto, affected = await service.save_provider_availability(req=req, user_id=current_user.id)
    return CreateProviderAvailabilityResponse(
        availability=dto,
        affectedBookings=affected,
    )


@router.delete("/provider-availability/{avail_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_provider_availability(
    avail_id: UUID,
    current_user: User = Depends(require_admin),
    service: BookingSettingsService = Depends(get_booking_settings_service),
) -> None:
    """Deletes a clinician shift schedule entry."""
    await service.delete_provider_availability(avail_id=avail_id, user_id=current_user.id)


@router.get("/provider-time-off", response_model=List[ProviderTimeOffDto])
async def list_provider_time_off(
    teamMemberId: Optional[UUID] = Query(None),
    futureOnly: bool = Query(False),
    service: BookingSettingsService = Depends(get_booking_settings_service),
) -> List[ProviderTimeOffDto]:
    """Retrieves scheduled time off and leaves for clinicians."""
    return await service.list_provider_time_off(team_member_id=teamMemberId, future_only=futureOnly)


@router.post("/provider-time-off", response_model=CreateProviderTimeOffResponse)
async def save_provider_time_off(
    req: ProviderTimeOffCreateRequest,
    current_user: User = Depends(require_admin),
    service: BookingSettingsService = Depends(get_booking_settings_service),
) -> CreateProviderTimeOffResponse:
    """Records clinician vacation/time off and warns with affected scheduled bookings without auto-canceling."""
    dto, affected = await service.save_provider_time_off(req=req, user_id=current_user.id)
    return CreateProviderTimeOffResponse(
        timeOff=dto,
        affectedBookings=affected,
    )


@router.delete("/provider-time-off/{time_off_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_provider_time_off(
    time_off_id: UUID,
    current_user: User = Depends(require_admin),
    service: BookingSettingsService = Depends(get_booking_settings_service),
) -> None:
    """Removes a clinician time off record."""
    await service.delete_provider_time_off(time_off_id=time_off_id, user_id=current_user.id)

