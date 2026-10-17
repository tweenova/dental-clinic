from dataclasses import dataclass
from datetime import date, datetime
from typing import Optional
from uuid import UUID


@dataclass
class WorkingHours:
    id: UUID
    day_of_week: int
    open_time: Optional[str]
    close_time: Optional[str]
    is_closed: bool
    clinic_id: Optional[UUID] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    @property
    def day_name(self) -> str:
        names = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
        return names[self.day_of_week] if 0 <= self.day_of_week < 7 else f"Day {self.day_of_week}"


@dataclass
class BookingSettings:
    id: UUID
    booking_mode: str  # "open" | "paused" | "closed"
    pause_message: Optional[str] = None
    pause_started_at: Optional[datetime] = None
    pause_started_by_user_id: Optional[UUID] = None
    resume_on: Optional[date] = None
    advance_booking_days: int = 60
    min_lead_time_hours: int = 2
    slot_interval_minutes: int = 15
    reminder_template: Optional[str] = None
    reminder_template_urdu: Optional[str] = None
    reminder_24h_enabled: bool = True
    reminder_2h_enabled: bool = True
    waiting_threshold_minutes: int = 15
    file_number_prefix: str = "MD-"
    payments_enabled: bool = True
    quiet_hours_enabled: bool = True
    quiet_hours_start: str = "21:00"
    quiet_hours_end: str = "08:00"
    messaging_provider_mode: str = "simulated"  # "simulated" | "disabled" | "twilio" | "whatsapp"
    clinic_id: Optional[UUID] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None


@dataclass
class ClinicClosure:
    id: UUID
    start_date: date
    end_date: date
    reason: str
    message: Optional[str] = None
    clinic_id: Optional[UUID] = None
    created_by_user_id: Optional[UUID] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None


@dataclass
class ProviderAvailability:
    id: UUID
    team_member_id: UUID
    day_of_week: int
    start_time: str
    end_time: str
    break_start_time: Optional[str] = None
    break_end_time: Optional[str] = None
    is_active: bool = True
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None


@dataclass
class ProviderTimeOff:
    id: UUID
    team_member_id: UUID
    start_date: date
    end_date: date
    reason: str
    is_approved: bool = True
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None


@dataclass
class ServiceProviderLink:
    id: UUID
    service_id: UUID
    team_member_id: UUID
    created_at: Optional[datetime] = None

