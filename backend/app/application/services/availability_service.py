from datetime import date, datetime, timedelta, timezone
import re
from typing import List, Optional, Tuple, Union
from uuid import UUID
from zoneinfo import ZoneInfo

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.domain.repositories.booking_settings_repo import BookingSettingsRepository
from app.infrastructure.database.orm_models import (
    BookingORM,
    ServiceORM,
    TeamMemberORM,
)


def parse_duration_to_minutes(duration_str: Optional[str]) -> int:
    if not duration_str:
        return 30
    m = re.search(r"(\d+(?:\.\d+)?)\s*(h|hr|hour|min|m)?", duration_str.lower())
    if not m:
        return 30
    val = float(m.group(1))
    unit = m.group(2) or "min"
    if "h" in unit:
        return int(val * 60)
    return int(val)


def parse_time_to_minutes(time_str: Optional[str]) -> Optional[int]:
    if not time_str or not time_str.strip():
        return None
    s = time_str.strip().upper()
    m = re.match(r"^(\d{1,2})(?::(\d{2}))?\s*(AM|PM)?$", s)
    if not m:
        return None
    hours = int(m.group(1))
    minutes = int(m.group(2)) if m.group(2) else 0
    ampm = m.group(3)

    if ampm == "AM":
        if hours == 12:
            hours = 0
        elif hours > 12:
            return None
    elif ampm == "PM":
        if hours < 12:
            hours += 12
        elif hours > 12:
            return None
    else:
        if hours > 23 or minutes > 59:
            return None

    if minutes > 59:
        return None
    return hours * 60 + minutes


def format_minutes_to_time(minutes: int) -> str:
    h = (minutes // 60) % 24
    m = minutes % 60
    ampm = "AM" if h < 12 else "PM"
    h12 = h % 12
    if h12 == 0:
        h12 = 12
    return f"{h12:02d}:{m:02d} {ampm}"


class AvailabilityService:
    """
    Core availability calculation engine.
    Calculates candidate booking slots considering clinic working hours, clinician shifts,
    split shifts, breaks, closures, approved clinician time off, service durations, buffers,
    lead times, advance booking windows, and existing bookings in Asia/Karachi timezone.
    """

    def __init__(
        self,
        booking_settings_repo: BookingSettingsRepository,
        session: AsyncSession,
        timezone_str: str = "Asia/Karachi",
    ):
        self.booking_settings_repo = booking_settings_repo
        self.session = session
        try:
            self.tz = ZoneInfo(timezone_str)
        except Exception:
            self.tz = timezone(timedelta(hours=5))

    async def get_available_slots(
        self,
        target_date: date,
        service_id: Optional[Union[UUID, str]] = None,
        team_member_id: Optional[UUID] = None,
        enforce_lead_time: bool = True,
    ) -> List[str]:
        now_local = datetime.now(self.tz)
        today_local = now_local.date()

        # 1. Date cannot be in the past
        if target_date < today_local:
            return []

        # 2. Settings check (advance booking days and booking mode)
        settings = await self.booking_settings_repo.get_settings()
        if settings.booking_mode != "open":
            return []

        if target_date > today_local + timedelta(days=settings.advance_booking_days):
            return []

        # 3. Clinic closures check
        closures = await self.booking_settings_repo.list_closures()
        for c in closures:
            if c.start_date <= target_date <= c.end_date:
                return []

        # 4. Clinic working hours for day of week
        dow = target_date.weekday()  # 0=Monday .. 6=Sunday
        working_hours = await self.booking_settings_repo.list_working_hours()
        wh = next((h for h in working_hours if h.day_of_week == dow), None)
        if not wh or wh.is_closed or not wh.open_time or not wh.close_time:
            return []

        clinic_open_mins = parse_time_to_minutes(wh.open_time)
        clinic_close_mins = parse_time_to_minutes(wh.close_time)
        if clinic_open_mins is None or clinic_close_mins is None or clinic_close_mins <= clinic_open_mins:
            return []

        # 5. Service attributes (duration, buffer, online bookability)
        duration_minutes = 30
        buffer_minutes = 0
        service_provider_links = []
        if service_id:
            svc = None
            if isinstance(service_id, UUID):
                svc = await self.session.get(ServiceORM, service_id)
            else:
                try:
                    svc = await self.session.get(ServiceORM, UUID(str(service_id)))
                except (ValueError, TypeError):
                    stmt = select(ServiceORM).where(ServiceORM.slug == str(service_id).strip().lower())
                    svc_res = await self.session.execute(stmt)
                    svc = svc_res.scalars().first()

            if svc:
                if not svc.is_active or not svc.is_public or not getattr(svc, "bookable_online", True):
                    return []
                duration_minutes = parse_duration_to_minutes(svc.duration)
                buffer_minutes = getattr(svc, "buffer_minutes", 0) or 0
                service_provider_links = await self.booking_settings_repo.list_service_providers(service_id=svc.id)
            else:
                duration_minutes = 30
                buffer_minutes = 0
                service_provider_links = []

        slot_interval = settings.slot_interval_minutes or 15

        # 6. Eligible clinicians
        eligible_provider_ids = [l.team_member_id for l in service_provider_links]
        if team_member_id:
            if eligible_provider_ids and team_member_id not in eligible_provider_ids:
                return []
            # Check if this clinician is on approved time off
            time_offs = await self.booking_settings_repo.list_provider_time_off(team_member_id=team_member_id)
            for to in time_offs:
                if to.is_approved and to.start_date <= target_date <= to.end_date:
                    return []
            candidate_clinicians = [team_member_id]
        else:
            if eligible_provider_ids:
                pool = eligible_provider_ids
            else:
                tm_res = await self.session.execute(
                    select(TeamMemberORM.id).where(TeamMemberORM.is_active.is_(True))
                )
                pool = list(tm_res.scalars().all())

            candidate_clinicians = []
            for cid in pool:
                c_tos = await self.booking_settings_repo.list_provider_time_off(team_member_id=cid)
                if not any(to.is_approved and to.start_date <= target_date <= to.end_date for to in c_tos):
                    candidate_clinicians.append(cid)

            # If no clinicians configured at all in database, fall back to general clinic schedule
            if not candidate_clinicians and not pool:
                candidate_clinicians = [None]
            elif not candidate_clinicians:
                return []

        # 7. Pre-load clinician schedules & breaks
        # Map: clinician_id -> list of shifts (start, end) and list of breaks (start, end)
        clinician_shifts_map = {}
        clinician_breaks_map = {}

        for cid in candidate_clinicians:
            if cid is None:
                clinician_shifts_map[cid] = [(clinic_open_mins, clinic_close_mins)]
                clinician_breaks_map[cid] = []
            else:
                avails = await self.booking_settings_repo.list_provider_availabilities(team_member_id=cid)
                day_avails = [a for a in avails if a.is_active and a.day_of_week == dow]
                if avails and not day_avails:
                    # Clinician has custom weekly schedule configured, but is off today
                    clinician_shifts_map[cid] = []
                    clinician_breaks_map[cid] = []
                elif day_avails:
                    s_list = []
                    b_list = []
                    for a in day_avails:
                        s_st = max(clinic_open_mins, parse_time_to_minutes(a.start_time) or clinic_open_mins)
                        s_en = min(clinic_close_mins, parse_time_to_minutes(a.end_time) or clinic_close_mins)
                        if s_en > s_st:
                            s_list.append((s_st, s_en))
                        if a.break_start_time and a.break_end_time:
                            b_st = parse_time_to_minutes(a.break_start_time)
                            b_en = parse_time_to_minutes(a.break_end_time)
                            if b_st is not None and b_en is not None and b_en > b_st:
                                b_list.append((b_st, b_en))
                    clinician_shifts_map[cid] = s_list
                    clinician_breaks_map[cid] = b_list
                else:
                    # Fallback to clinic working hours
                    clinician_shifts_map[cid] = [(clinic_open_mins, clinic_close_mins)]
                    clinician_breaks_map[cid] = []

        # Filter out clinicians who have no active shifts today
        working_clinicians = [
            cid for cid in candidate_clinicians if clinician_shifts_map.get(cid)
        ]
        if not working_clinicians:
            return []

        # 8. Pre-load existing non-cancelled bookings on this target date
        bk_stmt = select(BookingORM).where(
            BookingORM.preferred_date == target_date,
            BookingORM.status.not_in(["cancelled", "no_show"]),
        )
        bk_res = await self.session.execute(bk_stmt)
        existing_bookings = list(bk_res.scalars().all())

        # Cache booking start and end minutes
        existing_intervals = []
        for b in existing_bookings:
            b_start = parse_time_to_minutes(b.preferred_time)
            if b_start is not None:
                b_dur = 30
                b_buf = 0
                if b.service_id:
                    try:
                        svc_orm = await self.session.get(ServiceORM, UUID(str(b.service_id)))
                        if svc_orm:
                            b_dur = parse_duration_to_minutes(svc_orm.duration)
                            b_buf = getattr(svc_orm, "buffer_minutes", 0) or 0
                    except Exception:
                        pass
                b_end = b_start + b_dur + b_buf
                existing_intervals.append((b.team_member_id, b_start, b_end))

        # 9. Lead time threshold
        min_allowed_time = None
        if enforce_lead_time and target_date == today_local:
            min_allowed_time = now_local.hour * 60 + now_local.minute + (settings.min_lead_time_hours * 60)

        # 10. Generate slots from clinic_open_mins to clinic_close_mins
        available_slots: List[str] = []
        cand_start = clinic_open_mins

        while cand_start + duration_minutes <= clinic_close_mins:
            # Check lead time
            if min_allowed_time is not None and cand_start < min_allowed_time:
                cand_start += slot_interval
                continue

            cand_end = cand_start + duration_minutes
            cand_occupied_end = cand_start + duration_minutes + buffer_minutes

            # Check if at least one clinician can fulfill this slot
            slot_can_be_taken = False
            for cid in working_clinicians:
                shifts = clinician_shifts_map.get(cid, [])
                breaks = clinician_breaks_map.get(cid, [])

                # A. Must fit within at least one shift
                in_shift = False
                for s_st, s_en in shifts:
                    if cand_start >= s_st and cand_end <= s_en:
                        in_shift = True
                        break
                if not in_shift:
                    continue

                # B. Must not overlap any breaks
                overlap_break = False
                for b_st, b_en in breaks:
                    if not (cand_end <= b_st or cand_start >= b_en):
                        overlap_break = True
                        break
                if overlap_break:
                    continue

                # C. Must not overlap any existing booking of this clinician (or general booking)
                overlap_booking = False
                for tm_id, b_st, b_en in existing_intervals:
                    if cid is None or tm_id is None or tm_id == cid:
                        if not (cand_occupied_end <= b_st or cand_start >= b_en):
                            overlap_booking = True
                            break
                if overlap_booking:
                    continue

                # Clinician is available for this slot!
                slot_can_be_taken = True
                break

            if slot_can_be_taken:
                available_slots.append(format_minutes_to_time(cand_start))

            cand_start += slot_interval

        return available_slots

    async def is_slot_available(
        self,
        target_date: date,
        time_str: str,
        service_id: Optional[Union[UUID, str]] = None,
        team_member_id: Optional[UUID] = None,
        enforce_lead_time: bool = False,
    ) -> bool:
        slots = await self.get_available_slots(
            target_date=target_date,
            service_id=service_id,
            team_member_id=team_member_id,
            enforce_lead_time=enforce_lead_time,
        )
        norm_time = parse_time_to_minutes(time_str)
        if norm_time is None:
            return False
        return any(parse_time_to_minutes(s) == norm_time for s in slots)
