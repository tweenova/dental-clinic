import random
import string
from datetime import date, datetime, timedelta, timezone
from typing import Any, Dict, List, Optional, Tuple
from uuid import UUID

from fastapi import HTTPException, status

from app.domain.models.booking_crm import Booking, Lead, Message, Patient, Task
from app.domain.models.appointment import Appointment, AppointmentStatus
from app.domain.repositories.appointment_repo import AppointmentRepository
from app.domain.repositories.booking_repo import BookingRepository
from app.domain.repositories.lead_repo import LeadRepository
from app.domain.repositories.message_repo import MessageRepository
from app.domain.repositories.patient_repo import PatientRepository
from app.domain.repositories.task_repo import TaskRepository


def generate_booking_confirmation_id() -> str:
    year = datetime.now(timezone.utc).year
    suffix = "".join(random.choices(string.digits, k=4))
    return f"BK-{year}-{suffix}"


class ReceptionService:
    def __init__(
        self,
        booking_repo: BookingRepository,
        patient_repo: PatientRepository,
        task_repo: TaskRepository,
        lead_repo: LeadRepository,
        message_repo: MessageRepository,
        appointment_repo: AppointmentRepository,
    ):
        self.booking_repo = booking_repo
        self.patient_repo = patient_repo
        self.task_repo = task_repo
        self.lead_repo = lead_repo
        self.message_repo = message_repo
        self.appointment_repo = appointment_repo

    async def get_dashboard_summary(
        self, clinic_id: Optional[UUID] = None
    ) -> Dict[str, Any]:
        today = datetime.now(timezone.utc).date()

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
        urgent_tasks = [t for t in tasks if t.priority in ("urgent", "high")]

        leads, total_leads = await self.lead_repo.list_leads(
            clinic_id=clinic_id, status="new", limit=100
        )

        # 3. Needs Attention items
        needs_attention = []

        # A. Unconfirmed appointments today
        for b in today_bookings:
            if b.status in ("requested", "unconfirmed"):
                needs_attention.append({
                    "id": str(b.id),
                    "type": "unconfirmed_appointment",
                    "title": f"Unconfirmed Visit: {b.patient_full_name}",
                    "subtitle": f"{b.preferred_time} today · {b.patient_phone}",
                    "actionRoute": f"/reception/appointments/confirmations",
                    "severity": "high",
                })

        # B. Late arrivals (arrived/scheduled > 15m ago without being in_progress)
        # C. Urgent tasks
        for t in urgent_tasks[:5]:
            needs_attention.append({
                "id": str(t.id),
                "type": "urgent_task",
                "title": f"Task: {t.title}",
                "subtitle": f"Priority: {t.priority.upper()}",
                "actionRoute": "/reception/tasks",
                "severity": "urgent",
            })

        # D. New leads
        for l in leads[:5]:
            needs_attention.append({
                "id": str(l.id),
                "type": "new_lead",
                "title": f"Inquiry from {l.full_name}",
                "subtitle": f"Phone: {l.phone}",
                "actionRoute": "/reception/leads",
                "severity": "medium",
            })

        # Recalls due count (patients without visit in 6 months)
        recalls_due = await self.get_recalls(clinic_id=clinic_id)

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
            "pendingRequestsCount": len([b for b in today_bookings if b.status == "requested"]),
            "urgentTasksCount": len(urgent_tasks),
            "newLeadsCount": total_leads,
            "recallsDueCount": len(recalls_due),
            "needsAttentionCount": len(needs_attention),
            "todayFlow": today_bookings,
            "needsAttentionItems": needs_attention,
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
    ) -> Booking:
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
            status=status,
            notes=notes,
            staff_notes=staff_notes,
        )
        return await self.booking_repo.save(booking)

    async def update_booking_status(
        self, booking_id: UUID, new_status: str, staff_notes: Optional[str] = None
    ) -> Booking:
        booking = await self.booking_repo.get_by_id(booking_id)
        if not booking:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="Booking record not found."
            )
        booking.status = new_status
        if staff_notes:
            booking.staff_notes = staff_notes
        return await self.booking_repo.save(booking)

    async def reschedule_booking(
        self,
        booking_id: UUID,
        preferred_date: date,
        preferred_time: str,
        team_member_id: Optional[UUID] = None,
        slot_id: Optional[UUID] = None,
        staff_notes: Optional[str] = None,
    ) -> Booking:
        booking = await self.booking_repo.get_by_id(booking_id)
        if not booking:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="Booking record not found."
            )
        booking.preferred_date = preferred_date
        booking.preferred_time = preferred_time
        if team_member_id:
            booking.team_member_id = team_member_id
        if slot_id:
            booking.slot_id = slot_id
        if staff_notes:
            booking.staff_notes = staff_notes
        booking.status = "confirmed"
        return await self.booking_repo.save(booking)

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

        patient = Patient(
            first_name=first_name.strip(),
            last_name=last_name.strip(),
            phone=phone.strip(),
            email=email.strip().lower() if email else None,
            date_of_birth=date_of_birth,
            clinic_id=clinic_id,
            notes=notes,
        )
        saved = await self.patient_repo.save(patient)
        return saved, []

    async def get_patient_profile(self, patient_id: UUID) -> Dict[str, Any]:
        patient = await self.patient_repo.get_by_id(patient_id)
        if not patient:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="Patient not found."
            )
        bookings = await self.booking_repo.get_patient_bookings(patient_id)
        today = datetime.now(timezone.utc).date()
        upcoming = [b for b in bookings if b.preferred_date >= today]
        past = [b for b in bookings if b.preferred_date < today]

        return {
            "patient": patient,
            "upcomingAppointments": upcoming,
            "pastAppointments": past,
            "tasks": [],
            "messages": [],
        }

    async def update_patient(
        self, patient_id: UUID, updates: Dict[str, Any]
    ) -> Patient:
        patient = await self.patient_repo.get_by_id(patient_id)
        if not patient:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="Patient not found."
            )
        for k, v in updates.items():
            if hasattr(patient, k) and v is not None:
                setattr(patient, k, v)
        return await self.patient_repo.save(patient)

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
        description: Optional[str] = None,
        priority: str = "medium",
        status: str = "pending",
        due_date: Optional[datetime] = None,
    ) -> Task:
        task = Task(
            title=title,
            clinic_id=clinic_id,
            assigned_to_user_id=assigned_to_user_id,
            description=description,
            priority=priority,
            status=status,
            due_date=due_date,
        )
        return await self.task_repo.save(task)

    async def update_task(
        self, task_id: UUID, updates: Dict[str, Any]
    ) -> Task:
        task = await self.task_repo.get_by_id(task_id)
        if not task:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="Task not found."
            )
        for k, v in updates.items():
            if hasattr(task, k) and v is not None:
                setattr(task, k, v)
        return await self.task_repo.save(task)

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
        phone: Optional[str] = None,
        email: Optional[str] = None,
        channel: str = "sms",
    ) -> Message:
        msg = Message(
            content=content,
            sender_id=sender_id,
            recipient_id=recipient_id,
            phone=phone,
            email=email,
            channel=channel,
            status="sent",
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
                status_code=status.HTTP_404_NOT_FOUND, detail="Lead not found."
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
                status_code=status.HTTP_404_NOT_FOUND, detail="Lead not found."
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

    async def get_recalls(
        self, clinic_id: Optional[UUID] = None
    ) -> List[Dict[str, Any]]:
        # Derived recall list: patients who had a visit > 180 days ago and no future booking
        six_months_ago = datetime.now(timezone.utc).date() - timedelta(days=180)
        past_bookings, _ = await self.booking_repo.list_bookings(
            clinic_id=clinic_id,
            date_to=six_months_ago,
            status="completed",
            limit=50,
        )
        recalls = []
        for b in past_bookings:
            recalls.append({
                "patientId": str(b.patient_id) if b.patient_id else str(b.id),
                "patientFullName": b.patient_full_name,
                "phone": b.patient_phone,
                "email": b.patient_email,
                "lastVisitDate": b.preferred_date.isoformat(),
                "serviceId": b.service_id or "cleanings-exams",
                "status": "due",
                "clinicId": str(b.clinic_id) if b.clinic_id else None,
            })
        return recalls
