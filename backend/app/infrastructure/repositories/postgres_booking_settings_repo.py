from datetime import date, datetime, timezone
from typing import List, Optional
from uuid import UUID, uuid4

from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.domain.models.booking_settings import (
    BookingSettings,
    ClinicClosure,
    ProviderAvailability,
    ProviderTimeOff,
    ServiceProviderLink,
    WorkingHours,
)
from app.domain.repositories.booking_settings_repo import BookingSettingsRepository
from app.infrastructure.database.orm_models import (
    ClinicBookingSettingsORM,
    ClinicClosureORM,
    ClinicWorkingHoursORM,
    ProviderAvailabilityORM,
    ProviderTimeOffORM,
    ServiceProviderORM,
)


class PostgresBookingSettingsRepository(BookingSettingsRepository):
    """
    SQLAlchemy 2.0 PostgreSQL repository for working hours, booking settings, closures, and provider schedules.
    """

    def __init__(self, session: AsyncSession):
        self.session = session

    async def get_settings(self, clinic_id: Optional[UUID] = None) -> BookingSettings:
        stmt = select(ClinicBookingSettingsORM)
        if clinic_id:
            stmt = stmt.where(ClinicBookingSettingsORM.clinic_id == clinic_id)
        stmt = stmt.order_by(ClinicBookingSettingsORM.created_at.asc()).limit(1)
        res = await self.session.execute(stmt)
        orm = res.scalar_one_or_none()

        if not orm:
            return BookingSettings(
                id=uuid4(),
                booking_mode="open",
                advance_booking_days=60,
                min_lead_time_hours=2,
                slot_interval_minutes=15,
                file_number_prefix="MD-",
                clinic_id=clinic_id,
            )

        return BookingSettings(
            id=orm.id,
            booking_mode=orm.booking_mode,
            pause_message=orm.pause_message,
            pause_started_at=orm.pause_started_at,
            pause_started_by_user_id=orm.pause_started_by_user_id,
            resume_on=orm.resume_on,
            advance_booking_days=orm.advance_booking_days,
            min_lead_time_hours=getattr(orm, "min_lead_time_hours", 2) or 2,
            slot_interval_minutes=orm.slot_interval_minutes,
            reminder_template=getattr(orm, "reminder_template", None),
            reminder_template_urdu=getattr(orm, "reminder_template_urdu", None),
            reminder_24h_enabled=getattr(orm, "reminder_24h_enabled", True) if getattr(orm, "reminder_24h_enabled", None) is not None else True,
            reminder_2h_enabled=getattr(orm, "reminder_2h_enabled", True) if getattr(orm, "reminder_2h_enabled", None) is not None else True,
            waiting_threshold_minutes=getattr(orm, "waiting_threshold_minutes", 15) or 15,
            file_number_prefix=getattr(orm, "file_number_prefix", "MD-") or "MD-",
            payments_enabled=getattr(orm, "payments_enabled", True) if getattr(orm, "payments_enabled", None) is not None else True,
            quiet_hours_enabled=getattr(orm, "quiet_hours_enabled", True) if getattr(orm, "quiet_hours_enabled", None) is not None else True,
            quiet_hours_start=getattr(orm, "quiet_hours_start", "21:00") or "21:00",
            quiet_hours_end=getattr(orm, "quiet_hours_end", "08:00") or "08:00",
            messaging_provider_mode=getattr(orm, "messaging_provider_mode", "simulated") or "simulated",
            clinic_id=orm.clinic_id,
            created_at=orm.created_at,
            updated_at=orm.updated_at,
        )

    async def update_settings(self, settings: BookingSettings) -> BookingSettings:
        stmt = select(ClinicBookingSettingsORM).where(ClinicBookingSettingsORM.id == settings.id)
        res = await self.session.execute(stmt)
        orm = res.scalar_one_or_none()
        if not orm:
            orm = ClinicBookingSettingsORM(id=settings.id)
            self.session.add(orm)

        orm.booking_mode = settings.booking_mode
        orm.pause_message = settings.pause_message
        orm.pause_started_at = settings.pause_started_at
        orm.pause_started_by_user_id = settings.pause_started_by_user_id
        orm.resume_on = settings.resume_on
        orm.advance_booking_days = settings.advance_booking_days
        orm.min_lead_time_hours = settings.min_lead_time_hours
        orm.slot_interval_minutes = settings.slot_interval_minutes
        orm.reminder_template = settings.reminder_template
        orm.reminder_template_urdu = getattr(settings, "reminder_template_urdu", None)
        orm.reminder_24h_enabled = getattr(settings, "reminder_24h_enabled", True)
        orm.reminder_2h_enabled = getattr(settings, "reminder_2h_enabled", True)
        orm.waiting_threshold_minutes = settings.waiting_threshold_minutes
        orm.file_number_prefix = getattr(settings, "file_number_prefix", "MD-") or "MD-"
        orm.payments_enabled = getattr(settings, "payments_enabled", True)
        orm.quiet_hours_enabled = getattr(settings, "quiet_hours_enabled", True)
        orm.quiet_hours_start = getattr(settings, "quiet_hours_start", "21:00") or "21:00"
        orm.quiet_hours_end = getattr(settings, "quiet_hours_end", "08:00") or "08:00"
        orm.messaging_provider_mode = getattr(settings, "messaging_provider_mode", "simulated") or "simulated"
        orm.clinic_id = settings.clinic_id
        orm.updated_at = datetime.now(timezone.utc)

        await self.session.flush()
        return BookingSettings(
            id=orm.id,
            booking_mode=orm.booking_mode,
            pause_message=orm.pause_message,
            pause_started_at=orm.pause_started_at,
            pause_started_by_user_id=orm.pause_started_by_user_id,
            resume_on=orm.resume_on,
            advance_booking_days=orm.advance_booking_days,
            min_lead_time_hours=orm.min_lead_time_hours,
            slot_interval_minutes=orm.slot_interval_minutes,
            reminder_template=orm.reminder_template,
            reminder_template_urdu=getattr(orm, "reminder_template_urdu", None),
            reminder_24h_enabled=getattr(orm, "reminder_24h_enabled", True),
            reminder_2h_enabled=getattr(orm, "reminder_2h_enabled", True),
            waiting_threshold_minutes=orm.waiting_threshold_minutes,
            file_number_prefix=getattr(orm, "file_number_prefix", "MD-") or "MD-",
            payments_enabled=getattr(orm, "payments_enabled", True),
            quiet_hours_enabled=getattr(orm, "quiet_hours_enabled", True),
            quiet_hours_start=getattr(orm, "quiet_hours_start", "21:00") or "21:00",
            quiet_hours_end=getattr(orm, "quiet_hours_end", "08:00") or "08:00",
            messaging_provider_mode=getattr(orm, "messaging_provider_mode", "simulated") or "simulated",
            clinic_id=orm.clinic_id,
            created_at=orm.created_at,
            updated_at=orm.updated_at,
        )

    async def list_working_hours(self, clinic_id: Optional[UUID] = None) -> List[WorkingHours]:
        stmt = select(ClinicWorkingHoursORM)
        if clinic_id:
            stmt = stmt.where(ClinicWorkingHoursORM.clinic_id == clinic_id)
        stmt = stmt.order_by(ClinicWorkingHoursORM.day_of_week.asc())
        res = await self.session.execute(stmt)
        orms = res.scalars().all()

        if not orms:
            # Fallback default 7 days (Sunday closed) without writing to session during read
            defaults = [
                (0, "08:00", "18:00", False),
                (1, "08:00", "18:00", False),
                (2, "08:00", "18:00", False),
                (3, "08:00", "18:00", False),
                (4, "08:00", "14:00", False),
                (5, "09:00", "13:00", False),
                (6, None, None, True),
            ]
            return [
                WorkingHours(
                    id=uuid4(),
                    day_of_week=dow,
                    open_time=op_t,
                    close_time=cl_t,
                    is_closed=is_cl,
                    clinic_id=clinic_id,
                )
                for dow, op_t, cl_t, is_cl in defaults
            ]

        return [
            WorkingHours(
                id=o.id,
                day_of_week=o.day_of_week,
                open_time=o.open_time,
                close_time=o.close_time,
                is_closed=o.is_closed,
                clinic_id=o.clinic_id,
                created_at=o.created_at,
                updated_at=o.updated_at,
            )
            for o in orms
        ]

    async def update_working_hours(self, hours: List[WorkingHours]) -> List[WorkingHours]:
        updated_list = []
        for h in hours:
            stmt = select(ClinicWorkingHoursORM).where(ClinicWorkingHoursORM.id == h.id)
            res = await self.session.execute(stmt)
            orm = res.scalar_one_or_none()
            if not orm:
                orm = ClinicWorkingHoursORM(
                    id=h.id,
                    clinic_id=h.clinic_id,
                    day_of_week=h.day_of_week,
                )
                self.session.add(orm)
            orm.open_time = h.open_time
            orm.close_time = h.close_time
            orm.is_closed = h.is_closed
            orm.updated_at = datetime.now(timezone.utc)
            await self.session.flush()
            updated_list.append(
                WorkingHours(
                    id=orm.id,
                    day_of_week=orm.day_of_week,
                    open_time=orm.open_time,
                    close_time=orm.close_time,
                    is_closed=orm.is_closed,
                    clinic_id=orm.clinic_id,
                    created_at=orm.created_at,
                    updated_at=orm.updated_at,
                )
            )
        return updated_list

    async def list_closures(self, clinic_id: Optional[UUID] = None, future_only: bool = False) -> List[ClinicClosure]:
        stmt = select(ClinicClosureORM)
        if clinic_id:
            stmt = stmt.where(ClinicClosureORM.clinic_id == clinic_id)
        if future_only:
            today = date.today()
            stmt = stmt.where(ClinicClosureORM.end_date >= today)
        stmt = stmt.order_by(ClinicClosureORM.start_date.asc())
        res = await self.session.execute(stmt)
        orms = res.scalars().all()
        return [
            ClinicClosure(
                id=o.id,
                start_date=o.start_date,
                end_date=o.end_date,
                reason=o.reason,
                message=o.message,
                clinic_id=o.clinic_id,
                created_by_user_id=o.created_by_user_id,
                created_at=o.created_at,
                updated_at=o.updated_at,
            )
            for o in orms
        ]

    async def get_closure(self, closure_id: UUID) -> Optional[ClinicClosure]:
        stmt = select(ClinicClosureORM).where(ClinicClosureORM.id == closure_id)
        res = await self.session.execute(stmt)
        o = res.scalar_one_or_none()
        if not o:
            return None
        return ClinicClosure(
            id=o.id,
            start_date=o.start_date,
            end_date=o.end_date,
            reason=o.reason,
            message=o.message,
            clinic_id=o.clinic_id,
            created_by_user_id=o.created_by_user_id,
            created_at=o.created_at,
            updated_at=o.updated_at,
        )

    async def save_closure(self, closure: ClinicClosure) -> ClinicClosure:
        stmt = select(ClinicClosureORM).where(ClinicClosureORM.id == closure.id)
        res = await self.session.execute(stmt)
        o = res.scalar_one_or_none()
        if not o:
            o = ClinicClosureORM(
                id=closure.id,
                created_at=datetime.now(timezone.utc),
            )
            self.session.add(o)

        o.start_date = closure.start_date
        o.end_date = closure.end_date
        o.reason = closure.reason
        o.message = closure.message
        o.clinic_id = closure.clinic_id
        o.created_by_user_id = closure.created_by_user_id
        o.updated_at = datetime.now(timezone.utc)
        await self.session.flush()

        return ClinicClosure(
            id=o.id,
            start_date=o.start_date,
            end_date=o.end_date,
            reason=o.reason,
            message=o.message,
            clinic_id=o.clinic_id,
            created_by_user_id=o.created_by_user_id,
            created_at=o.created_at,
            updated_at=o.updated_at,
        )

    async def delete_closure(self, closure_id: UUID) -> bool:
        stmt = delete(ClinicClosureORM).where(ClinicClosureORM.id == closure_id)
        res = await self.session.execute(stmt)
        await self.session.flush()
        return res.rowcount > 0

    async def list_provider_availabilities(self, team_member_id: Optional[UUID] = None) -> List[ProviderAvailability]:
        stmt = select(ProviderAvailabilityORM)
        if team_member_id:
            stmt = stmt.where(ProviderAvailabilityORM.team_member_id == team_member_id)
        stmt = stmt.order_by(ProviderAvailabilityORM.day_of_week.asc())
        res = await self.session.execute(stmt)
        orms = res.scalars().all()
        return [
            ProviderAvailability(
                id=o.id,
                team_member_id=o.team_member_id,
                day_of_week=o.day_of_week,
                start_time=o.start_time,
                end_time=o.end_time,
                break_start_time=o.break_start_time,
                break_end_time=o.break_end_time,
                is_active=o.is_active,
                created_at=o.created_at,
                updated_at=o.updated_at,
            )
            for o in orms
        ]

    async def save_provider_availability(self, avail: ProviderAvailability) -> ProviderAvailability:
        stmt = select(ProviderAvailabilityORM).where(ProviderAvailabilityORM.id == avail.id)
        res = await self.session.execute(stmt)
        o = res.scalar_one_or_none()
        if not o:
            o = ProviderAvailabilityORM(
                id=avail.id,
                team_member_id=avail.team_member_id,
                created_at=datetime.now(timezone.utc),
            )
            self.session.add(o)

        o.day_of_week = avail.day_of_week
        o.start_time = avail.start_time
        o.end_time = avail.end_time
        o.break_start_time = avail.break_start_time
        o.break_end_time = avail.break_end_time
        o.is_active = avail.is_active
        o.updated_at = datetime.now(timezone.utc)
        await self.session.flush()
        return ProviderAvailability(
            id=o.id,
            team_member_id=o.team_member_id,
            day_of_week=o.day_of_week,
            start_time=o.start_time,
            end_time=o.end_time,
            break_start_time=o.break_start_time,
            break_end_time=o.break_end_time,
            is_active=o.is_active,
            created_at=o.created_at,
            updated_at=o.updated_at,
        )

    async def delete_provider_availability(self, avail_id: UUID) -> bool:
        stmt = delete(ProviderAvailabilityORM).where(ProviderAvailabilityORM.id == avail_id)
        res = await self.session.execute(stmt)
        await self.session.flush()
        return res.rowcount > 0

    async def list_provider_time_off(
        self,
        team_member_id: Optional[UUID] = None,
        future_only: bool = False,
    ) -> List[ProviderTimeOff]:
        stmt = select(ProviderTimeOffORM)
        if team_member_id:
            stmt = stmt.where(ProviderTimeOffORM.team_member_id == team_member_id)
        if future_only:
            today = date.today()
            stmt = stmt.where(ProviderTimeOffORM.end_date >= today)
        stmt = stmt.order_by(ProviderTimeOffORM.start_date.asc())
        res = await self.session.execute(stmt)
        orms = res.scalars().all()
        return [
            ProviderTimeOff(
                id=o.id,
                team_member_id=o.team_member_id,
                start_date=o.start_date,
                end_date=o.end_date,
                reason=o.reason,
                is_approved=o.is_approved,
                created_at=o.created_at,
                updated_at=o.updated_at,
            )
            for o in orms
        ]

    async def save_provider_time_off(self, time_off: ProviderTimeOff) -> ProviderTimeOff:
        stmt = select(ProviderTimeOffORM).where(ProviderTimeOffORM.id == time_off.id)
        res = await self.session.execute(stmt)
        o = res.scalar_one_or_none()
        if not o:
            o = ProviderTimeOffORM(
                id=time_off.id,
                team_member_id=time_off.team_member_id,
                created_at=datetime.now(timezone.utc),
            )
            self.session.add(o)

        o.start_date = time_off.start_date
        o.end_date = time_off.end_date
        o.reason = time_off.reason
        o.is_approved = time_off.is_approved
        o.updated_at = datetime.now(timezone.utc)
        await self.session.flush()
        return ProviderTimeOff(
            id=o.id,
            team_member_id=o.team_member_id,
            start_date=o.start_date,
            end_date=o.end_date,
            reason=o.reason,
            is_approved=o.is_approved,
            created_at=o.created_at,
            updated_at=o.updated_at,
        )

    async def delete_provider_time_off(self, time_off_id: UUID) -> bool:
        stmt = delete(ProviderTimeOffORM).where(ProviderTimeOffORM.id == time_off_id)
        res = await self.session.execute(stmt)
        await self.session.flush()
        return res.rowcount > 0

    async def list_service_providers(
        self,
        service_id: Optional[UUID] = None,
        team_member_id: Optional[UUID] = None,
    ) -> List[ServiceProviderLink]:
        stmt = select(ServiceProviderORM)
        if service_id:
            stmt = stmt.where(ServiceProviderORM.service_id == service_id)
        if team_member_id:
            stmt = stmt.where(ServiceProviderORM.team_member_id == team_member_id)
        res = await self.session.execute(stmt)
        orms = res.scalars().all()
        return [
            ServiceProviderLink(
                id=o.id,
                service_id=o.service_id,
                team_member_id=o.team_member_id,
                created_at=o.created_at,
            )
            for o in orms
        ]

    async def set_service_providers(self, service_id: UUID, team_member_ids: List[UUID]) -> None:
        del_stmt = delete(ServiceProviderORM).where(ServiceProviderORM.service_id == service_id)
        await self.session.execute(del_stmt)
        for tm_id in team_member_ids:
            self.session.add(
                ServiceProviderORM(
                    service_id=service_id,
                    team_member_id=tm_id,
                    created_at=datetime.now(timezone.utc),
                )
            )
        await self.session.flush()

