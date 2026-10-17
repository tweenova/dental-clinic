import re
from datetime import date, datetime, timezone
from typing import Optional, Set
from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

# Ground truth from frontend: src/app/book/page.tsx
ALLOWED_SERVICES: Set[str] = {
    "cleanings-exams",
    "fillings-crowns",
    "root-canals",
    "invisalign",
    "whitening",
    "emergency",
}

ALLOWED_TIME_SLOTS: Set[str] = {
    "8:30 AM",
    "10:00 AM",
    "11:30 AM",
    "1:30 PM",
    "3:00 PM",
    "4:30 PM",
}


class AppointmentCreateRequest(BaseModel):
    """
    Defines and validates the fields required when a patient submits an appointment booking form.

    This ensures incoming data has proper names, valid contact information, and realistic
    dates before the server attempts to save anything.
    """
    serviceId: str = Field(..., description="Service identifier selected by patient")
    preferredDate: str = Field(..., description="Target appointment date (YYYY-MM-DD)")
    preferredTime: str = Field(..., description="Requested time slot")
    fullName: str = Field(..., min_length=2, max_length=100, description="Full legal name")
    phone: str = Field(..., min_length=10, max_length=30, description="Patient contact telephone")
    email: str = Field(..., min_length=5, max_length=150, description="Patient email address")
    notes: Optional[str] = Field(default=None, max_length=1000, description="Optional patient notes or symptoms")
    utmSource: Optional[str] = Field(default=None, max_length=100, description="Marketing source attribution")
    utmCampaign: Optional[str] = Field(default=None, max_length=100, description="Marketing campaign attribution")

    model_config = ConfigDict(extra="ignore")


    @field_validator("serviceId")
    @classmethod
    def validate_service_id(cls, v: str) -> str:
        """Checks that the requested dental procedure matches a standard service or UUID."""
        clean = v.strip().lower()
        if clean in ALLOWED_SERVICES:
            return clean
        try:
            from uuid import UUID
            UUID(clean)
            return clean
        except ValueError:
            raise ValueError(f"Invalid serviceId '{v}'. Must be one of: {', '.join(sorted(ALLOWED_SERVICES))} or a valid service UUID.")

    @field_validator("preferredDate")
    @classmethod
    def validate_preferred_date(cls, v: str) -> str:
        """Verifies that the requested appointment date is formatted correctly and is not in the past."""
        try:
            parsed_date = date.fromisoformat(v.strip())
        except ValueError:
            raise ValueError("preferredDate must be a valid date in YYYY-MM-DD format.")

        today_utc = datetime.now(timezone.utc).date()
        if parsed_date < today_utc:
            raise ValueError("preferredDate cannot be in the past.")
        return parsed_date.isoformat()

    @field_validator("preferredTime")
    @classmethod
    def validate_preferred_time(cls, v: str) -> str:
        """Confirms that the requested time slot is formatted as 12-hour AM/PM and within clinic hours."""
        clean = v.strip().upper()
        m = re.match(r"^(\d{1,2}):(\d{2})\s*(AM|PM)$", clean)
        if not m:
            raise ValueError(f"Invalid preferredTime '{v}'. Must be formatted like '10:00 AM' or '02:30 PM'.")
        hour = int(m.group(1))
        minute = int(m.group(2))
        ampm = m.group(3)
        if hour < 1 or hour > 12 or minute < 0 or minute > 59:
            raise ValueError(f"Invalid preferredTime '{v}'.")
        h24 = (hour % 12) + (12 if ampm == "PM" else 0)
        total_mins = h24 * 60 + minute
        # Operating hours bounds: 08:00 AM (480 mins) to 08:00 PM (1200 mins)
        if total_mins < 8 * 60 or total_mins > 20 * 60:
            raise ValueError(f"Invalid preferredTime '{v}'. Time slot is outside clinic operating hours.")
        return clean

    @field_validator("fullName")
    @classmethod
    def validate_full_name(cls, v: str) -> str:
        """Checks that the patient entered a real full name with at least two characters."""
        clean = v.strip()
        if len(clean) < 2:
            raise ValueError("fullName must be at least 2 characters.")
        return clean

    @field_validator("phone")
    @classmethod
    def validate_phone(cls, v: str) -> str:
        """Ensures the phone number contains at least 10 numeric digits so staff can call the patient back."""
        digits = re.sub(r"\D", "", v)
        if len(digits) < 10:
            raise ValueError("phone must contain at least 10 digits.")
        return v.strip()

    @field_validator("email")
    @classmethod
    def validate_email(cls, v: str) -> str:
        """Confirms the email address has a standard format with an '@' symbol and a domain name."""
        clean = v.strip().lower()
        if "@" not in clean or "." not in clean.split("@")[-1]:
            raise ValueError("email must be a valid email address.")
        return clean



class AppointmentCreateResponse(BaseModel):
    """
    The structured response sent back to the patient's browser after booking.

    It contains the unique tracking number and confirmation message while excluding all
    private health information to keep personal data safe.
    """
    success: bool = True
    confirmationId: str
    message: str
    estimatedCallbackWindow: str
