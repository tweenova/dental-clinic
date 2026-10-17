from datetime import date, datetime, timezone
from typing import Any, Dict, List, Optional, Tuple
from uuid import UUID, uuid4

from fastapi import HTTPException, status as http_status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.application.dtos.booking_settings_dto import (
    AffectedBookingDto,
    BookingSettingsResponse,
    ClinicClosureDto,
    ProviderAvailabilityCreateRequest,
    ProviderAvailabilityDto,
    ProviderTimeOffCreateRequest,
    ProviderTimeOffDto,
    PublicBookingStatusResponse,
    WorkingHoursDto,
)
from app.domain.models.booking_settings import (
    BookingSettings,
    ClinicClosure,
    ProviderAvailability,
    ProviderTimeOff,
    WorkingHours,
)
from app.domain.repositories.booking_repo import BookingRepository
from app.domain.repositories.booking_settings_repo import BookingSettingsRepository
from app.domain.repositories.organization_repo import OrganizationRepository
from app.domain.repositories.task_repo import TaskRepository
from app.infrastructure.database.orm_models import AnnouncementORM, BookingORM, TaskORM
from app.infrastructure.repositories.postgres_activity_repo import (
    PostgresActivityLogRepository,
    record_activity,
)


class BookingSettingsService:
    """
    Coordinates clinic working hours, planned closures, emergency booking pause modes,
    public availability contracts, and bulk reschedule task orchestration.
    """

    def __init__(
        self,
        repository: BookingSettingsRepository,
        booking_repo: BookingRepository,
        task_repo: TaskRepository,
        session: AsyncSession,
        org_repo: Optional[OrganizationRepository] = None,
        activity_repo: Optional[PostgresActivityLogRepository] = None,
    ):
        self.repository = repository
        self.booking_repo = booking_repo
        self.task_repo = task_repo
        self.session = session
        self.org_repo = org_repo
        self.activity_repo = activity_repo

    async def get_public_booking_status(self) -> PublicBookingStatusResponse:
        """
        Public endpoint contract: returns mode, notice message, clinic phone, and resume_on.
        Never leaks personal patient or staff data.
        """
        settings = await self.repository.get_settings()
        phone = "(312) 555-0147"
        if self.org_repo:
            try:
                org = await self.org_repo.get_organization()
                if org and org.contact_phone:
                    phone = org.contact_phone
            except Exception:
                pass

        return PublicBookingStatusResponse(
            mode=settings.booking_mode,
            message=settings.pause_message,
            phone=phone,
            resumeOn=settings.resume_on,
        )

    async def get_public_working_hours(self) -> List[WorkingHoursDto]:
        """
        Returns structured operating hours across all 7 days of the week.
        """
        hours = await self.repository.list_working_hours()
        return [
            WorkingHoursDto(
                id=h.id,
                dayOfWeek=h.day_of_week,
                dayName=h.day_name,
                openTime=h.open_time,
                closeTime=h.close_time,
                isClosed=h.is_closed,
            )
            for h in hours
        ]

    async def get_public_schedule(self) -> Dict[str, Any]:
        """
        Consolidated schedule data for public date-pickers: status, working hours, closures, advance window.
        """
        status_info = await self.get_public_booking_status()
        hours = await self.get_public_working_hours()
        closures = await self.repository.list_closures(future_only=True)
        settings = await self.repository.get_settings()

        return {
            "status": status_info.model_dump(),
            "workingHours": [h.model_dump() for h in hours],
            "closures": [
                {
                    "id": str(c.id),
                    "startDate": c.start_date.isoformat(),
                    "endDate": c.end_date.isoformat(),
                    "reason": c.reason,
                    "message": c.message,
                }
                for c in closures
            ],
            "advanceBookingDays": settings.advance_booking_days,
            "closedDays": [h.dayOfWeek for h in hours if h.isClosed],
        }

    async def get_admin_settings(self) -> BookingSettingsResponse:
        settings = await self.repository.get_settings()
        today = date.today()
        is_resume_passed = bool(settings.resume_on and settings.resume_on < today and settings.booking_mode != "open")
        return BookingSettingsResponse(
            id=settings.id,
            bookingMode=settings.booking_mode,
            pauseMessage=settings.pause_message,
            pauseStartedAt=settings.pause_started_at,
            pauseStartedByUserId=settings.pause_started_by_user_id,
            resumeOn=settings.resume_on,
            advanceBookingDays=settings.advance_booking_days,
            minLeadTimeHours=getattr(settings, "min_lead_time_hours", 2) or 2,
            slotIntervalMinutes=settings.slot_interval_minutes,
            reminderTemplate=settings.reminder_template,
            waitingThresholdMinutes=getattr(settings, "waiting_threshold_minutes", 15) or 15,
            fileNumberPrefix=getattr(settings, "file_number_prefix", "MD-") or "MD-",
            paymentsEnabled=getattr(settings, "payments_enabled", False) or False,
            isResumePassed=is_resume_passed,
        )

    async def update_booking_mode(
        self,
        mode: str,
        message: Optional[str] = None,
        resume_on: Optional[date] = None,
        user_id: Optional[UUID] = None,
    ) -> Tuple[BookingSettingsResponse, List[AffectedBookingDto]]:
        """
        Switches clinic booking mode between 'open', 'paused', and 'closed'.
        Synchronizes automatic public marquee announcement banner and returns affected bookings.
        """
        if mode not in ("open", "paused", "closed"):
            raise HTTPException(
                status_code=http_status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid booking mode '{mode}'. Must be 'open', 'paused', or 'closed'.",
            )

        current = await self.repository.get_settings()
        before_state = {
            "mode": current.booking_mode,
            "message": current.pause_message,
            "resume_on": current.resume_on.isoformat() if current.resume_on else None,
        }

        now = datetime.now(timezone.utc)
        current.booking_mode = mode
        current.pause_message = message if mode != "open" else None
        current.resume_on = resume_on if mode != "open" else None
        if mode != "open":
            current.pause_started_at = now
            current.pause_started_by_user_id = user_id
        else:
            current.pause_started_at = None
            current.pause_started_by_user_id = None

        updated_settings = await self.repository.update_settings(current)

        # Synchronize automatic announcement banner
        await self._sync_auto_announcement(mode, message)

        # Identify affected bookings if pausing or closing
        affected: List[AffectedBookingDto] = []
        if mode in ("paused", "closed"):
            affected = await self.get_affected_bookings(
                start_date=date.today(),
                end_date=resume_on,
            )

        after_state = {
            "mode": updated_settings.booking_mode,
            "message": updated_settings.pause_message,
            "resume_on": updated_settings.resume_on.isoformat() if updated_settings.resume_on else None,
            "affected_count": len(affected),
        }

        await record_activity(
            self.activity_repo,
            action="update_booking_mode",
            entity_type="clinic_booking_settings",
            entity_id=str(updated_settings.id),
            user_id=user_id,
            details={"before": before_state, "after": after_state},
        )

        today = date.today()
        is_resume_passed = bool(
            updated_settings.resume_on and updated_settings.resume_on < today and updated_settings.booking_mode != "open"
        )

        resp = BookingSettingsResponse(
            id=updated_settings.id,
            bookingMode=updated_settings.booking_mode,
            pauseMessage=updated_settings.pause_message,
            pauseStartedAt=updated_settings.pause_started_at,
            pauseStartedByUserId=updated_settings.pause_started_by_user_id,
            resumeOn=updated_settings.resume_on,
            advanceBookingDays=updated_settings.advance_booking_days,
            slotIntervalMinutes=updated_settings.slot_interval_minutes,
            reminderTemplate=updated_settings.reminder_template,
            waitingThresholdMinutes=getattr(updated_settings, "waiting_threshold_minutes", 15) or 15,
            fileNumberPrefix=getattr(updated_settings, "file_number_prefix", "MD-") or "MD-",
            paymentsEnabled=getattr(updated_settings, "payments_enabled", False) or False,
            isResumePassed=is_resume_passed,
        )

        return resp, affected

    async def _sync_auto_announcement(self, mode: str, message: Optional[str]) -> None:
        """
        Automatically displays pause/closure notice in marquee banner without overwriting manual announcements.
        Removes auto banner upon reopening.
        """
        # Look for existing auto announcement
        stmt = select(AnnouncementORM).where(AnnouncementORM.is_auto_booking_banner.is_(True))
        res = await self.session.execute(stmt)
        auto_ann = res.scalar_one_or_none()

        if mode in ("paused", "closed"):
            notice_text = message or "Online booking is temporarily paused. Please call our clinic to schedule."
            if auto_ann:
                auto_ann.content = notice_text
                auto_ann.is_active = True
                auto_ann.display_order = -100  # Prioritize at front
                auto_ann.updated_at = datetime.now(timezone.utc)
            else:
                auto_ann = AnnouncementORM(
                    id=uuid4(),
                    content=notice_text,
                    is_active=True,
                    display_order=-100,
                    is_auto_booking_banner=True,
                )
                self.session.add(auto_ann)
        else:
            # Reopening: Deactivate auto banner, keeping manual announcements untouched
            if auto_ann:
                auto_ann.is_active = False
                auto_ann.updated_at = datetime.now(timezone.utc)

        await self.session.flush()

    async def get_affected_bookings(
        self,
        start_date: date,
        end_date: Optional[date] = None,
        team_member_id: Optional[UUID] = None,
    ) -> List[AffectedBookingDto]:
        """
        Finds existing non-cancelled future bookings scheduled in the specified date window.
        """
        stmt = select(BookingORM).where(
            BookingORM.preferred_date >= start_date,
            BookingORM.status.not_in(["cancelled", "no_show"]),
        )
        if end_date:
            stmt = stmt.where(BookingORM.preferred_date <= end_date)
        if team_member_id:
            stmt = stmt.where(BookingORM.team_member_id == team_member_id)
        stmt = stmt.order_by(BookingORM.preferred_date.asc(), BookingORM.preferred_time.asc())

        res = await self.session.execute(stmt)
        bookings = res.scalars().all()

        return [
            AffectedBookingDto(
                id=b.id,
                confirmationId=b.confirmation_id,
                patientFullName=b.patient_full_name,
                patientPhone=b.patient_phone,
                patientEmail=b.patient_email,
                preferredDate=b.preferred_date,
                preferredTime=b.preferred_time,
                serviceId=b.service_id,
                status=b.status,
            )
            for b in bookings
        ]

    async def create_reschedule_tasks(
        self,
        booking_ids: List[UUID],
        user_id: Optional[UUID] = None,
    ) -> List[UUID]:
        """
        Creates exactly one reception task per affected booking:
        'Call to reschedule: <patient> (<date>)', high priority.
        Idempotent: running multiple times never duplicates tasks.
        NEVER moves or cancels bookings automatically.
        """
        if not booking_ids:
            return []

        # Find bookings
        stmt = select(BookingORM).where(BookingORM.id.in_(booking_ids))
        res = await self.session.execute(stmt)
        bookings = res.scalars().all()

        # Find existing tasks linked to these bookings with reschedule prefix
        task_stmt = select(TaskORM).where(
            TaskORM.booking_id.in_(booking_ids),
            TaskORM.title.like("Call to reschedule:%"),
        )
        task_res = await self.session.execute(task_stmt)
        existing_tasks = task_res.scalars().all()
        already_handled_booking_ids = {t.booking_id for t in existing_tasks if t.booking_id}

        created_task_ids: List[UUID] = []
        for b in bookings:
            if b.id in already_handled_booking_ids:
                continue

            task_id = uuid4()
            title = f"Call to reschedule: {b.patient_full_name} ({b.preferred_date.isoformat()})"
            task_orm = TaskORM(
                id=task_id,
                clinic_id=b.clinic_id,
                patient_id=b.patient_id,
                booking_id=b.id,
                title=title,
                description=f"Booking {b.confirmation_id} at {b.preferred_time} needs rescheduling due to clinic closure or emergency booking pause.",
                priority="high",
                status="pending",
                due_date=datetime.now(timezone.utc),
            )
            self.session.add(task_orm)
            created_task_ids.append(task_id)

        await self.session.flush()

        # Audit
        await record_activity(
            self.activity_repo,
            action="create_bulk_reschedule_tasks",
            entity_type="tasks",
            user_id=user_id,
            details={
                "requested_booking_ids": [str(bid) for bid in booking_ids],
                "tasks_created_count": len(created_task_ids),
                "created_task_ids": [str(tid) for tid in created_task_ids],
            },
        )

        return created_task_ids

    async def list_closures(self) -> List[ClinicClosureDto]:
        closures = await self.repository.list_closures()
        return [
            ClinicClosureDto(
                id=c.id,
                startDate=c.start_date,
                endDate=c.end_date,
                reason=c.reason,
                message=c.message,
                createdAt=c.created_at,
            )
            for c in closures
        ]

    async def create_closure(
        self,
        start_date: date,
        end_date: date,
        reason: str,
        message: Optional[str] = None,
        user_id: Optional[UUID] = None,
    ) -> Tuple[ClinicClosureDto, List[AffectedBookingDto]]:
        """
        Creates planned calendar closure, discovers affected bookings, and audits creation.
        """
        if end_date < start_date:
            raise HTTPException(
                status_code=http_status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Closure end date cannot be earlier than start date.",
            )

        closure_id = uuid4()
        closure = ClinicClosure(
            id=closure_id,
            start_date=start_date,
            end_date=end_date,
            reason=reason.strip(),
            message=message.strip() if message else None,
            created_by_user_id=user_id,
        )
        saved = await self.repository.save_closure(closure)

        # Discover affected bookings during closure window
        affected = await self.get_affected_bookings(start_date=start_date, end_date=end_date)

        # Audit
        await record_activity(
            self.activity_repo,
            action="create_clinic_closure",
            entity_type="clinic_closures",
            entity_id=str(saved.id),
            user_id=user_id,
            details={
                "startDate": saved.start_date.isoformat(),
                "endDate": saved.end_date.isoformat(),
                "reason": saved.reason,
                "affected_count": len(affected),
            },
        )

        dto = ClinicClosureDto(
            id=saved.id,
            startDate=saved.start_date,
            endDate=saved.end_date,
            reason=saved.reason,
            message=saved.message,
            createdAt=saved.created_at,
        )
        return dto, affected

    async def update_closure(
        self,
        closure_id: UUID,
        start_date: date,
        end_date: date,
        reason: str,
        message: Optional[str] = None,
        user_id: Optional[UUID] = None,
    ) -> ClinicClosureDto:
        existing = await self.repository.get_closure(closure_id)
        if not existing:
            raise HTTPException(status_code=http_status.HTTP_404_NOT_FOUND, detail="Closure not found")

        if end_date < start_date:
            raise HTTPException(
                status_code=http_status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Closure end date cannot be earlier than start date.",
            )

        before = {
            "startDate": existing.start_date.isoformat(),
            "endDate": existing.end_date.isoformat(),
            "reason": existing.reason,
        }

        existing.start_date = start_date
        existing.end_date = end_date
        existing.reason = reason.strip()
        existing.message = message.strip() if message else None

        saved = await self.repository.save_closure(existing)

        after = {
            "startDate": saved.start_date.isoformat(),
            "endDate": saved.end_date.isoformat(),
            "reason": saved.reason,
        }

        await record_activity(
            self.activity_repo,
            action="update_clinic_closure",
            entity_type="clinic_closures",
            entity_id=str(saved.id),
            user_id=user_id,
            details={"before": before, "after": after},
        )

        return ClinicClosureDto(
            id=saved.id,
            startDate=saved.start_date,
            endDate=saved.end_date,
            reason=saved.reason,
            message=saved.message,
            createdAt=saved.created_at,
        )

    async def delete_closure(self, closure_id: UUID, user_id: Optional[UUID] = None) -> bool:
        existing = await self.repository.get_closure(closure_id)
        if not existing:
            raise HTTPException(status_code=http_status.HTTP_404_NOT_FOUND, detail="Closure not found")

        details = {
            "startDate": existing.start_date.isoformat(),
            "endDate": existing.end_date.isoformat(),
            "reason": existing.reason,
        }

        deleted = await self.repository.delete_closure(closure_id)

        await record_activity(
            self.activity_repo,
            action="delete_clinic_closure",
            entity_type="clinic_closures",
            entity_id=str(closure_id),
            user_id=user_id,
            details=details,
        )

        return deleted

    async def update_working_hours(
        self,
        updates: List[Dict[str, Any]],
        user_id: Optional[UUID] = None,
    ) -> List[WorkingHoursDto]:
        current = await self.repository.list_working_hours()
        current_map = {h.id: h for h in current}

        before_summary = [
            {"day": h.day_of_week, "is_closed": h.is_closed, "open": h.open_time, "close": h.close_time}
            for h in current
        ]

        modified: List[WorkingHours] = []
        for u in updates:
            hid = u["id"]
            if hid in current_map:
                wh = current_map[hid]
                wh.open_time = u.get("openTime")
                wh.close_time = u.get("closeTime")
                wh.is_closed = bool(u.get("isClosed", False))
                modified.append(wh)

        saved = await self.repository.update_working_hours(modified)

        after_summary = [
            {"day": h.day_of_week, "is_closed": h.is_closed, "open": h.open_time, "close": h.close_time}
            for h in saved
        ]

        await record_activity(
            self.activity_repo,
            action="update_clinic_working_hours",
            entity_type="clinic_working_hours",
            user_id=user_id,
            details={"before": before_summary, "after": after_summary},
        )

        return [
            WorkingHoursDto(
                id=h.id,
                dayOfWeek=h.day_of_week,
                dayName=h.day_name,
                openTime=h.open_time,
                closeTime=h.close_time,
                isClosed=h.is_closed,
            )
            for h in saved
        ]

    async def update_online_booking_rules(
        self,
        slot_interval_minutes: int,
        min_lead_time_hours: int,
        advance_booking_days: int,
        reminder_template: Optional[str] = None,
        waiting_threshold_minutes: Optional[int] = None,
        file_number_prefix: Optional[str] = None,
        payments_enabled: Optional[bool] = None,
        user_id: Optional[UUID] = None,
    ) -> BookingSettingsResponse:
        current = await self.repository.get_settings()
        before_state = {
            "slot_interval_minutes": current.slot_interval_minutes,
            "min_lead_time_hours": current.min_lead_time_hours,
            "advance_booking_days": current.advance_booking_days,
            "reminder_template": current.reminder_template,
            "waiting_threshold_minutes": getattr(current, "waiting_threshold_minutes", 15) or 15,
            "file_number_prefix": getattr(current, "file_number_prefix", "MD-") or "MD-",
            "payments_enabled": getattr(current, "payments_enabled", False) or False,
        }
        current.slot_interval_minutes = slot_interval_minutes
        current.min_lead_time_hours = min_lead_time_hours
        current.advance_booking_days = advance_booking_days
        if reminder_template is not None:
            current.reminder_template = reminder_template
        if waiting_threshold_minutes is not None:
            current.waiting_threshold_minutes = waiting_threshold_minutes
        if file_number_prefix is not None:
            current.file_number_prefix = file_number_prefix.strip()
        if payments_enabled is not None:
            current.payments_enabled = payments_enabled
        updated = await self.repository.update_settings(current)

        await record_activity(
            self.activity_repo,
            action="update_online_booking_rules",
            entity_type="clinic_booking_settings",
            entity_id=str(updated.id),
            user_id=user_id,
            details={
                "before": before_state,
                "after": {
                    "slot_interval_minutes": updated.slot_interval_minutes,
                    "min_lead_time_hours": updated.min_lead_time_hours,
                    "advance_booking_days": updated.advance_booking_days,
                    "reminder_template": updated.reminder_template,
                    "waiting_threshold_minutes": updated.waiting_threshold_minutes,
                    "file_number_prefix": updated.file_number_prefix,
                    "payments_enabled": updated.payments_enabled,
                },
            },
        )
        return await self.get_admin_settings()

    async def update_reminder_template(
        self,
        template: str,
        user_id: Optional[UUID] = None,
    ) -> BookingSettingsResponse:
        current = await self.repository.get_settings()
        before_state = {"reminder_template": current.reminder_template}
        current.reminder_template = template
        updated = await self.repository.update_settings(current)

        await record_activity(
            self.activity_repo,
            action="update_reminder_template",
            entity_type="clinic_booking_settings",
            entity_id=str(updated.id),
            user_id=user_id,
            details={
                "before": before_state,
                "after": {"reminder_template": updated.reminder_template},
            },
        )
        return await self.get_admin_settings()

    async def list_provider_availabilities(
        self,
        team_member_id: Optional[UUID] = None,
    ) -> List[ProviderAvailabilityDto]:
        avails = await self.repository.list_provider_availabilities(team_member_id=team_member_id)
        day_names = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
        return [
            ProviderAvailabilityDto(
                id=a.id,
                teamMemberId=a.team_member_id,
                dayOfWeek=a.day_of_week,
                dayName=day_names[a.day_of_week] if 0 <= a.day_of_week < 7 else f"Day {a.day_of_week}",
                startTime=a.start_time,
                endTime=a.end_time,
                breakStartTime=a.break_start_time,
                breakEndTime=a.break_end_time,
                isActive=a.is_active,
            )
            for a in avails
        ]

    async def save_provider_availability(
        self,
        req: ProviderAvailabilityCreateRequest,
        user_id: Optional[UUID] = None,
    ) -> Tuple[ProviderAvailabilityDto, List[AffectedBookingDto]]:
        domain = ProviderAvailability(
            id=uuid4(),
            team_member_id=req.teamMemberId,
            day_of_week=req.dayOfWeek,
            start_time=req.startTime,
            end_time=req.endTime,
            break_start_time=req.breakStartTime,
            break_end_time=req.breakEndTime,
            is_active=req.isActive,
        )
        saved = await self.repository.save_provider_availability(domain)
        today = date.today()
        affected = await self.get_affected_bookings(start_date=today, team_member_id=req.teamMemberId)

        await record_activity(
            self.activity_repo,
            action="save_provider_availability",
            entity_type="provider_availability",
            entity_id=str(saved.id),
            user_id=user_id,
            details={
                "team_member_id": str(saved.team_member_id),
                "day_of_week": saved.day_of_week,
                "start_time": saved.start_time,
                "end_time": saved.end_time,
            },
        )
        day_names = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
        dto = ProviderAvailabilityDto(
            id=saved.id,
            teamMemberId=saved.team_member_id,
            dayOfWeek=saved.day_of_week,
            dayName=day_names[saved.day_of_week] if 0 <= saved.day_of_week < 7 else f"Day {saved.day_of_week}",
            startTime=saved.start_time,
            endTime=saved.end_time,
            breakStartTime=saved.break_start_time,
            breakEndTime=saved.break_end_time,
            isActive=saved.is_active,
        )
        return dto, affected

    async def delete_provider_availability(
        self,
        avail_id: UUID,
        user_id: Optional[UUID] = None,
    ) -> bool:
        deleted = await self.repository.delete_provider_availability(avail_id)
        if deleted:
            await record_activity(
                self.activity_repo,
                action="delete_provider_availability",
                entity_type="provider_availability",
                entity_id=str(avail_id),
                user_id=user_id,
            )
        return deleted

    async def list_provider_time_off(
        self,
        team_member_id: Optional[UUID] = None,
        future_only: bool = False,
    ) -> List[ProviderTimeOffDto]:
        items = await self.repository.list_provider_time_off(team_member_id=team_member_id, future_only=future_only)
        return [
            ProviderTimeOffDto(
                id=t.id,
                teamMemberId=t.team_member_id,
                startDate=t.start_date,
                endDate=t.end_date,
                reason=t.reason,
                isApproved=t.is_approved,
            )
            for t in items
        ]

    async def save_provider_time_off(
        self,
        req: ProviderTimeOffCreateRequest,
        user_id: Optional[UUID] = None,
    ) -> Tuple[ProviderTimeOffDto, List[AffectedBookingDto]]:
        domain = ProviderTimeOff(
            id=uuid4(),
            team_member_id=req.teamMemberId,
            start_date=req.startDate,
            end_date=req.endDate,
            reason=req.reason,
            is_approved=req.isApproved,
        )
        saved = await self.repository.save_provider_time_off(domain)
        affected = await self.get_affected_bookings(
            start_date=req.startDate,
            end_date=req.endDate,
            team_member_id=req.teamMemberId,
        )

        await record_activity(
            self.activity_repo,
            action="save_provider_time_off",
            entity_type="provider_time_off",
            entity_id=str(saved.id),
            user_id=user_id,
            details={
                "team_member_id": str(saved.team_member_id),
                "start_date": saved.start_date.isoformat(),
                "end_date": saved.end_date.isoformat(),
                "reason": saved.reason,
                "affected_count": len(affected),
            },
        )
        dto = ProviderTimeOffDto(
            id=saved.id,
            teamMemberId=saved.team_member_id,
            startDate=saved.start_date,
            endDate=saved.end_date,
            reason=saved.reason,
            isApproved=saved.is_approved,
        )
        return dto, affected

    async def delete_provider_time_off(
        self,
        time_off_id: UUID,
        user_id: Optional[UUID] = None,
    ) -> bool:
        deleted = await self.repository.delete_provider_time_off(time_off_id)
        if deleted:
            await record_activity(
                self.activity_repo,
                action="delete_provider_time_off",
                entity_type="provider_time_off",
                entity_id=str(time_off_id),
                user_id=user_id,
            )
        return deleted

