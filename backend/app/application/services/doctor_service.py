from datetime import date, datetime, timezone
from typing import List, Optional
from uuid import UUID

from fastapi import HTTPException, status

from app.domain.models.booking_crm import Booking
from app.domain.repositories.booking_repo import BookingRepository


class DoctorService:
    def __init__(self, booking_repo: BookingRepository):
        self.booking_repo = booking_repo

    async def get_doctor_schedule(
        self,
        team_member_id: Optional[UUID] = None,
        clinic_id: Optional[UUID] = None,
        target_date: Optional[date] = None,
    ) -> List[Booking]:
        target = target_date or datetime.now(timezone.utc).date()
        bookings, _ = await self.booking_repo.list_bookings(
            clinic_id=clinic_id,
            team_member_id=team_member_id,
            date_from=target,
            date_to=target,
            limit=100,
        )
        return bookings

    async def get_appointment(self, booking_id: UUID) -> Booking:
        booking = await self.booking_repo.get_by_id(booking_id)
        if not booking:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Appointment booking not found.",
            )
        return booking

    async def update_notes(self, booking_id: UUID, staff_notes: str) -> Booking:
        booking = await self.booking_repo.get_by_id(booking_id)
        if not booking:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Appointment booking not found.",
            )
        booking.staff_notes = staff_notes
        return await self.booking_repo.save(booking)
