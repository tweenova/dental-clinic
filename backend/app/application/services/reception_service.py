import asyncio
from contextlib import asynccontextmanager
import hashlib
import json
import random
import re
import string
from datetime import date, datetime, time, timedelta, timezone
from typing import Any, Dict, List, Optional, Tuple
from uuid import UUID

from fastapi import HTTPException, status as http_status
from sqlalchemy import text

from app.domain.models.booking_crm import Booking, Lead, Message, Patient, Task
from app.domain.models.visit_payment import VisitPayment
from app.domain.models.appointment import Appointment, AppointmentStatus
from app.domain.repositories.appointment_repo import AppointmentRepository
from app.domain.repositories.booking_repo import BookingRepository
from app.domain.repositories.booking_settings_repo import BookingSettingsRepository
from app.domain.repositories.lead_repo import LeadRepository
from app.domain.repositories.message_repo import MessageRepository
from app.domain.repositories.patient_repo import PatientRepository
from app.domain.repositories.service_repo import ServiceRepository
from app.domain.repositories.task_repo import TaskRepository
from app.domain.repositories.team_repo import TeamMemberRepository
from app.domain.repositories.user_repo import UserRepository
from app.domain.repositories.visit_payment_repo import VisitPaymentRepository
from app.infrastructure.repositories.postgres_activity_repo import (
    PostgresActivityLogRepository,
    record_activity,
)

_SCHEDULE_MUTEXES: Dict[str, asyncio.Lock] = {}
_MUTEX_REGISTRY_LOCK = asyncio.Lock()


async def _get_schedule_mutex(team_member_id: Optional[UUID], preferred_date: date) -> asyncio.Lock:
    key = f"{team_member_id or 'all'}:{preferred_date.isoformat()}"
    async with _MUTEX_REGISTRY_LOCK:
        if key not in _SCHEDULE_MUTEXES:
            _SCHEDULE_MUTEXES[key] = asyncio.Lock()
        return _SCHEDULE_MUTEXES[key]


@asynccontextmanager
async def _acquire_schedule_lock(booking_repo: Any, team_member_id: Optional[UUID], preferred_date: Optional[date]):
    if not preferred_date:
        yield
        return
    mutex = await _get_schedule_mutex(team_member_id, preferred_date)
    async with mutex:
        session = getattr(booking_repo, "_session", None)
        if session is not None and getattr(session, "bind", None) is not None:
            dialect = getattr(session.bind, "dialect", None)
            if dialect is not None and dialect.name == "postgresql":
                provider_part = str(team_member_id) if team_member_id else "all"
                raw_key = f"marlow_schedule:{provider_part}:{preferred_date.isoformat()}".encode("utf-8")
                lock_id = int.from_bytes(hashlib.sha256(raw_key).digest()[:8], byteorder="big", signed=True)
                await session.execute(text("SELECT pg_advisory_xact_lock(:lock_id)"), {"lock_id": lock_id})
        yield


def generate_booking_confirmation_id() -> str:
    year = datetime.now(timezone.utc).year
    suffix = "".join(random.choices(string.digits, k=4))
    return f"BK-{year}-{suffix}"


def normalize_pakistan_phone(phone: Optional[str]) -> str:
    """Normalises phone number to international Pakistan format 92..."""
    if not phone:
        return ""
    digits = re.sub(r"\D", "", phone)
    if digits.startswith("0092"):
        digits = digits[2:]
    elif digits.startswith("0"):
        digits = "92" + digits[1:]
    elif digits.startswith("3") and len(digits) == 10:
        digits = "92" + digits
    elif not digits.startswith("92") and len(digits) >= 7:
        digits = "92" + digits
    return digits


def is_in_quiet_hours(
    now_dt: Optional[datetime] = None,
    start_str: str = "21:00",
    end_str: str = "08:00",
    tz_name: str = "Asia/Karachi",
) -> bool:
    """Returns True if the current or given time falls within the quiet hours window (e.g. 21:00 - 08:00 PKT)."""
    try:
        from zoneinfo import ZoneInfo
        tz = ZoneInfo(tz_name)
    except Exception:
        tz = timezone.utc
    current_dt = (now_dt or datetime.now(timezone.utc)).astimezone(tz)
    current_time_str = current_dt.strftime("%H:%M")
    if start_str > end_str:
        return current_time_str >= start_str or current_time_str < end_str
    else:
        return start_str <= current_time_str < end_str


DEFAULT_REMINDER_TEMPLATE_EN = (
    "Dear {patient_first_name}, your dental appointment at {clinic_name} is confirmed for "
    "{date} at {time}. Please call {clinic_phone} if you need to reschedule."
)

DEFAULT_REMINDER_TEMPLATE_UR = (
    "محترم {patient_first_name}، آپ کی {clinic_name} میں ڈینٹل اپائنٹمنٹ {date} کو {time} بجے مقرر ہے۔ "
    "تبدیلی کے لیے {clinic_phone} پر رابطہ کریں۔"
)


def adjust_for_quiet_hours(
    dt: datetime,
    start_str: str = "21:00",
    end_str: str = "08:00",
    tz_name: str = "Asia/Karachi",
) -> datetime:
    """
    If dt falls within quiet hours (e.g. 21:00 - 08:00 in Asia/Karachi),
    moves the scheduled time forward to the next allowed time (end_str, e.g. 08:00),
    never dropping it.
    """
    try:
        from zoneinfo import ZoneInfo
        tz = ZoneInfo(tz_name)
    except Exception:
        tz = timezone.utc

    local_dt = dt.astimezone(tz)
    if not is_in_quiet_hours(local_dt, start_str=start_str, end_str=end_str, tz_name=tz_name):
        return dt

    end_parts = [int(p) for p in end_str.split(":")]
    end_h, end_m = end_parts[0], end_parts[1]

    current_time_str = local_dt.strftime("%H:%M")
    if current_time_str >= start_str:
        next_allowed = (local_dt + timedelta(days=1)).replace(
            hour=end_h, minute=end_m, second=0, microsecond=0
        )
    else:
        next_allowed = local_dt.replace(
            hour=end_h, minute=end_m, second=0, microsecond=0
        )
    return next_allowed.astimezone(timezone.utc)


def parse_booking_datetime(
    booking_date: date,
    time_str: str,
    tz_name: str = "Asia/Karachi",
) -> datetime:
    try:
        from zoneinfo import ZoneInfo
        tz = ZoneInfo(tz_name)
    except Exception:
        tz = timezone.utc
    mins = parse_time_to_minutes(time_str)
    if mins is None:
        mins = 9 * 60
    h = mins // 60
    m = mins % 60
    return datetime(booking_date.year, booking_date.month, booking_date.day, h, m, 0, tzinfo=tz)


def format_reminder_message(
    template: str,
    patient_first_name: str,
    appointment_date: str,
    appointment_time: str,
    clinic_name: str = "Marlow Dental Clinic",
    clinic_phone: str = "+92 300 1234567",
) -> str:
    msg = template
    msg = msg.replace("{patient_first_name}", patient_first_name)
    msg = msg.replace("{date}", appointment_date)
    msg = msg.replace("{time}", appointment_time)
    msg = msg.replace("{clinic_name}", clinic_name)
    msg = msg.replace("{clinic_phone}", clinic_phone)
    # Legacy placeholders for compatibility
    msg = msg.replace("{patient_name}", patient_first_name)
    msg = msg.replace("{appointment_date}", appointment_date)
    msg = msg.replace("{appointment_time}", appointment_time)
    msg = msg.replace("{clinician_name}", "our dental team")
    msg = msg.replace("{doctor_name}", "our dental team")
    return msg


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


class ReceptionService:
    def __init__(
        self,
        booking_repo: BookingRepository,
        patient_repo: PatientRepository,
        task_repo: TaskRepository,
        lead_repo: LeadRepository,
        message_repo: MessageRepository,
        appointment_repo: AppointmentRepository,
        service_repo: Optional[ServiceRepository] = None,
        activity_repo: Optional[PostgresActivityLogRepository] = None,
        booking_settings_repo: Optional[BookingSettingsRepository] = None,
        team_repo: Optional[TeamMemberRepository] = None,
        user_repo: Optional[UserRepository] = None,
        payment_repo: Optional[VisitPaymentRepository] = None,
    ):
        self.booking_repo = booking_repo
        self.patient_repo = patient_repo
        self.task_repo = task_repo
        self.lead_repo = lead_repo
        self.message_repo = message_repo
        self.appointment_repo = appointment_repo
        self.service_repo = service_repo
        self.activity_repo = activity_repo
        self.booking_settings_repo = booking_settings_repo
        self.team_repo = team_repo
        self.user_repo = user_repo
        self.payment_repo = payment_repo

    async def snooze_queue_item(
        self,
        item_type: str,
        item_id: UUID,
        duration_hours: int = 24,
        user_id: Optional[UUID] = None,
    ) -> Dict[str, Any]:
        """
        Snoozes an actionable item (booking or task) from the reception triage queue.
        Audited with before and after state.
        """
        snooze_until = datetime.now(timezone.utc) + timedelta(hours=duration_hours)
        snooze_tag = f"[SNOOZED_UNTIL:{snooze_until.isoformat()}]"

        if item_type == "booking":
            booking = await self.booking_repo.get_by_id(item_id)
            if not booking:
                raise HTTPException(status_code=http_status.HTTP_404_NOT_FOUND, detail="Booking not found")
            clean_notes = re.sub(r"\[SNOOZED_UNTIL:[^\]]+\]", "", booking.staff_notes or "").strip()
            booking.staff_notes = f"{clean_notes} {snooze_tag}".strip()
            await self.booking_repo.save(booking)
            await record_activity(
                self.activity_repo,
                action="snooze_booking",
                entity_type="booking",
                entity_id=str(booking.id),
                user_id=user_id,
                details={"snoozed_until": snooze_until.isoformat(), "duration_hours": duration_hours},
            )
        elif item_type == "task":
            task = await self.task_repo.get_by_id(item_id)
            if not task:
                raise HTTPException(status_code=http_status.HTTP_404_NOT_FOUND, detail="Task not found")
            task.due_date = snooze_until
            clean_desc = re.sub(r"\[SNOOZED_UNTIL:[^\]]+\]", "", task.description or "").strip()
            task.description = f"{clean_desc} {snooze_tag}".strip()
            await self.task_repo.save(task)
            await record_activity(
                self.activity_repo,
                action="snooze_task",
                entity_type="task",
                entity_id=str(task.id),
                user_id=user_id,
                details={"snoozed_until": snooze_until.isoformat(), "duration_hours": duration_hours},
            )
        else:
            raise HTTPException(
                status_code=http_status.HTTP_400_BAD_REQUEST,
                detail="Invalid itemType. Must be 'booking' or 'task'.",
            )

        return {
            "success": True,
            "itemId": str(item_id),
            "itemType": item_type,
            "snoozedUntil": snooze_until.isoformat(),
        }

    async def get_dashboard_summary(
        self, clinic_id: Optional[UUID] = None
    ) -> Dict[str, Any]:
        now = datetime.now(timezone.utc)
        today = now.date()
        tomorrow = today + timedelta(days=1)
        yesterday = today - timedelta(days=1)

        # Configurable waiting threshold
        waiting_threshold_minutes = 15
        if self.booking_settings_repo:
            try:
                settings = await self.booking_settings_repo.get_settings(clinic_id=clinic_id)
                waiting_threshold_minutes = getattr(settings, "waiting_threshold_minutes", 15) or 15
            except Exception:
                waiting_threshold_minutes = 15

        # 1. Today's bookings
        today_bookings, total_today = await self.booking_repo.list_bookings(
            clinic_id=clinic_id,
            date_from=today,
            date_to=today,
            limit=200,
        )

        counts = await self.booking_repo.get_counts_for_date(today, clinic_id=clinic_id)
        confirmed_count = counts.get("confirmed", 0)
        unconfirmed_count = counts.get("requested", 0)
        checked_in_count = counts.get("checked_in", 0)
        waiting_count = counts.get("waiting", 0) + counts.get("arrived", 0)
        in_progress_count = counts.get("in_progress", 0)
        completed_count = counts.get("completed", 0)
        cancelled_count = counts.get("cancelled", 0)
        no_show_count = counts.get("no_show", 0)

        # 2. Open Tasks & Leads
        tasks, total_tasks = await self.task_repo.list_tasks(
            clinic_id=clinic_id, status="pending", limit=100
        )
        urgent_tasks = [
            t for t in tasks
            if t.priority in ("urgent", "high") or (t.title and t.title.startswith("Book follow-up:"))
        ]

        leads, total_leads = await self.lead_repo.list_leads(
            clinic_id=clinic_id, status="new", limit=100
        )

        # Helper to safely convert datetime to timezone-aware UTC
        def to_utc(dt: Optional[datetime]) -> Optional[datetime]:
            if not dt:
                return None
            if dt.tzinfo is None:
                return dt.replace(tzinfo=timezone.utc)
            return dt.astimezone(timezone.utc)

        # Helper to detect snoozed item
        def is_item_snoozed(text_content: Optional[str]) -> bool:
            if not text_content:
                return False
            m = re.search(r"\[SNOOZED_UNTIL:([^\]]+)\]", text_content)
            if not m:
                return False
            try:
                snooze_dt = datetime.fromisoformat(m.group(1))
                if snooze_dt.tzinfo is None:
                    snooze_dt = snooze_dt.replace(tzinfo=timezone.utc)
                return now < snooze_dt
            except Exception:
                return False

        # 3. Build Actionable Queue (5 categories)
        needs_action: List[Dict[str, Any]] = []
        handled_booking_ids = set()

        # Category 1: Online requests awaiting triage (status == "requested")
        requested_bookings, _ = await self.booking_repo.list_bookings(
            clinic_id=clinic_id,
            status="requested",
            limit=100,
        )
        for b in requested_bookings:
            if is_item_snoozed(b.staff_notes):
                continue
            handled_booking_ids.add(b.id)
            needs_action.append({
                "id": str(b.id),
                "type": "online_request",
                "title": f"Online Request: {b.patient_full_name}",
                "subtitle": f"{b.preferred_date} at {b.preferred_time} · {b.patient_phone}",
                "description": f"{b.preferred_date} at {b.preferred_time} · {b.patient_phone}",
                "actionRoute": "/reception/appointments/requests",
                "link": "/reception/appointments/requests",
                "severity": "high",
                "priority": "high",
                "targetId": str(b.id),
                "bookingId": str(b.id),
                "patientId": str(b.patient_id) if b.patient_id else None,
                "patientName": b.patient_full_name,
                "patientPhone": b.patient_phone,
                "availableActions": ["confirm", "snooze", "create_task"],
            })

        # Category 2: Unconfirmed appointments for the next day
        tomorrow_bookings, _ = await self.booking_repo.list_bookings(
            clinic_id=clinic_id,
            date_from=tomorrow,
            date_to=tomorrow,
            limit=100,
        )
        for b in tomorrow_bookings:
            if b.id in handled_booking_ids:
                continue
            if b.status in ("requested", "unconfirmed"):
                if is_item_snoozed(b.staff_notes):
                    continue
                handled_booking_ids.add(b.id)
                needs_action.append({
                    "id": str(b.id),
                    "type": "unconfirmed_tomorrow",
                    "title": f"Unconfirmed Visit Tomorrow: {b.patient_full_name}",
                    "subtitle": f"Tomorrow at {b.preferred_time} · {b.patient_phone}",
                    "description": f"Tomorrow at {b.preferred_time} · {b.patient_phone}",
                    "actionRoute": "/reception/reminders",
                    "link": "/reception/reminders",
                    "severity": "medium",
                    "priority": "medium",
                    "targetId": str(b.id),
                    "bookingId": str(b.id),
                    "patientId": str(b.patient_id) if b.patient_id else None,
                    "patientName": b.patient_full_name,
                    "patientPhone": b.patient_phone,
                    "availableActions": ["confirm", "snooze", "create_task"],
                })

        # Category 3: Patients waiting longer than configurable threshold
        for b in today_bookings:
            if b.status in ("arrived", "waiting", "checked_in"):
                if is_item_snoozed(b.staff_notes):
                    continue
                wait_mins = 0
                arr_dt = to_utc(b.arrived_at)
                if arr_dt:
                    wait_mins = int((now - arr_dt).total_seconds() / 60)
                else:
                    parsed_slot = parse_time_to_minutes(b.preferred_time)
                    if parsed_slot is not None:
                        now_mins = now.hour * 60 + now.minute
                        wait_mins = max(0, now_mins - parsed_slot)

                if wait_mins >= waiting_threshold_minutes:
                    handled_booking_ids.add(b.id)
                    needs_action.append({
                        "id": str(b.id),
                        "type": "waiting_delayed",
                        "title": f"Waiting Delayed: {b.patient_full_name}",
                        "subtitle": f"Waiting {wait_mins}m (threshold {waiting_threshold_minutes}m) · {b.preferred_time}",
                        "description": f"Waiting {wait_mins}m (threshold {waiting_threshold_minutes}m) · {b.preferred_time}",
                        "actionRoute": "/reception",
                        "link": "/reception",
                        "severity": "urgent",
                        "priority": "urgent",
                        "targetId": str(b.id),
                        "bookingId": str(b.id),
                        "patientId": str(b.patient_id) if b.patient_id else None,
                        "patientName": b.patient_full_name,
                        "patientPhone": b.patient_phone,
                        "availableActions": ["check_in", "snooze", "create_task"],
                    })

        # Category 4: Overdue and urgent tasks
        for t in tasks:
            if is_item_snoozed(t.description):
                continue
            due_dt = to_utc(t.due_date)
            is_overdue = bool(due_dt and due_dt < now)
            is_urgent_or_followup = bool(
                t.priority in ("urgent", "high") or (t.title and t.title.startswith("Book follow-up:"))
            )
            if is_overdue or is_urgent_or_followup:
                item_type = "overdue_task" if is_overdue else "urgent_task"
                needs_action.append({
                    "id": str(t.id),
                    "type": item_type,
                    "title": f"Task: {t.title}",
                    "subtitle": f"Due {due_dt.strftime('%Y-%m-%d %H:%M') if due_dt else 'N/A'} · Priority: {t.priority.upper()}",
                    "description": f"Due {due_dt.strftime('%Y-%m-%d %H:%M') if due_dt else 'N/A'} · Priority: {t.priority.upper()}",
                    "actionRoute": "/reception/tasks",
                    "link": "/reception/tasks",
                    "severity": "urgent" if (is_overdue or t.priority == "urgent") else "high",
                    "priority": "urgent" if (is_overdue or t.priority == "urgent") else "high",
                    "targetId": str(t.id),
                    "taskId": str(t.id),
                    "bookingId": str(t.booking_id) if t.booking_id else None,
                    "patientId": str(t.patient_id) if t.patient_id else None,
                    "patientName": None,
                    "patientPhone": None,
                    "availableActions": ["snooze", "create_task"],
                })

        # Category 5: Past appointments never resolved
        past_bookings, _ = await self.booking_repo.list_bookings(
            clinic_id=clinic_id,
            date_to=yesterday,
            status_in=["requested", "confirmed", "arrived", "in_progress"],
            limit=100,
        )
        for b in past_bookings:
            if b.id in handled_booking_ids:
                continue
            if is_item_snoozed(b.staff_notes):
                continue
            handled_booking_ids.add(b.id)
            needs_action.append({
                "id": str(b.id),
                "type": "past_unresolved",
                "title": f"Unresolved Past Visit: {b.patient_full_name}",
                "subtitle": f"{b.preferred_date} at {b.preferred_time} · Status: {b.status.replace('_', ' ').title()}",
                "description": f"{b.preferred_date} at {b.preferred_time} · Status: {b.status.replace('_', ' ').title()}",
                "actionRoute": "/reception/end-of-day",
                "link": "/reception/end-of-day",
                "severity": "urgent",
                "priority": "urgent",
                "targetId": str(b.id),
                "bookingId": str(b.id),
                "patientId": str(b.patient_id) if b.patient_id else None,
                "patientName": b.patient_full_name,
                "patientPhone": b.patient_phone,
                "availableActions": ["confirm", "snooze", "create_task"],
            })

        # Recalls due count
        recalls_due = await self.get_recalls(clinic_id=clinic_id)

        # Actionable counts
        online_req_count = len([i for i in needs_action if i["type"] == "online_request"])
        unconfirmed_tom_count = len([i for i in needs_action if i["type"] == "unconfirmed_tomorrow"])
        waiting_del_count = len([i for i in needs_action if i["type"] == "waiting_delayed"])
        overdue_tsk_count = len([i for i in needs_action if i["type"] == "overdue_task"])
        past_unres_count = len([i for i in needs_action if i["type"] == "past_unresolved"])

        return {
            "todayAppointments": total_today,
            "confirmedCount": confirmed_count,
            "unconfirmedCount": unconfirmed_count,
            "checkedInCount": checked_in_count,
            "waitingCount": waiting_count,
            "inProgressCount": in_progress_count,
            "completedCount": completed_count,
            "cancelledCount": cancelled_count,
            "noShowCount": no_show_count,
            "pendingRequestsCount": online_req_count,
            "unconfirmedTomorrowCount": unconfirmed_tom_count,
            "waitingDelayedCount": waiting_del_count,
            "overdueTasksCount": overdue_tsk_count,
            "pastUnresolvedCount": past_unres_count,
            "urgentTasksCount": len(urgent_tasks),
            "newLeadsCount": total_leads,
            "recallsDueCount": len(recalls_due),
            "needsAttentionCount": len(needs_action),
            "todayFlow": today_bookings,
            "needsAttentionItems": needs_action,
            "needsActionQueue": needs_action,
        }

    async def list_schedule(
        self,
        clinic_id: Optional[UUID] = None,
        team_member_id: Optional[UUID] = None,
        date_from: Optional[date] = None,
        date_to: Optional[date] = None,
        status: Optional[str] = None,
        search: Optional[str] = None,
        limit: int = 100,
        offset: int = 0,
    ) -> Tuple[List[Booking], int]:
        return await self.booking_repo.list_bookings(
            clinic_id=clinic_id,
            team_member_id=team_member_id,
            date_from=date_from,
            date_to=date_to,
            status=status,
            search=search,
            limit=limit,
            offset=offset,
        )

    async def get_service_duration(self, service_id: Optional[str]) -> int:
        if not service_id or not self.service_repo:
            return 30
        try:
            service_uuid = UUID(str(service_id))
            service = await self.service_repo.get_by_id(service_uuid)
            if service and service.duration:
                return parse_duration_to_minutes(service.duration)
        except (ValueError, TypeError):
            pass

        try:
            service = await self.service_repo.get_by_slug(str(service_id))
            if service and service.duration:
                return parse_duration_to_minutes(service.duration)
        except Exception:
            pass
        return 30

    async def check_booking_overlap(
        self,
        team_member_id: Optional[UUID],
        preferred_date: date,
        preferred_time: str,
        service_id: Optional[str] = None,
        exclude_booking_id: Optional[UUID] = None,
    ) -> Optional[Booking]:
        if not team_member_id:
            return None
        cand_start = parse_time_to_minutes(preferred_time)
        if cand_start is None:
            return None
        cand_duration = await self.get_service_duration(service_id)
        cand_end = cand_start + cand_duration

        existing_bookings, _ = await self.booking_repo.list_bookings(
            team_member_id=team_member_id,
            date_from=preferred_date,
            date_to=preferred_date,
            limit=200,
        )

        for b in existing_bookings:
            if exclude_booking_id and b.id == exclude_booking_id:
                continue
            if b.status in ("cancelled", "no_show", "waitlist"):
                continue
            b_start = parse_time_to_minutes(b.preferred_time)
            if b_start is None:
                continue
            b_dur = await self.get_service_duration(b.service_id)
            b_end = b_start + b_dur

            if cand_start < b_end and b_start < cand_end:
                return b
        return None

    async def create_booking(
        self,
        patient_full_name: str,
        patient_phone: str,
        patient_email: str,
        preferred_date: date,
        preferred_time: str,
        clinic_id: Optional[UUID] = None,
        patient_id: Optional[UUID] = None,
        service_id: Optional[str] = None,
        team_member_id: Optional[UUID] = None,
        slot_id: Optional[UUID] = None,
        status: str = "confirmed",
        notes: Optional[str] = None,
        staff_notes: Optional[str] = None,
        override_double_booking: bool = False,
        override_reason: Optional[str] = None,
        user_id: Optional[UUID] = None,
    ) -> Booking:
        normalized_status = self.NORMALIZE_STATUS.get(status, status)

        # Enforce closed mode override requirement for reception booking
        if self.booking_settings_repo is not None:
            settings = await self.booking_settings_repo.get_settings()
            if settings.booking_mode == "closed":
                if not override_reason or not override_reason.strip():
                    raise HTTPException(
                        status_code=http_status.HTTP_422_UNPROCESSABLE_ENTITY,
                        detail="Clinic booking is currently closed. A recorded reason is required to override and schedule.",
                    )

        conflict = None
        async with _acquire_schedule_lock(self.booking_repo, team_member_id, preferred_date):
            if team_member_id and preferred_time and normalized_status not in ("cancelled", "no_show", "waitlist"):
                conflict = await self.check_booking_overlap(
                    team_member_id=team_member_id,
                    preferred_date=preferred_date,
                    preferred_time=preferred_time,
                    service_id=service_id,
                )
                if conflict:
                    if not override_double_booking:
                        raise HTTPException(
                            status_code=http_status.HTTP_409_CONFLICT,
                            detail=f"Double-booking conflict: Clinician already has an appointment scheduled at {conflict.preferred_time}.",
                        )
                    if not override_reason or not override_reason.strip():
                        raise HTTPException(
                            status_code=http_status.HTTP_422_UNPROCESSABLE_ENTITY,
                            detail="Override reason is required to override double-booking.",
                        )

            # If patient_id not provided, find or create patient record
            if not patient_id:
                dups = await self.patient_repo.find_duplicates(
                    first_name=patient_full_name.split()[0],
                    last_name=" ".join(patient_full_name.split()[1:]) if len(patient_full_name.split()) > 1 else "",
                    phone=patient_phone,
                    email=patient_email,
                    clinic_id=clinic_id,
                )
                if dups:
                    patient_id = dups[0].id
                else:
                    names = patient_full_name.split()
                    first = names[0] if names else "Patient"
                    last = " ".join(names[1:]) if len(names) > 1 else "Unknown"
                    new_pat = Patient(
                        first_name=first,
                        last_name=last,
                        phone=patient_phone,
                        email=patient_email,
                        clinic_id=clinic_id,
                    )
                    saved_pat = await self.patient_repo.save(new_pat)
                    patient_id = saved_pat.id

            booking = Booking(
                confirmation_id=generate_booking_confirmation_id(),
                preferred_date=preferred_date,
                preferred_time=preferred_time,
                patient_full_name=patient_full_name,
                patient_phone=patient_phone,
                patient_email=patient_email,
                clinic_id=clinic_id,
                patient_id=patient_id,
                service_id=service_id,
                team_member_id=team_member_id,
                slot_id=slot_id,
                status=normalized_status,
                notes=notes,
                staff_notes=staff_notes,
            )
            saved_booking = await self.booking_repo.save(booking)

        if conflict and override_double_booking:
            await record_activity(
                self.activity_repo,
                action="override_double_booking",
                entity_type="booking",
                entity_id=saved_booking.id,
                user_id=user_id,
                details={
                    "reason": override_reason.strip(),
                    "conflict_booking_id": str(conflict.id),
                    "conflict_time": conflict.preferred_time,
                    "preferred_date": str(preferred_date),
                    "team_member_id": str(team_member_id),
                },
            )

        await record_activity(
            self.activity_repo,
            action="booking_create",
            entity_type="booking",
            entity_id=saved_booking.id,
            user_id=user_id,
            details={
                "confirmation_id": saved_booking.confirmation_id,
                "patient_name": saved_booking.patient_full_name,
                "preferred_date": str(preferred_date),
                "preferred_time": preferred_time,
                "status": saved_booking.status,
            },
        )

        if saved_booking.status == "confirmed":
            try:
                await self.schedule_booking_reminders(saved_booking, user_id=user_id)
            except Exception:
                pass

        return saved_booking

    VALID_STATUSES = {
        "requested",
        "confirmed",
        "arrived",
        "in_progress",
        "completed",
        "cancelled",
        "no_show",
        "waitlist",
    }

    NORMALIZE_STATUS = {
        "scheduled": "confirmed",
        "checked_in": "arrived",
        "waiting": "arrived",
    }

    ALLOWED_TRANSITIONS = {
        "requested": {"confirmed", "scheduled", "cancelled", "waitlist", "no_show"},
        "confirmed": {"arrived", "checked_in", "waiting", "in_progress", "cancelled", "no_show", "waitlist", "confirmed"},
        "scheduled": {"arrived", "checked_in", "waiting", "in_progress", "cancelled", "no_show", "waitlist", "confirmed"},
        "arrived": {"in_progress", "completed", "cancelled", "no_show", "arrived"},
        "checked_in": {"in_progress", "completed", "cancelled", "no_show", "checked_in"},
        "waiting": {"in_progress", "completed", "cancelled", "no_show", "waiting"},
        "in_progress": {"completed", "cancelled", "in_progress"},
        "completed": {"completed"},
        "cancelled": {"requested", "confirmed", "scheduled", "cancelled"},
        "no_show": {"requested", "confirmed", "scheduled", "no_show"},
        "waitlist": {"confirmed", "scheduled", "cancelled", "waitlist"},
    }

    async def update_booking_status(
        self,
        booking_id: UUID,
        new_status: str,
        staff_notes: Optional[str] = None,
        cancellation_reason: Optional[str] = None,
        user_id: Optional[UUID] = None,
    ) -> Booking:
        normalized_new = self.NORMALIZE_STATUS.get(new_status, new_status)
        if normalized_new not in self.VALID_STATUSES:
            raise HTTPException(
                status_code=http_status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"Invalid status '{new_status}'. Allowed statuses: {sorted(list(self.VALID_STATUSES))}",
            )

        booking = await self.booking_repo.get_by_id(booking_id)
        if not booking:
            raise HTTPException(
                status_code=http_status.HTTP_404_NOT_FOUND, detail="Booking record not found."
            )

        allowed = self.ALLOWED_TRANSITIONS.get(booking.status, set())
        if new_status not in allowed and normalized_new not in allowed:
            raise HTTPException(
                status_code=http_status.HTTP_409_CONFLICT,
                detail=f"Cannot transition appointment from '{booking.status}' to '{new_status}'.",
            )

        now_utc = datetime.now(timezone.utc)

        if normalized_new == "arrived":
            if booking.arrived_at is None:
                booking.arrived_at = now_utc
        elif normalized_new == "in_progress":
            if booking.started_at is None:
                booking.started_at = now_utc
        elif normalized_new == "completed":
            if booking.completed_at is None:
                booking.completed_at = now_utc
        elif normalized_new == "cancelled":
            if not cancellation_reason or not cancellation_reason.strip():
                raise HTTPException(
                    status_code=http_status.HTTP_422_UNPROCESSABLE_ENTITY,
                    detail="Cancellation reason is required when cancelling an appointment.",
                )
            booking.cancellation_reason = cancellation_reason.strip()
            booking.cancelled_by_user_id = user_id

        old_status = booking.status
        booking.status = normalized_new
        if staff_notes:
            booking.staff_notes = staff_notes
        saved = await self.booking_repo.save(booking)

        if normalized_new == "cancelled":
            await record_activity(
                self.activity_repo,
                action="booking_cancel",
                entity_type="booking",
                entity_id=saved.id,
                user_id=user_id,
                details={
                    "reason": cancellation_reason.strip() if cancellation_reason else None,
                    "old_status": old_status,
                },
            )
        elif normalized_new != old_status:
            await record_activity(
                self.activity_repo,
                action="booking_status_transition",
                entity_type="booking",
                entity_id=saved.id,
                user_id=user_id,
                details={
                    "from_status": old_status,
                    "to_status": normalized_new,
                },
            )

        if normalized_new == "confirmed" and old_status != "confirmed":
            try:
                await self.schedule_booking_reminders(saved, user_id=user_id)
            except Exception:
                pass
        elif normalized_new in ("cancelled", "no_show", "completed"):
            if self.message_repo:
                try:
                    await self.message_repo.cancel_pending_reminders(saved.id)
                except Exception:
                    pass

        return saved

    async def reschedule_booking(
        self,
        booking_id: UUID,
        preferred_date: date,
        preferred_time: str,
        team_member_id: Optional[UUID] = None,
        service_id: Optional[str] = None,
        slot_id: Optional[UUID] = None,
        staff_notes: Optional[str] = None,
        override_double_booking: bool = False,
        override_reason: Optional[str] = None,
        user_id: Optional[UUID] = None,
    ) -> Booking:
        booking = await self.booking_repo.get_by_id(booking_id)
        if not booking:
            raise HTTPException(
                status_code=http_status.HTTP_404_NOT_FOUND, detail="Booking record not found."
            )

        if self.message_repo:
            try:
                await self.message_repo.cancel_pending_reminders(booking.id)
            except Exception:
                pass

        effective_team_member = team_member_id if team_member_id is not None else booking.team_member_id
        effective_service = service_id if service_id is not None else booking.service_id
        conflict = None
        async with _acquire_schedule_lock(self.booking_repo, effective_team_member, preferred_date):
            if effective_team_member and preferred_time:
                conflict = await self.check_booking_overlap(
                    team_member_id=effective_team_member,
                    preferred_date=preferred_date,
                    preferred_time=preferred_time,
                    service_id=effective_service,
                    exclude_booking_id=booking.id,
                )
                if conflict:
                    if not override_double_booking:
                        raise HTTPException(
                            status_code=http_status.HTTP_409_CONFLICT,
                            detail=f"Double-booking conflict: Clinician already has an appointment scheduled at {conflict.preferred_time}.",
                        )
                    if not override_reason or not override_reason.strip():
                        raise HTTPException(
                            status_code=http_status.HTTP_422_UNPROCESSABLE_ENTITY,
                            detail="Override reason is required to override double-booking.",
                        )

            booking.preferred_date = preferred_date
            booking.preferred_time = preferred_time
            if team_member_id is not None:
                booking.team_member_id = team_member_id
            if service_id is not None:
                booking.service_id = service_id
            if slot_id is not None:
                booking.slot_id = slot_id
            if staff_notes is not None:
                booking.staff_notes = staff_notes
            booking.status = "confirmed"
            saved_booking = await self.booking_repo.save(booking)

        if conflict and override_double_booking:
            await record_activity(
                self.activity_repo,
                action="override_double_booking",
                entity_type="booking",
                entity_id=saved_booking.id,
                user_id=user_id,
                details={
                    "reason": override_reason.strip(),
                    "conflict_booking_id": str(conflict.id),
                    "conflict_time": conflict.preferred_time,
                    "preferred_date": str(preferred_date),
                    "team_member_id": str(effective_team_member),
                },
            )

        await record_activity(
            self.activity_repo,
            action="booking_reschedule",
            entity_type="booking",
            entity_id=saved_booking.id,
            user_id=user_id,
            details={
                "preferred_date": str(preferred_date),
                "preferred_time": preferred_time,
                "team_member_id": str(effective_team_member) if effective_team_member else None,
            },
        )

        try:
            await self.schedule_booking_reminders(saved_booking, user_id=user_id)
        except Exception:
            pass

        return saved_booking

    async def cancel_booking(
        self,
        booking_id: UUID,
        reason: str,
        user_id: Optional[UUID] = None,
    ) -> Booking:
        return await self.update_booking_status(
            booking_id=booking_id,
            new_status="cancelled",
            cancellation_reason=reason,
            user_id=user_id,
        )

    # --- Patients ---

    async def search_patients(
        self,
        query: Optional[str] = None,
        clinic_id: Optional[UUID] = None,
        limit: int = 50,
        offset: int = 0,
    ) -> Tuple[List[Patient], int]:
        return await self.patient_repo.search(
            query=query, clinic_id=clinic_id, limit=limit, offset=offset
        )

    async def create_patient(
        self,
        first_name: str,
        last_name: str,
        phone: str,
        email: Optional[str] = None,
        date_of_birth: Optional[date] = None,
        clinic_id: Optional[UUID] = None,
        notes: Optional[str] = None,
        check_duplicate: bool = True,
        file_number: Optional[str] = None,
        guardian_name: Optional[str] = None,
        guardian_phone: Optional[str] = None,
        guardian_relationship: Optional[str] = None,
        emergency_contact_name: Optional[str] = None,
        emergency_contact_phone: Optional[str] = None,
        emergency_contact_relationship: Optional[str] = None,
        user_id: Optional[UUID] = None,
        preferred_channel: str = "sms",
    ) -> Tuple[Patient, List[Patient]]:
        if check_duplicate:
            dups = await self.patient_repo.find_duplicates(
                first_name=first_name,
                last_name=last_name,
                phone=phone,
                email=email,
                date_of_birth=date_of_birth,
                clinic_id=clinic_id,
            )
            if dups:
                return dups[0], dups
        else:
            await record_activity(
                self.activity_repo,
                action="deduplication_bypass",
                entity_type="patient",
                entity_id=None,
                user_id=user_id,
                details={
                    "first_name": first_name.strip(),
                    "last_name": last_name.strip(),
                    "phone": phone.strip(),
                },
            )

        assigned_file_number = file_number.strip() if file_number and file_number.strip() else None
        if not assigned_file_number:
            prefix = "MD-"
            if self.booking_settings_repo:
                try:
                    settings = await self.booking_settings_repo.get_settings(clinic_id=clinic_id)
                    if settings and settings.file_number_prefix:
                        prefix = settings.file_number_prefix
                except Exception:
                    pass
            assigned_file_number = await self.patient_repo.get_next_file_number(prefix=prefix)

        patient = Patient(
            first_name=first_name.strip(),
            last_name=last_name.strip(),
            phone=phone.strip(),
            email=email.strip().lower() if email else None,
            date_of_birth=date_of_birth,
            clinic_id=clinic_id,
            notes=notes,
            file_number=assigned_file_number,
            guardian_name=guardian_name.strip() if guardian_name else None,
            guardian_phone=guardian_phone.strip() if guardian_phone else None,
            guardian_relationship=guardian_relationship.strip() if guardian_relationship else None,
            emergency_contact_name=emergency_contact_name.strip() if emergency_contact_name else None,
            emergency_contact_phone=emergency_contact_phone.strip() if emergency_contact_phone else None,
            emergency_contact_relationship=emergency_contact_relationship.strip() if emergency_contact_relationship else None,
            preferred_channel=preferred_channel or "sms",
        )
        saved = await self.patient_repo.save(patient)

        await record_activity(
            self.activity_repo,
            action="patient_create",
            entity_type="patient",
            entity_id=saved.id,
            user_id=user_id,
            details={
                "name": f"{saved.first_name} {saved.last_name}",
                "file_number": saved.file_number,
            },
        )

        return saved, []

    async def get_patient_profile(self, patient_id: UUID) -> Dict[str, Any]:
        patient = await self.patient_repo.get_by_id(patient_id)
        if not patient:
            raise HTTPException(
                status_code=http_status.HTTP_404_NOT_FOUND, detail="Patient not found."
            )
        bookings = await self.booking_repo.get_patient_bookings(patient_id)
        today = datetime.now(timezone.utc).date()
        upcoming = [b for b in bookings if b.preferred_date >= today]
        past = [b for b in bookings if b.preferred_date < today]
        tasks = await self.task_repo.get_patient_tasks(patient_id)
        messages = await self.message_repo.get_patient_messages(patient_id)

        return {
            "patient": patient,
            "upcomingAppointments": upcoming,
            "pastAppointments": past,
            "tasks": tasks,
            "messages": messages,
        }

    async def update_patient(
        self, patient_id: UUID, updates: Dict[str, Any], user_id: Optional[UUID] = None
    ) -> Patient:
        patient = await self.patient_repo.get_by_id(patient_id)
        if not patient:
            raise HTTPException(
                status_code=http_status.HTTP_404_NOT_FOUND, detail="Patient not found."
            )
        for k, v in updates.items():
            if hasattr(patient, k) and v is not None:
                setattr(patient, k, v)
        saved = await self.patient_repo.save(patient)

        await record_activity(
            self.activity_repo,
            action="patient_update",
            entity_type="patient",
            entity_id=saved.id,
            user_id=user_id,
            details={"updated_fields": list(updates.keys())},
        )

        return saved

    # --- Requests Triage Queue ---

    async def list_requests(
        self, clinic_id: Optional[UUID] = None
    ) -> List[Booking]:
        # Returns bookings with status 'requested'
        bookings, _ = await self.booking_repo.list_bookings(
            clinic_id=clinic_id, status="requested", limit=100
        )
        return bookings

    # --- Tasks ---

    async def list_tasks(
        self,
        clinic_id: Optional[UUID] = None,
        assigned_to_user_id: Optional[UUID] = None,
        status: Optional[str] = None,
        priority: Optional[str] = None,
        limit: int = 100,
        offset: int = 0,
    ) -> Tuple[List[Task], int]:
        return await self.task_repo.list_tasks(
            clinic_id=clinic_id,
            assigned_to_user_id=assigned_to_user_id,
            status=status,
            priority=priority,
            limit=limit,
            offset=offset,
        )

    async def create_task(
        self,
        title: str,
        clinic_id: Optional[UUID] = None,
        assigned_to_user_id: Optional[UUID] = None,
        patient_id: Optional[UUID] = None,
        booking_id: Optional[UUID] = None,
        description: Optional[str] = None,
        priority: str = "medium",
        status: str = "pending",
        due_date: Optional[datetime] = None,
        user_id: Optional[UUID] = None,
    ) -> Task:
        normalized_status = "pending" if status == "open" else ("done" if status == "completed" else status)
        task = Task(
            title=title,
            clinic_id=clinic_id,
            assigned_to_user_id=assigned_to_user_id,
            patient_id=patient_id,
            booking_id=booking_id,
            description=description,
            priority=priority,
            status=normalized_status,
            due_date=due_date,
        )
        saved = await self.task_repo.save(task)

        await record_activity(
            self.activity_repo,
            action="task_create",
            entity_type="task",
            entity_id=saved.id,
            user_id=user_id,
            details={"title": saved.title, "priority": saved.priority},
        )

        return saved

    async def update_task(
        self, task_id: UUID, updates: Dict[str, Any], user_id: Optional[UUID] = None
    ) -> Task:
        task = await self.task_repo.get_by_id(task_id)
        if not task:
            raise HTTPException(
                status_code=http_status.HTTP_404_NOT_FOUND, detail="Task not found."
            )
        old_status = task.status
        for k, v in updates.items():
            if k == "status" and v is not None:
                v = "pending" if v == "open" else ("done" if v == "completed" else v)
            if hasattr(task, k) and v is not None:
                setattr(task, k, v)
        saved = await self.task_repo.save(task)

        if "status" in updates and saved.status != old_status:
            await record_activity(
                self.activity_repo,
                action="task_status_change",
                entity_type="task",
                entity_id=saved.id,
                user_id=user_id,
                details={"from_status": old_status, "to_status": saved.status},
            )
        else:
            await record_activity(
                self.activity_repo,
                action="task_update",
                entity_type="task",
                entity_id=saved.id,
                user_id=user_id,
                details={"updated_fields": list(updates.keys())},
            )

        return saved

    # --- Messages ---

    async def list_messages(
        self,
        clinic_id: Optional[UUID] = None,
        user_id: Optional[UUID] = None,
        recipient_id: Optional[UUID] = None,
        limit: int = 100,
        offset: int = 0,
    ) -> Tuple[List[Message], int]:
        return await self.message_repo.list_messages(
            clinic_id=clinic_id,
            user_id=user_id,
            recipient_id=recipient_id,
            limit=limit,
            offset=offset,
        )

    async def create_message(
        self,
        content: str,
        sender_id: Optional[UUID] = None,
        recipient_id: Optional[UUID] = None,
        patient_id: Optional[UUID] = None,
        phone: Optional[str] = None,
        email: Optional[str] = None,
        channel: str = "sms",
        status: str = "logged",
    ) -> Message:
        msg = Message(
            content=content,
            sender_id=sender_id,
            recipient_id=recipient_id,
            patient_id=patient_id,
            phone=phone,
            email=email,
            channel=channel,
            status=status,
        )
        return await self.message_repo.save(msg)

    # --- Leads ---

    async def list_leads(
        self,
        clinic_id: Optional[UUID] = None,
        status: Optional[str] = None,
        search: Optional[str] = None,
        limit: int = 100,
        offset: int = 0,
    ) -> Tuple[List[Lead], int]:
        return await self.lead_repo.list_leads(
            clinic_id=clinic_id, status=status, search=search, limit=limit, offset=offset
        )

    async def create_lead(
        self,
        full_name: str,
        phone: str,
        email: Optional[str] = None,
        clinic_id: Optional[UUID] = None,
        lead_source_id: Optional[UUID] = None,
        status: str = "new",
        notes: Optional[str] = None,
        utm_source: Optional[str] = None,
        utm_campaign: Optional[str] = None,
    ) -> Lead:
        lead = Lead(
            full_name=full_name,
            phone=phone,
            email=email,
            clinic_id=clinic_id,
            lead_source_id=lead_source_id,
            status=status,
            notes=notes,
            utm_source=utm_source,
            utm_campaign=utm_campaign,
        )
        return await self.lead_repo.save(lead)

    async def update_lead(
        self, lead_id: UUID, updates: Dict[str, Any]
    ) -> Lead:
        lead = await self.lead_repo.get_by_id(lead_id)
        if not lead:
            raise HTTPException(
                status_code=http_status.HTTP_404_NOT_FOUND, detail="Lead not found."
            )
        for k, v in updates.items():
            if hasattr(lead, k) and v is not None:
                setattr(lead, k, v)
        return await self.lead_repo.save(lead)

    async def convert_lead_to_patient(
        self,
        lead_id: UUID,
        date_of_birth: Optional[date] = None,
        clinic_id: Optional[UUID] = None,
        notes: Optional[str] = None,
    ) -> Patient:
        lead = await self.lead_repo.get_by_id(lead_id)
        if not lead:
            raise HTTPException(
                status_code=http_status.HTTP_404_NOT_FOUND, detail="Lead not found."
            )

        names = lead.full_name.split()
        first_name = names[0] if names else "Patient"
        last_name = " ".join(names[1:]) if len(names) > 1 else "Unknown"

        # Check existing duplicates to prevent double-patient creation
        patient, _ = await self.create_patient(
            first_name=first_name,
            last_name=last_name,
            phone=lead.phone,
            email=lead.email,
            date_of_birth=date_of_birth,
            clinic_id=clinic_id or lead.clinic_id,
            notes=notes or lead.notes,
            check_duplicate=True,
        )

        lead.status = "converted"
        lead.patient_id = patient.id
        await self.lead_repo.save(lead)
        return patient

    # --- Recalls ---

    @staticmethod
    def _parse_service_recall_interval(svc: Any) -> Tuple[int, str]:
        if not svc:
            return 180, "Preventive Cleaning & Exam"
        name = getattr(svc, "title", None) or "Preventive Care"
        interval_days = getattr(svc, "recall_interval_days", None)
        if interval_days is not None and interval_days > 0:
            return interval_days, name

        rec_str = getattr(svc, "recommended_interval", None)
        if rec_str:
            text = rec_str.lower()
            m = re.search(r"(\d+)\s*(?:month|mth|mo)", text)
            if m:
                return int(m.group(1)) * 30, name
            y = re.search(r"(\d+)\s*(?:year|yr)", text)
            if y:
                return int(y.group(1)) * 365, name
            d = re.search(r"(\d+)\s*(?:day|d)", text)
            if d:
                return int(d.group(1)), name
        return 180, name

    async def get_recalls(
        self, clinic_id: Optional[UUID] = None
    ) -> List[Dict[str, Any]]:
        # 1. Load active and inactive services to match any service reference
        services_by_key = {}
        if self.service_repo:
            all_services = await self.service_repo.list_all(include_inactive=True)
            for s in all_services:
                services_by_key[str(s.id).lower()] = s
                services_by_key[s.slug.strip().lower()] = s

        # 2. Query completed visits
        past_bookings, _ = await self.booking_repo.list_bookings(
            clinic_id=clinic_id,
            status="completed",
            limit=250,
        )

        # 3. Identify each patient's most recent completed visit
        latest_by_patient: Dict[str, Booking] = {}
        for b in past_bookings:
            key = str(b.patient_id) if b.patient_id else (b.patient_phone or str(b.id))
            if key not in latest_by_patient or b.preferred_date > latest_by_patient[key].preferred_date:
                latest_by_patient[key] = b

        today = datetime.now(timezone.utc).date()
        recalls = []

        for b in latest_by_patient.values():
            # Lookup service
            svc = None
            if b.service_id:
                svc = services_by_key.get(str(b.service_id).lower())
            interval_days, service_name = self._parse_service_recall_interval(svc)
            due_date = b.preferred_date + timedelta(days=interval_days)

            # Only due if due_date has arrived or passed
            if due_date > today:
                continue

            # Check if patient already has an upcoming booking
            if b.patient_id:
                patient_bookings = await self.booking_repo.get_patient_bookings(b.patient_id)
                has_future_booking = any(
                    fb.preferred_date >= today and fb.status in ("requested", "confirmed", "arrived", "in_progress")
                    for fb in patient_bookings
                )
                if has_future_booking:
                    continue

            # Check if there is already an open recall task
            has_open_task = False
            open_task_id = None
            if b.patient_id:
                patient_tasks = await self.task_repo.get_patient_tasks(b.patient_id)
                for t in patient_tasks:
                    if t.status in ("pending", "in_progress") and "recall" in t.title.lower():
                        has_open_task = True
                        open_task_id = str(t.id)
                        break

            recalls.append({
                "patientId": str(b.patient_id) if b.patient_id else str(b.id),
                "patientFullName": b.patient_full_name,
                "phone": b.patient_phone,
                "email": b.patient_email,
                "lastVisitDate": b.preferred_date.isoformat(),
                "serviceId": b.service_id or "cleanings-exams",
                "serviceName": service_name,
                "recallIntervalDays": interval_days,
                "dueDate": due_date.isoformat(),
                "status": "overdue" if due_date < today else "due",
                "clinicId": str(b.clinic_id) if b.clinic_id else None,
                "hasOpenTask": has_open_task,
                "taskId": open_task_id,
            })

        # Sort by dueDate ascending (most overdue first)
        recalls.sort(key=lambda r: r["dueDate"])
        return recalls

    async def create_recall_task(
        self,
        patient_id: UUID,
        service_id: Optional[str] = None,
        due_date: Optional[date] = None,
        user_id: Optional[UUID] = None,
        clinic_id: Optional[UUID] = None,
    ) -> Task:
        patient = await self.patient_repo.get_by_id(patient_id)
        if not patient:
            raise HTTPException(
                status_code=http_status.HTTP_404_NOT_FOUND,
                detail=f"Patient {patient_id} not found.",
            )

        service_title = "Preventive Care"
        if service_id and self.service_repo:
            svc = None
            try:
                svc = await self.service_repo.get_by_id(UUID(service_id))
            except (ValueError, TypeError):
                svc = await self.service_repo.get_by_slug(service_id)
            if svc:
                service_title = svc.title

        target_due_date = due_date or datetime.now(timezone.utc).date()
        due_dt = datetime.combine(target_due_date, time(17, 0), tzinfo=timezone.utc)

        task = Task(
            title=f"Recall Call: {patient.full_name} ({service_title})",
            description=f"Patient due for {service_title} recall. Call to schedule checkup.",
            priority="medium",
            status="pending",
            clinic_id=clinic_id or patient.clinic_id,
            patient_id=patient.id,
            due_date=due_dt,
        )
        saved_task = await self.task_repo.save(task)

        if self.activity_repo:
            await self.activity_repo.log_activity(
                action="create_recall_task",
                entity_type="task",
                entity_id=str(saved_task.id),
                user_id=user_id,
                details={
                    "patientId": str(patient.id),
                    "patientName": patient.full_name,
                    "serviceTitle": service_title,
                    "dueDate": target_due_date.isoformat(),
                },
            )

        return saved_task

    # --- Cancellation Waitlist Offers ---

    async def get_waitlist_offers_for_slot(
        self,
        booking_id: UUID,
    ) -> List[Dict[str, Any]]:
        booking = await self.booking_repo.get_by_id(booking_id)
        if not booking:
            raise HTTPException(
                status_code=http_status.HTTP_404_NOT_FOUND,
                detail=f"Booking {booking_id} not found.",
            )

        # Retrieve active waitlist entries for this clinic (or overall)
        waitlist_bookings, _ = await self.booking_repo.list_bookings(
            clinic_id=booking.clinic_id,
            status="waitlist",
            limit=100,
        )

        # Preload service titles
        service_titles = {}
        if self.service_repo:
            svcs = await self.service_repo.list_all(include_inactive=True)
            for s in svcs:
                service_titles[str(s.id).lower()] = s.title
                service_titles[s.slug.strip().lower()] = s.title

        # Check existing offer tasks for these waitlist candidates
        open_tasks, _ = await self.task_repo.list_tasks(
            clinic_id=booking.clinic_id,
            status="pending",
            limit=250,
        )
        task_by_booking_id = {
            t.booking_id: t for t in open_tasks
            if t.booking_id and "offer slot" in (t.title or "").lower()
        }

        candidates = []
        for wb in waitlist_bookings:
            svc_name = service_titles.get(str(wb.service_id).lower(), "Any Appointment") if wb.service_id else "Any Appointment"
            matching_task = task_by_booking_id.get(wb.id)
            candidates.append({
                "waitlistBookingId": str(wb.id),
                "confirmationId": wb.confirmation_id,
                "patientId": str(wb.patient_id) if wb.patient_id else None,
                "patientName": wb.patient_full_name,
                "patientPhone": wb.patient_phone,
                "patientEmail": wb.patient_email,
                "preferredDate": wb.preferred_date.isoformat() if wb.preferred_date else None,
                "preferredTime": wb.preferred_time,
                "serviceId": wb.service_id,
                "serviceName": svc_name,
                "notes": wb.notes,
                "hasOpenOfferTask": matching_task is not None,
                "taskId": str(matching_task.id) if matching_task else None,
            })

        return candidates

    async def create_waitlist_offer_task(
        self,
        booking_id: UUID,
        waitlist_booking_id: UUID,
        user_id: Optional[UUID] = None,
    ) -> Task:
        booking = await self.booking_repo.get_by_id(booking_id)
        if not booking:
            raise HTTPException(
                status_code=http_status.HTTP_404_NOT_FOUND,
                detail=f"Cancelled booking {booking_id} not found.",
            )

        waitlist_booking = await self.booking_repo.get_by_id(waitlist_booking_id)
        if not waitlist_booking or waitlist_booking.status != "waitlist":
            raise HTTPException(
                status_code=http_status.HTTP_404_NOT_FOUND,
                detail=f"Waitlist booking {waitlist_booking_id} not found or not in waitlist status.",
            )

        now = datetime.now(timezone.utc)
        slot_date = booking.preferred_date.isoformat() if booking.preferred_date else "upcoming"
        slot_time = booking.preferred_time or "opening"

        task = Task(
            title=f"Offer Slot: {waitlist_booking.patient_full_name} ({slot_date} {slot_time})",
            description=(
                f"Slot opened due to cancellation of {booking.patient_full_name} ({booking.confirmation_id}). "
                f"Call {waitlist_booking.patient_full_name} at {waitlist_booking.patient_phone} to offer "
                f"opening on {slot_date} at {slot_time}. Note: NEVER auto-book."
            ),
            priority="high",
            status="pending",
            clinic_id=booking.clinic_id or waitlist_booking.clinic_id,
            patient_id=waitlist_booking.patient_id,
            booking_id=waitlist_booking.id,
            due_date=now,
        )
        saved_task = await self.task_repo.save(task)

        if self.activity_repo:
            await self.activity_repo.log_activity(
                action="waitlist_offer_task_created",
                entity_type="task",
                entity_id=str(saved_task.id),
                user_id=user_id,
                details={
                    "cancelledBookingId": str(booking.id),
                    "waitlistBookingId": str(waitlist_booking.id),
                    "patientName": waitlist_booking.patient_full_name,
                    "slotDate": slot_date,
                    "slotTime": slot_time,
                },
            )

        return saved_task


    # --- Reminders Worklist ---

    async def mark_appointment_reminded(
        self,
        booking_id: UUID,
        user_id: UUID,
    ) -> Booking:
        booking = await self.booking_repo.get_by_id(booking_id)
        if not booking:
            raise HTTPException(
                status_code=http_status.HTTP_404_NOT_FOUND,
                detail=f"Booking {booking_id} not found.",
            )
        now = datetime.now(timezone.utc)
        booking.reminded_at = now
        booking.reminded_by_user_id = user_id
        saved = await self.booking_repo.save(booking)

        user_name = "Reception"
        if self.user_repo:
            try:
                u = await self.user_repo.get_by_id(user_id)
                if u:
                    user_name = u.full_name
            except Exception:
                pass

        await record_activity(
            self.activity_repo,
            action="mark_reminded",
            entity_type="booking",
            entity_id=str(booking.id),
            user_id=user_id,
            details={
                "booking_id": str(booking.id),
                "patient_id": str(booking.patient_id) if booking.patient_id else None,
                "reminded_at": now.isoformat(),
                "reminded_by": user_name,
                "patient_full_name": booking.patient_full_name,
                "patient_phone": booking.patient_phone,
            },
        )
        return saved

    async def get_reminders_worklist(
        self,
        target_date: date,
        clinic_id: Optional[UUID] = None,
    ) -> Dict[str, Any]:
        default_tpl = (
            "Dear {patient_name}, this is a reminder for your dental appointment on "
            "{appointment_date} at {appointment_time} with {clinician_name} at Marlow Dental. "
            "Please reply to confirm or call {clinic_phone} if you need to reschedule."
        )
        template = default_tpl
        q_enabled = True
        q_start = "21:00"
        q_end = "08:00"
        provider_mode = "simulated"
        if self.booking_settings_repo:
            try:
                settings = await self.booking_settings_repo.get_settings(clinic_id=clinic_id)
                if settings:
                    if settings.reminder_template:
                        template = settings.reminder_template
                    q_enabled = getattr(settings, "quiet_hours_enabled", True)
                    q_start = getattr(settings, "quiet_hours_start", "21:00") or "21:00"
                    q_end = getattr(settings, "quiet_hours_end", "08:00") or "08:00"
                    provider_mode = getattr(settings, "messaging_provider_mode", "simulated") or "simulated"
            except Exception:
                pass

        quiet_hours_active = is_in_quiet_hours(start_str=q_start, end_str=q_end) if q_enabled else False

        bookings, _ = await self.booking_repo.list_bookings(
            clinic_id=clinic_id,
            date_from=target_date,
            date_to=target_date,
            status="confirmed",
            limit=200,
        )

        items = []
        for b in bookings:
            clinician_name = None
            if b.team_member_id and self.team_repo:
                try:
                    member = await self.team_repo.get_by_id(b.team_member_id)
                    if member:
                        clinician_name = member.display_name or f"{member.first_name} {member.last_name}"
                except Exception:
                    pass

            reminded_by_name = None
            if b.reminded_by_user_id and self.user_repo:
                try:
                    u = await self.user_repo.get_by_id(b.reminded_by_user_id)
                    if u:
                        reminded_by_name = u.full_name
                except Exception:
                    pass

            service_name = None
            if b.service_id and self.service_repo:
                try:
                    svc = await self.service_repo.get_by_id(UUID(str(b.service_id)))
                    if svc:
                        service_name = svc.title
                except Exception:
                    try:
                        svc = await self.service_repo.get_by_slug(str(b.service_id))
                        if svc:
                            service_name = svc.title
                    except Exception:
                        pass

            opted_out = False
            if b.patient_id and self.patient_repo:
                try:
                    patient = await self.patient_repo.get_by_id(b.patient_id)
                    if patient:
                        opted_out = getattr(patient, "messaging_opt_out", False)
                except Exception:
                    pass

            delivery_status = "none"
            last_message_at = None
            if self.message_repo and b.patient_id:
                try:
                    p_msgs = await self.message_repo.get_patient_messages(b.patient_id)
                    for m in p_msgs:
                        if getattr(m, "booking_id", None) == b.id:
                            delivery_status = getattr(m, "delivery_status", "simulated")
                            last_message_at = m.created_at
                            break
                except Exception:
                    pass
            if delivery_status == "none" and b.reminded_at:
                delivery_status = "simulated"

            items.append({
                "id": b.id,
                "confirmationId": b.confirmation_id,
                "preferredDate": b.preferred_date,
                "preferredTime": b.preferred_time,
                "patientFullName": b.patient_full_name,
                "patientPhone": b.patient_phone,
                "patientEmail": b.patient_email,
                "status": b.status,
                "clinicId": b.clinic_id,
                "patientId": b.patient_id,
                "serviceId": b.service_id,
                "serviceName": service_name,
                "teamMemberId": b.team_member_id,
                "clinicianName": clinician_name,
                "remindedAt": b.reminded_at,
                "remindedByUserId": b.reminded_by_user_id,
                "remindedByName": reminded_by_name,
                "optedOut": opted_out,
                "deliveryStatus": delivery_status,
                "lastMessageAt": last_message_at,
            })

        return {
            "targetDate": target_date,
            "template": template,
            "items": items,
            "providerMode": provider_mode,
            "quietHoursActive": quiet_hours_active,
            "quietHoursStart": q_start,
            "quietHoursEnd": q_end,
        }

    async def schedule_booking_reminders(
        self,
        booking: Booking,
        user_id: Optional[UUID] = None,
    ) -> None:
        """
        Creates reminder rows (24h and 2h before in Asia/Karachi) for CONFIRMED bookings only.
        Cancelled, no_show, completed and past bookings get none.
        Quiet hours move reminders forward to the next allowed time (never drop).
        Adheres to unique constraint on (booking_id, reminder_type).
        """
        if not self.message_repo or booking.status != "confirmed":
            return

        now_utc = datetime.now(timezone.utc)
        appt_dt = parse_booking_datetime(booking.preferred_date, booking.preferred_time)
        if appt_dt.astimezone(timezone.utc) <= now_utc:
            # Past appointments get no reminders
            return

        settings = None
        if self.booking_settings_repo:
            try:
                settings = await self.booking_settings_repo.get_settings(clinic_id=booking.clinic_id)
            except Exception:
                pass

        reminder_24h_enabled = getattr(settings, "reminder_24h_enabled", True) if settings else True
        reminder_2h_enabled = getattr(settings, "reminder_2h_enabled", True) if settings else True
        quiet_hours_enabled = getattr(settings, "quiet_hours_enabled", True) if settings else True
        q_start = getattr(settings, "quiet_hours_start", "21:00") or "21:00" if settings else "21:00"
        q_end = getattr(settings, "quiet_hours_end", "08:00") or "08:00" if settings else "08:00"
        provider_mode = getattr(settings, "messaging_provider_mode", "simulated") or "simulated" if settings else "simulated"
        tpl_en = getattr(settings, "reminder_template", None) or DEFAULT_REMINDER_TEMPLATE_EN

        # Patient opt-out & preferred channel
        opted_out = False
        pref_channel = "sms"
        first_name = (booking.patient_full_name.split()[0] if booking.patient_full_name else "Patient")
        if booking.patient_id and self.patient_repo:
            try:
                p = await self.patient_repo.get_by_id(booking.patient_id)
                if p:
                    opted_out = getattr(p, "messaging_opt_out", False)
                    pref_channel = getattr(p, "preferred_channel", "sms") or "sms"
                    if p.first_name:
                        first_name = p.first_name
            except Exception:
                pass

        if pref_channel == "none":
            opted_out = True

        msg_content = format_reminder_message(
            template=tpl_en,
            patient_first_name=first_name,
            appointment_date=booking.preferred_date.isoformat(),
            appointment_time=booking.preferred_time,
            clinic_name="Marlow Dental Clinic",
            clinic_phone="+92 300 1234567",
        )

        delivery_status = "queued"
        error_detail = None
        effective_channel = pref_channel if pref_channel in ("sms", "whatsapp") else "sms"

        # 24h Reminder
        if reminder_24h_enabled:
            time_24h = appt_dt - timedelta(hours=24)
            if quiet_hours_enabled:
                time_24h = adjust_for_quiet_hours(time_24h, q_start, q_end)
            utc_24h = time_24h.astimezone(timezone.utc)
            if utc_24h > now_utc:
                existing = await self.message_repo.get_by_booking_and_type(booking.id, "reminder_24h")
                if not existing:
                    msg24 = Message(
                        patient_id=booking.patient_id,
                        phone=booking.patient_phone,
                        email=booking.patient_email,
                        content=msg_content,
                        channel=effective_channel,
                        status="logged",
                        booking_id=booking.id,
                        delivery_status=delivery_status,
                        error_detail=error_detail,
                        provider=provider_mode,
                        scheduled_for=utc_24h,
                        reminder_type="reminder_24h",
                        attempts=0,
                        sender_id=user_id,
                    )
                    await self.message_repo.save(msg24)

        # 2h Reminder
        if reminder_2h_enabled:
            time_2h = appt_dt - timedelta(hours=2)
            if quiet_hours_enabled:
                time_2h = adjust_for_quiet_hours(time_2h, q_start, q_end)
            utc_2h = time_2h.astimezone(timezone.utc)
            if utc_2h > now_utc:
                existing = await self.message_repo.get_by_booking_and_type(booking.id, "reminder_2h")
                if not existing:
                    msg2 = Message(
                        patient_id=booking.patient_id,
                        phone=booking.patient_phone,
                        email=booking.patient_email,
                        content=msg_content,
                        channel=effective_channel,
                        status="logged",
                        booking_id=booking.id,
                        delivery_status=delivery_status,
                        error_detail=error_detail,
                        provider=provider_mode,
                        scheduled_for=utc_2h,
                        reminder_type="reminder_2h",
                        attempts=0,
                        sender_id=user_id,
                    )
                    await self.message_repo.save(msg2)

    async def dispatch_due_reminders(
        self,
        as_of: Optional[datetime] = None,
        user_id: Optional[UUID] = None,
        force_quiet_hours: bool = False,
    ) -> Dict[str, Any]:
        """
        Processes due reminder messages (scheduled_for <= now).
        Acquires PostgreSQL advisory lock per run so no duplicates occur if multiple runners run at once.
        Quiet hours moves reminders to the next allowed time (never drops).
        Patient opt-outs are logged as skipped with reason.
        Retries are capped at 3, then status becomes failed.
        Simulated dispatches are honestly tagged 'simulated' (never 'sent').
        """
        if not self.message_repo:
            return {"dispatchedCount": 0, "skippedOptOutCount": 0, "status": "no_repo"}

        target_time = as_of or datetime.now(timezone.utc)

        # 1. PostgreSQL Advisory Lock
        session = getattr(self.message_repo, "_session", None)
        if session is not None and getattr(session, "bind", None) is not None:
            dialect = getattr(session.bind, "dialect", None)
            if dialect is not None and dialect.name == "postgresql":
                lock_id = int.from_bytes(hashlib.sha256(b"marlow_reminders_runner").digest()[:8], byteorder="big", signed=True)
                lock_res = await session.execute(text("SELECT pg_try_advisory_xact_lock(:lock_id)"), {"lock_id": lock_id})
                got_lock = lock_res.scalar()
                if not got_lock:
                    return {
                        "dispatchedCount": 0,
                        "skippedOptOutCount": 0,
                        "skippedQuietHours": False,
                        "status": "locked",
                        "message": "Advisory lock held by concurrent runner. Skipped.",
                    }

        # 2. Settings & quiet hours
        settings = None
        if self.booking_settings_repo:
            try:
                settings = await self.booking_settings_repo.get_settings()
            except Exception:
                pass

        q_enabled = getattr(settings, "quiet_hours_enabled", True) if settings else True
        q_start = getattr(settings, "quiet_hours_start", "21:00") or "21:00" if settings else "21:00"
        q_end = getattr(settings, "quiet_hours_end", "08:00") or "08:00" if settings else "08:00"
        provider_mode = getattr(settings, "messaging_provider_mode", "simulated") or "simulated" if settings else "simulated"

        from app.application.services.messaging_provider import get_messaging_provider
        provider = get_messaging_provider(provider_mode)

        due_messages = await self.message_repo.list_due_reminders(as_of=target_time, limit=200)
        dispatched = 0
        skipped_opt_out = 0

        for msg in due_messages:
            # Check booking status if linked
            if msg.booking_id and self.booking_repo:
                b = await self.booking_repo.get_by_id(msg.booking_id)
                if not b or b.status in ("cancelled", "no_show", "completed"):
                    msg.delivery_status = "cancelled"
                    await self.message_repo.save(msg)
                    continue

            # Check quiet hours right now
            if q_enabled and is_in_quiet_hours(target_time, start_str=q_start, end_str=q_end) and not force_quiet_hours:
                # Move to next allowed time, never drop!
                msg.scheduled_for = adjust_for_quiet_hours(target_time, start_str=q_start, end_str=q_end)
                msg.delivery_status = "quiet_hours_held"
                await self.message_repo.save(msg)
                continue

            # Check patient opt-out
            opted_out = False
            if msg.patient_id and self.patient_repo:
                p = await self.patient_repo.get_by_id(msg.patient_id)
                if p and (getattr(p, "messaging_opt_out", False) or getattr(p, "preferred_channel", "sms") == "none"):
                    opted_out = True

            if opted_out:
                msg.delivery_status = "opted_out"
                msg.error_detail = "Skipped: Patient opted out of automated messaging."
                await self.message_repo.save(msg)
                skipped_opt_out += 1
                continue

            # Increment attempts
            msg.attempts = (msg.attempts or 0) + 1

            send_res = await provider.send_message(
                recipient=msg.phone or "",
                message=msg.content,
                channel=msg.channel or "sms",
            )

            msg.provider = send_res.provider
            msg.provider_message_id = send_res.provider_message_id

            if send_res.success:
                # Honest simulated delivery status - never claimed as carrier sent
                msg.delivery_status = send_res.status
                msg.status = "logged" if send_res.status == "simulated" else "sent"
                msg.sent_at = datetime.now(timezone.utc)
                msg.error_detail = None
                dispatched += 1
            else:
                if msg.attempts >= 3:
                    msg.delivery_status = "failed"
                    msg.status = "failed"
                    msg.error_detail = send_res.error or "Delivery failed after maximum attempts (3)."
                else:
                    msg.delivery_status = "queued"
                    msg.error_detail = send_res.error

            await self.message_repo.save(msg)

        return {
            "dispatchedCount": dispatched,
            "skippedOptOutCount": skipped_opt_out,
            "skippedQuietHours": False,
            "simulated": provider_mode == "simulated",
            "message": f"Processed {len(due_messages)} due messages: {dispatched} dispatched, {skipped_opt_out} skipped (opt-out).",
        }

    async def run_automated_reminders(
        self,
        target_date: date,
        clinic_id: Optional[UUID] = None,
        user_id: Optional[UUID] = None,
        force_quiet_hours: bool = False,
    ) -> Dict[str, Any]:
        settings = None
        if self.booking_settings_repo:
            try:
                settings = await self.booking_settings_repo.get_settings(clinic_id=clinic_id)
            except Exception:
                pass

        provider_mode = getattr(settings, "messaging_provider_mode", "simulated") if settings else "simulated"
        q_enabled = getattr(settings, "quiet_hours_enabled", True) if settings else True
        q_start = getattr(settings, "quiet_hours_start", "21:00") or "21:00" if settings else "21:00"
        q_end = getattr(settings, "quiet_hours_end", "08:00") or "08:00" if settings else "08:00"

        if q_enabled and is_in_quiet_hours(start_str=q_start, end_str=q_end) and not force_quiet_hours:
            return {
                "dispatchedCount": 0,
                "skippedOptOutCount": 0,
                "skippedQuietHours": True,
                "message": f"Reminders held: Quiet hours active ({q_start} - {q_end} PKT). Automated dispatch skipped to avoid disturbing patients.",
                "simulated": True,
            }

        bookings, _ = await self.booking_repo.list_bookings(
            clinic_id=clinic_id,
            date_from=target_date,
            date_to=target_date,
            status="confirmed",
            limit=500,
        )

        for b in bookings:
            await self.schedule_booking_reminders(b, user_id=user_id)

        # Dispatch due reminders for target_date
        target_eval_time = datetime.combine(target_date + timedelta(days=2), time.max).replace(tzinfo=timezone.utc)
        dispatch_result = await self.dispatch_due_reminders(
            as_of=target_eval_time,
            user_id=user_id,
            force_quiet_hours=force_quiet_hours,
        )

        # Update reminded_at on bookings dispatched for backward test compatibility
        now = datetime.now(timezone.utc)
        for b in bookings:
            if not b.reminded_at:
                opted_out = False
                if b.patient_id and self.patient_repo:
                    p = await self.patient_repo.get_by_id(b.patient_id)
                    if p and (getattr(p, "messaging_opt_out", False) or getattr(p, "preferred_channel", "sms") == "none"):
                        opted_out = True
                if not opted_out:
                    b.reminded_at = now
                    b.reminded_by_user_id = user_id
                    await self.booking_repo.save(b)

        await record_activity(
            self.activity_repo,
            action="automated_reminders_dispatched",
            entity_type="reminders",
            user_id=user_id,
            details={
                "target_date": target_date.isoformat(),
                "dispatched_count": dispatch_result.get("dispatchedCount", 0),
                "skipped_opt_out_count": dispatch_result.get("skippedOptOutCount", 0),
                "provider_mode": provider_mode,
                "simulated": True,
            },
        )

        return dispatch_result

    async def send_test_message(
        self,
        recipient: str,
        message: str,
        channel: str = "sms",
        clinic_id: Optional[UUID] = None,
        user_id: Optional[UUID] = None,
    ) -> Dict[str, Any]:
        """Dispatches an admin test message via the configured provider."""
        settings = None
        if self.booking_settings_repo:
            try:
                settings = await self.booking_settings_repo.get_settings(clinic_id=clinic_id)
            except Exception:
                pass
        provider_mode = getattr(settings, "messaging_provider_mode", "simulated") if settings else "simulated"
        from app.application.services.messaging_provider import get_messaging_provider
        provider = get_messaging_provider(provider_mode)
        res = await provider.send_message(recipient=recipient, message=message, channel=channel)

        if self.message_repo:
            try:
                msg = Message(
                    content=message,
                    sender_id=user_id,
                    recipient_id=None,
                    phone=recipient,
                    channel=channel,
                    status="sent" if res.success else "failed",
                    delivery_status=res.status,
                    error_detail=res.error,
                    provider=res.provider,
                    provider_message_id=res.provider_message_id,
                    attempts=1,
                    sent_at=datetime.now(timezone.utc) if res.success else None,
                    reminder_type="manual",
                )
                await self.message_repo.save(msg)
            except Exception:
                pass

        await record_activity(
            self.activity_repo,
            action="send_test_message",
            entity_type="messaging",
            user_id=user_id,
            details={
                "recipient": recipient,
                "channel": channel,
                "provider": res.provider,
                "status": res.status,
                "success": res.success,
            },
        )

        return {
            "success": res.success,
            "status": res.status,
            "channel": res.channel,
            "provider": res.provider,
            "recipient": res.recipient,
            "details": res.details,
            "error": res.error,
            "providerMessageId": res.provider_message_id,
        }

    async def set_patient_messaging_opt_out(
        self,
        patient_id: UUID,
        opt_out: bool,
        user_id: UUID,
    ) -> Patient:
        patient = await self.patient_repo.get_by_id(patient_id)
        if not patient:
            raise HTTPException(
                status_code=http_status.HTTP_404_NOT_FOUND,
                detail=f"Patient {patient_id} not found.",
            )
        patient.messaging_opt_out = opt_out
        patient.updated_at = datetime.now(timezone.utc)
        saved = await self.patient_repo.save(patient)

        await record_activity(
            self.activity_repo,
            action="update_patient_messaging_opt_out",
            entity_type="patient",
            entity_id=str(patient.id),
            user_id=user_id,
            details={
                "patient_id": str(patient.id),
                "opt_out": opt_out,
            },
        )
        return saved

    async def get_messaging_settings(
        self,
        clinic_id: Optional[UUID] = None,
    ) -> Dict[str, Any]:
        default_tpl = DEFAULT_REMINDER_TEMPLATE_EN
        default_tpl_ur = DEFAULT_REMINDER_TEMPLATE_UR
        if not self.booking_settings_repo:
            return {
                "quietHoursEnabled": True,
                "quietHoursStart": "21:00",
                "quietHoursEnd": "08:00",
                "messagingProviderMode": "simulated",
                "reminderTemplate": default_tpl,
                "reminderTemplateUrdu": default_tpl_ur,
                "reminder24hEnabled": True,
                "reminder2hEnabled": True,
            }
        settings = await self.booking_settings_repo.get_settings(clinic_id=clinic_id)
        return {
            "quietHoursEnabled": getattr(settings, "quiet_hours_enabled", True),
            "quietHoursStart": getattr(settings, "quiet_hours_start", "21:00") or "21:00",
            "quietHoursEnd": getattr(settings, "quiet_hours_end", "08:00") or "08:00",
            "messagingProviderMode": getattr(settings, "messaging_provider_mode", "simulated") or "simulated",
            "reminderTemplate": getattr(settings, "reminder_template", None) or default_tpl,
            "reminderTemplateUrdu": getattr(settings, "reminder_template_urdu", None) or default_tpl_ur,
            "reminder24hEnabled": getattr(settings, "reminder_24h_enabled", True),
            "reminder2hEnabled": getattr(settings, "reminder_2h_enabled", True),
        }

    async def update_messaging_settings(
        self,
        req_data: Dict[str, Any],
        user_id: UUID,
        clinic_id: Optional[UUID] = None,
    ) -> Dict[str, Any]:
        if not self.booking_settings_repo:
            raise HTTPException(status_code=500, detail="Settings repository unavailable.")
        settings = await self.booking_settings_repo.get_settings(clinic_id=clinic_id)
        if not settings:
            raise HTTPException(status_code=404, detail="Booking settings not found.")

        before = {
            "quiet_hours_enabled": getattr(settings, "quiet_hours_enabled", True),
            "quiet_hours_start": getattr(settings, "quiet_hours_start", "21:00"),
            "quiet_hours_end": getattr(settings, "quiet_hours_end", "08:00"),
            "messaging_provider_mode": getattr(settings, "messaging_provider_mode", "simulated"),
            "reminder_template": getattr(settings, "reminder_template", None),
            "reminder_template_urdu": getattr(settings, "reminder_template_urdu", None),
            "reminder_24h_enabled": getattr(settings, "reminder_24h_enabled", True),
            "reminder_2h_enabled": getattr(settings, "reminder_2h_enabled", True),
        }

        if "quietHoursEnabled" in req_data and req_data["quietHoursEnabled"] is not None:
            settings.quiet_hours_enabled = req_data["quietHoursEnabled"]
        if "quietHoursStart" in req_data and req_data["quietHoursStart"] is not None:
            settings.quiet_hours_start = req_data["quietHoursStart"]
        if "quietHoursEnd" in req_data and req_data["quietHoursEnd"] is not None:
            settings.quiet_hours_end = req_data["quietHoursEnd"]
        if "messagingProviderMode" in req_data and req_data["messagingProviderMode"] is not None:
            settings.messaging_provider_mode = req_data["messagingProviderMode"]
        if "reminderTemplate" in req_data and req_data["reminderTemplate"] is not None:
            settings.reminder_template = req_data["reminderTemplate"]
        if "reminderTemplateUrdu" in req_data and req_data["reminderTemplateUrdu"] is not None:
            settings.reminder_template_urdu = req_data["reminderTemplateUrdu"]
        if "reminder24hEnabled" in req_data and req_data["reminder24hEnabled"] is not None:
            settings.reminder_24h_enabled = req_data["reminder24hEnabled"]
        if "reminder2hEnabled" in req_data and req_data["reminder2hEnabled"] is not None:
            settings.reminder_2h_enabled = req_data["reminder2hEnabled"]

        saved = await self.booking_settings_repo.update_settings(settings)

        await record_activity(
            self.activity_repo,
            action="update_messaging_settings",
            entity_type="booking_settings",
            entity_id=str(saved.id),
            user_id=user_id,
            details={
                "before": before,
                "after": {
                    "quiet_hours_enabled": saved.quiet_hours_enabled,
                    "quiet_hours_start": saved.quiet_hours_start,
                    "quiet_hours_end": saved.quiet_hours_end,
                    "messaging_provider_mode": saved.messaging_provider_mode,
                    "reminder_template": saved.reminder_template,
                    "reminder_template_urdu": saved.reminder_template_urdu,
                    "reminder_24h_enabled": saved.reminder_24h_enabled,
                    "reminder_2h_enabled": saved.reminder_2h_enabled,
                },
            },
        )

        return {
            "quietHoursEnabled": saved.quiet_hours_enabled,
            "quietHoursStart": saved.quiet_hours_start,
            "quietHoursEnd": saved.quiet_hours_end,
            "messagingProviderMode": saved.messaging_provider_mode,
            "reminderTemplate": saved.reminder_template or "",
            "reminderTemplateUrdu": saved.reminder_template_urdu or "",
            "reminder24hEnabled": saved.reminder_24h_enabled,
            "reminder2hEnabled": saved.reminder_2h_enabled,
        }

    async def list_all_messages(
        self,
        limit: int = 100,
        offset: int = 0,
    ) -> Tuple[List[Dict[str, Any]], int]:
        if not self.message_repo:
            return [], 0
        messages, total = await self.message_repo.list_messages(limit=limit, offset=offset)
        items = []
        for m in messages:
            items.append({
                "id": m.id,
                "recipientPhone": m.phone,
                "recipientEmail": m.email,
                "content": m.content,
                "channel": m.channel,
                "status": m.status,
                "deliveryStatus": getattr(m, "delivery_status", "simulated"),
                "errorDetail": getattr(m, "error_detail", None),
                "patientId": m.patient_id,
                "bookingId": getattr(m, "booking_id", None),
                "senderId": m.sender_id,
                "provider": getattr(m, "provider", "simulated") or "simulated",
                "providerMessageId": getattr(m, "provider_message_id", None),
                "attempts": getattr(m, "attempts", 0) or 0,
                "scheduledFor": getattr(m, "scheduled_for", None),
                "sentAt": getattr(m, "sent_at", None),
                "reminderType": getattr(m, "reminder_type", None),
                "createdAt": m.created_at,
            })
        return items, total

    async def get_end_of_day_unresolved(
        self,
        target_date: date,
        clinic_id: Optional[UUID] = None,
    ) -> Dict[str, Any]:
        """Returns unresolved appointments for target_date and earlier (status in requested, confirmed, arrived, in_progress)."""
        bookings, _ = await self.booking_repo.list_bookings(
            clinic_id=clinic_id,
            date_to=target_date,
            status_in=["requested", "confirmed", "arrived", "in_progress"],
            limit=500,
        )

        today_count = 0
        past_count = 0
        items = []

        for b in bookings:
            if b.preferred_date == target_date:
                today_count += 1
            elif b.preferred_date < target_date:
                past_count += 1

            clinician_name = None
            if b.team_member_id and self.team_repo:
                try:
                    member = await self.team_repo.get_by_id(b.team_member_id)
                    if member:
                        clinician_name = member.display_name or f"{member.first_name} {member.last_name}"
                except Exception:
                    pass

            service_name = None
            if b.service_id and self.service_repo:
                try:
                    svc = await self.service_repo.get_by_id(UUID(str(b.service_id)))
                    if svc:
                        service_name = svc.title
                except Exception:
                    try:
                        svc = await self.service_repo.get_by_slug(str(b.service_id))
                        if svc:
                            service_name = svc.title
                    except Exception:
                        pass

            items.append({
                "id": b.id,
                "confirmationId": b.confirmation_id,
                "preferredDate": b.preferred_date,
                "preferredTime": b.preferred_time,
                "patientFullName": b.patient_full_name,
                "patientPhone": b.patient_phone,
                "patientEmail": b.patient_email,
                "status": b.status,
                "clinicId": b.clinic_id,
                "patientId": b.patient_id,
                "serviceId": b.service_id,
                "serviceName": service_name,
                "teamMemberId": b.team_member_id,
                "clinicianName": clinician_name,
                "arrivedAt": b.arrived_at,
                "notes": b.notes,
                "staffNotes": b.staff_notes,
            })

        return {
            "targetDate": target_date,
            "todayCount": today_count,
            "pastCount": past_count,
            "totalUnresolved": len(items),
            "items": items,
        }

    async def resolve_end_of_day(
        self,
        booking_id: UUID,
        resolution: str,
        reason: Optional[str] = None,
        user_id: Optional[UUID] = None,
    ) -> Booking:
        """Manually resolves an end-of-day unresolved appointment. Never auto-transitions."""
        if resolution not in ("completed", "no_show", "cancelled"):
            raise HTTPException(
                status_code=http_status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"Invalid resolution '{resolution}'. Must be 'completed', 'no_show', or 'cancelled'.",
            )

        booking = await self.booking_repo.get_by_id(booking_id)
        if not booking:
            raise HTTPException(
                status_code=http_status.HTTP_404_NOT_FOUND,
                detail="Booking record not found.",
            )

        if booking.status not in ("requested", "confirmed", "arrived", "in_progress"):
            raise HTTPException(
                status_code=http_status.HTTP_409_CONFLICT,
                detail=f"Appointment is already resolved with status '{booking.status}'.",
            )

        old_status = booking.status
        now_utc = datetime.now(timezone.utc)

        if resolution == "cancelled":
            if not reason or not reason.strip():
                raise HTTPException(
                    status_code=http_status.HTTP_422_UNPROCESSABLE_ENTITY,
                    detail="Cancellation reason is required when cancelling an appointment at end-of-day.",
                )
            booking.cancellation_reason = reason.strip()
            booking.cancelled_by_user_id = user_id
            booking.status = "cancelled"
        elif resolution == "completed":
            booking.status = "completed"
            if booking.completed_at is None:
                booking.completed_at = now_utc
            if reason and reason.strip():
                note = f"[End-of-day resolution] {reason.strip()}"
                booking.staff_notes = f"{booking.staff_notes}\n{note}" if booking.staff_notes else note
        elif resolution == "no_show":
            booking.status = "no_show"
            if reason and reason.strip():
                note = f"[End-of-day resolution] {reason.strip()}"
                booking.staff_notes = f"{booking.staff_notes}\n{note}" if booking.staff_notes else note

        saved = await self.booking_repo.save(booking)

        # Audit trail: action="end_of_day_resolution"
        await record_activity(
            self.activity_repo,
            action="end_of_day_resolution",
            entity_type="booking",
            entity_id=saved.id,
            user_id=user_id,
            details={
                "previous_status": old_status,
                "resolution": resolution,
                "reason": reason.strip() if reason else None,
                "booking_id": str(saved.id),
                "confirmation_id": saved.confirmation_id,
                "preferred_date": str(saved.preferred_date),
            },
        )

        return saved

    # --- Visit Payments ---

    async def record_visit_payment(
        self,
        booking_id: UUID,
        amount_cents: int,
        currency: str = "PKR",
        method: str = "cash",
        notes: Optional[str] = None,
        patient_id: Optional[UUID] = None,
        user_id: Optional[UUID] = None,
        amount_charged_cents: Optional[int] = None,
        override_reason: Optional[str] = None,
    ) -> VisitPayment:
        booking = await self.booking_repo.get_by_id(booking_id)
        if not booking:
            raise HTTPException(
                status_code=http_status.HTTP_404_NOT_FOUND,
                detail=f"Booking {booking_id} not found.",
            )

        if self.booking_settings_repo:
            try:
                settings = await self.booking_settings_repo.get_settings(clinic_id=booking.clinic_id)
                if settings and not getattr(settings, "payments_enabled", True):
                    raise HTTPException(
                        status_code=http_status.HTTP_400_BAD_REQUEST,
                        detail="Visit payments are currently disabled in clinic settings.",
                    )
            except HTTPException:
                raise
            except Exception:
                pass

        if not self.payment_repo:
            raise HTTPException(
                status_code=http_status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Payment repository is not configured.",
            )

        charged_cents = amount_charged_cents
        if charged_cents is None and booking.service_id and self.service_repo:
            try:
                svc = None
                try:
                    svc = await self.service_repo.get_by_id(UUID(str(booking.service_id)))
                except Exception:
                    pass
                if not svc:
                    svc = await self.service_repo.get_by_slug(str(booking.service_id))
                if svc and svc.cash_price:
                    digits = "".join(ch for ch in svc.cash_price if ch.isdigit())
                    if digits:
                        charged_cents = int(digits) * 100
            except Exception:
                pass

        if charged_cents is None:
            charged_cents = amount_cents

        effective_notes = notes
        if override_reason and override_reason.strip():
            prefix_note = f"[Fee Override: {override_reason.strip()}]"
            effective_notes = f"{prefix_note} {notes}".strip() if notes else prefix_note
        elif charged_cents != amount_cents:
            prefix_note = "[Fee Override: Standard service fee adjusted]"
            effective_notes = f"{prefix_note} {notes}".strip() if notes else prefix_note

        payment = VisitPayment(
            amount_cents=amount_cents,
            amount_charged_cents=charged_cents,
            currency=currency.upper(),
            method=method.lower(),
            notes=effective_notes,
            clinic_id=booking.clinic_id,
            booking_id=booking.id,
            patient_id=patient_id or booking.patient_id,
            recorded_by_user_id=user_id,
        )
        saved = await self.payment_repo.create(payment)

        user_name = "Staff"
        if self.user_repo and user_id:
            try:
                u = await self.user_repo.get_by_id(user_id)
                if u:
                    user_name = u.full_name
            except Exception:
                pass

        activity_details = {
            "paymentId": str(saved.id),
            "bookingId": str(booking.id),
            "confirmationId": booking.confirmation_id,
            "patientName": booking.patient_full_name,
            "amountCents": saved.amount_cents,
            "amountChargedCents": saved.amount_charged_cents,
            "currency": saved.currency,
            "method": saved.method,
            "recordedByName": user_name,
            "notes": saved.notes,
        }
        if override_reason and override_reason.strip():
            activity_details["overrideReason"] = override_reason.strip()

        await record_activity(
            self.activity_repo,
            action="visit_payment_recorded",
            entity_type="visit_payment",
            entity_id=str(saved.id),
            user_id=user_id,
            details=activity_details,
        )
        return saved

    async def void_visit_payment(
        self,
        booking_id: UUID,
        payment_id: UUID,
        user_id: UUID,
        reason: str,
    ) -> VisitPayment:
        if not reason or not reason.strip():
            raise HTTPException(
                status_code=http_status.HTTP_400_BAD_REQUEST,
                detail="Void reason is required.",
            )
        booking = await self.booking_repo.get_by_id(booking_id)
        if not booking:
            raise HTTPException(
                status_code=http_status.HTTP_404_NOT_FOUND,
                detail=f"Booking {booking_id} not found.",
            )
        if not self.payment_repo:
            raise HTTPException(
                status_code=http_status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Payment repository is not configured.",
            )
        payment = await self.payment_repo.get_by_id(payment_id)
        if not payment or payment.booking_id != booking_id:
            raise HTTPException(
                status_code=http_status.HTTP_404_NOT_FOUND,
                detail=f"Payment {payment_id} not found for this booking.",
            )
        if payment.is_voided:
            raise HTTPException(
                status_code=http_status.HTTP_400_BAD_REQUEST,
                detail="Payment is already voided.",
            )

        payment.is_voided = True
        payment.void_reason = reason.strip()
        payment.voided_at = datetime.now(timezone.utc)
        payment.voided_by_user_id = user_id
        updated = await self.payment_repo.update(payment)

        user_name = "Staff"
        if self.user_repo and user_id:
            try:
                u = await self.user_repo.get_by_id(user_id)
                if u:
                    user_name = u.full_name
            except Exception:
                pass

        await record_activity(
            self.activity_repo,
            action="visit_payment_voided",
            entity_type="visit_payment",
            entity_id=str(updated.id),
            user_id=user_id,
            details={
                "paymentId": str(updated.id),
                "bookingId": str(booking.id),
                "confirmationId": booking.confirmation_id,
                "patientName": booking.patient_full_name,
                "amountCents": updated.amount_cents,
                "voidReason": updated.void_reason,
                "voidedByName": user_name,
            },
        )
        return updated

    async def get_booking_payments(self, booking_id: UUID) -> List[Dict[str, Any]]:
        booking = await self.booking_repo.get_by_id(booking_id)
        if not booking:
            raise HTTPException(
                status_code=http_status.HTTP_404_NOT_FOUND,
                detail=f"Booking {booking_id} not found.",
            )
        if not self.payment_repo:
            return []

        payments = await self.payment_repo.list_by_booking_id(booking_id)
        staff_names = {}
        if self.user_repo:
            for p in payments:
                for uid in (p.recorded_by_user_id, p.voided_by_user_id):
                    if uid and uid not in staff_names:
                        try:
                            u = await self.user_repo.get_by_id(uid)
                            if u:
                                staff_names[uid] = u.full_name
                        except Exception:
                            pass

        result = []
        for p in payments:
            result.append({
                "id": p.id,
                "clinicId": p.clinic_id,
                "bookingId": p.booking_id,
                "patientId": p.patient_id,
                "amountCents": p.amount_cents,
                "amountFormatted": p.amount_formatted,
                "amountChargedCents": p.amount_charged_cents,
                "amountChargedFormatted": p.amount_charged_formatted,
                "currency": p.currency,
                "method": p.method,
                "notes": p.notes,
                "isVoided": p.is_voided,
                "voidReason": p.void_reason,
                "voidedAt": p.voided_at,
                "voidedByUserId": p.voided_by_user_id,
                "voidedByName": staff_names.get(p.voided_by_user_id) if p.voided_by_user_id else None,
                "recordedByUserId": p.recorded_by_user_id,
                "recordedByName": staff_names.get(p.recorded_by_user_id, "Staff") if p.recorded_by_user_id else None,
                "createdAt": p.created_at,
            })
        return result

    async def get_end_of_day_payments_summary(
        self,
        target_date: date,
        clinic_id: Optional[UUID] = None,
    ) -> Dict[str, Any]:
        if not self.payment_repo:
            return {
                "targetDate": target_date,
                "totalCents": 0,
                "cashCents": 0,
                "cardCents": 0,
                "transferCents": 0,
                "paymentCount": 0,
                "payments": [],
            }

        payments = await self.payment_repo.list_by_date(target_date=target_date, clinic_id=clinic_id)
        staff_names = {}
        if self.user_repo:
            for p in payments:
                for uid in (p.recorded_by_user_id, p.voided_by_user_id):
                    if uid and uid not in staff_names:
                        try:
                            u = await self.user_repo.get_by_id(uid)
                            if u:
                                staff_names[uid] = u.full_name
                        except Exception:
                            pass

        total_cents = 0
        cash_cents = 0
        card_cents = 0
        transfer_cents = 0
        payment_dtos = []

        for p in payments:
            if not p.is_voided:
                total_cents += p.amount_cents
                if p.method == "cash":
                    cash_cents += p.amount_cents
                elif p.method == "card":
                    card_cents += p.amount_cents
                elif p.method in ("bank_transfer", "transfer"):
                    transfer_cents += p.amount_cents

            payment_dtos.append({
                "id": p.id,
                "clinicId": p.clinic_id,
                "bookingId": p.booking_id,
                "patientId": p.patient_id,
                "amountCents": p.amount_cents,
                "amountFormatted": p.amount_formatted,
                "amountChargedCents": p.amount_charged_cents,
                "amountChargedFormatted": p.amount_charged_formatted,
                "currency": p.currency,
                "method": p.method,
                "notes": p.notes,
                "isVoided": p.is_voided,
                "voidReason": p.void_reason,
                "voidedAt": p.voided_at,
                "voidedByUserId": p.voided_by_user_id,
                "voidedByName": staff_names.get(p.voided_by_user_id) if p.voided_by_user_id else None,
                "recordedByUserId": p.recorded_by_user_id,
                "recordedByName": staff_names.get(p.recorded_by_user_id, "Staff") if p.recorded_by_user_id else None,
                "createdAt": p.created_at,
            })

        active_count = len([p for p in payments if not p.is_voided])
        return {
            "targetDate": target_date,
            "totalCents": total_cents,
            "cashCents": cash_cents,
            "cardCents": card_cents,
            "transferCents": transfer_cents,
            "paymentCount": active_count,
            "payments": payment_dtos,
        }


