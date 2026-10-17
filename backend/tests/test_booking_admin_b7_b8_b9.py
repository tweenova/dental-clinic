import json
import pytest
from datetime import date, timedelta
from uuid import uuid4
from sqlalchemy import select

from app.domain.models.announcement import Announcement
from app.domain.models.booking_crm import Booking
from app.infrastructure.database.orm_models import ActivityLogORM
from app.infrastructure.repositories.postgres_announcement_repo import PostgresAnnouncementRepository
from app.infrastructure.repositories.postgres_booking_repo import PostgresBookingRepository
from app.infrastructure.repositories.postgres_task_repo import PostgresTaskRepository


@pytest.mark.asyncio
async def test_sunday_and_closure_date_availability(client_with_db, admin_auth, test_session):
    """Sunday and closure dates return no slots and are rejected on appointment submission."""
    client = client_with_db
    admin_headers = admin_auth["headers"]

    # 1. Check schedule endpoint
    sched_resp = await client.get("/api/v1/public/booking-schedule")
    assert sched_resp.status_code == 200
    sched_data = sched_resp.json()
    assert sched_data["advanceBookingDays"] == 60
    assert sched_data["closedDays"] == [6]  # Sunday is closed

    # 2. Add planned closure on next Wednesday
    today = date.today()
    days_to_wed = (2 - today.weekday()) % 7
    if days_to_wed == 0:
        days_to_wed = 7
    closure_date = today + timedelta(days=days_to_wed)

    closure_payload = {
        "startDate": closure_date.isoformat(),
        "endDate": closure_date.isoformat(),
        "reason": "Public Holiday",
        "message": "Closed for Pakistan Independence Day",
    }
    create_closure_resp = await client.post(
        "/api/v1/admin/booking/closures",
        json=closure_payload,
        headers=admin_headers,
    )
    assert create_closure_resp.status_code == 201

    # 3. Schedule now includes the closure
    sched_resp2 = await client.get("/api/v1/public/booking-schedule")
    assert sched_resp2.status_code == 200
    closures = sched_resp2.json()["closures"]
    assert any(c["reason"] == "Public Holiday" for c in closures)

    # 4. Attempt public booking on Sunday -> rejected with 422
    days_to_sun = (6 - today.weekday()) % 7
    if days_to_sun == 0:
        days_to_sun = 7
    sun_date = today + timedelta(days=days_to_sun)

    sun_booking_payload = {
        "serviceId": "cleanings-exams",
        "preferredDate": sun_date.isoformat(),
        "preferredTime": "10:00 AM",
        "fullName": "Sunday Patient",
        "phone": "3125550199",
        "email": "sun@example.com",
    }
    sun_resp = await client.post("/api/v1/appointments", json=sun_booking_payload)
    assert sun_resp.status_code == 422
    assert "Clinic is closed on Sundays" in sun_resp.json()["detail"]

    # 5. Attempt public booking on closure date -> rejected with 422
    closure_booking_payload = {
        "serviceId": "cleanings-exams",
        "preferredDate": closure_date.isoformat(),
        "preferredTime": "10:00 AM",
        "fullName": "Holiday Patient",
        "phone": "3125550198",
        "email": "holiday@example.com",
    }
    closure_resp = await client.post("/api/v1/appointments", json=closure_booking_payload)
    assert closure_resp.status_code == 422
    assert "Public Holiday" in closure_resp.json()["detail"]


@pytest.mark.asyncio
async def test_booking_mode_paused_and_closed_behaviors(admin_auth, receptionist_auth, client_with_db):
    """
    Mode paused: public submit rejected server-side (423) with message; reception can book.
    Mode closed: public submit rejected (423); reception booking requires override reason.
    """
    client = client_with_db
    admin_headers = admin_auth["headers"]
    rec_headers = receptionist_auth["headers"]

    today = date.today()
    # Pick a regular open weekday (e.g. tomorrow or day after if not Sunday)
    target_date = today + timedelta(days=1)
    if target_date.weekday() == 6:
        target_date += timedelta(days=1)

    # 1. Admin pauses booking
    pause_msg = "Due to emergency maintenance, online bookings are paused."
    mode_resp = await client.post(
        "/api/v1/admin/booking/mode",
        json={"mode": "paused", "message": pause_msg},
        headers=admin_headers,
    )
    assert mode_resp.status_code == 200
    assert mode_resp.json()["settings"]["bookingMode"] == "paused"

    # Public booking fails with 423 Locked
    pub_payload = {
        "serviceId": "cleanings-exams",
        "preferredDate": target_date.isoformat(),
        "preferredTime": "10:00 AM",
        "fullName": "Test Paused Patient",
        "phone": "3125550111",
        "email": "paused@example.com",
    }
    pub_resp = await client.post("/api/v1/appointments", json=pub_payload)
    assert pub_resp.status_code == 423
    assert pause_msg in pub_resp.json()["detail"]

    # Reception CAN book normally in paused mode without any override
    rec_payload = {
        "patientFullName": "Walk In Patient",
        "patientPhone": "3125550112",
        "patientEmail": "walkin@example.com",
        "preferredDate": target_date.isoformat(),
        "preferredTime": "11:00 AM",
        "status": "confirmed",
    }
    rec_resp = await client.post("/api/v1/reception/appointments", json=rec_payload, headers=rec_headers)
    assert rec_resp.status_code == 201

    # 2. Admin sets mode to closed
    closed_msg = "Clinic closed due to severe weather."
    await client.post(
        "/api/v1/admin/booking/mode",
        json={"mode": "closed", "message": closed_msg},
        headers=admin_headers,
    )

    # Public booking still fails with 423
    pub_resp2 = await client.post("/api/v1/appointments", json=pub_payload)
    assert pub_resp2.status_code == 423
    assert closed_msg in pub_resp2.json()["detail"]

    # Reception booking WITHOUT override reason fails with 422
    rec_payload2 = {
        "patientFullName": "Severe Emergency Patient",
        "patientPhone": "3125550113",
        "patientEmail": "emergency@example.com",
        "preferredDate": target_date.isoformat(),
        "preferredTime": "02:00 PM",
        "status": "confirmed",
    }
    rec_resp2 = await client.post("/api/v1/reception/appointments", json=rec_payload2, headers=rec_headers)
    assert rec_resp2.status_code == 422
    assert "recorded reason is required" in rec_resp2.json()["detail"]

    # Reception booking WITH override reason succeeds
    rec_payload2["overrideReason"] = "Emergency tooth extraction authorised by on-call dentist"
    rec_resp3 = await client.post("/api/v1/reception/appointments", json=rec_payload2, headers=rec_headers)
    assert rec_resp3.status_code == 201
    assert rec_resp3.json()["patientFullName"] == "Severe Emergency Patient"


@pytest.mark.asyncio
async def test_public_booking_status_no_phi_leak(client_with_db, admin_auth):
    """GET /api/v1/public/booking-status returns only mode, message, phone, resumeOn and NO personal data."""
    client = client_with_db
    admin_headers = admin_auth["headers"]

    resume_target = (date.today() + timedelta(days=3)).isoformat()
    await client.post(
        "/api/v1/admin/booking/mode",
        json={"mode": "paused", "message": "System upgrade in progress", "resumeOn": resume_target},
        headers=admin_headers,
    )

    resp = await client.get("/api/v1/public/booking-status")
    assert resp.status_code == 200
    data = resp.json()

    # Exact expected public keys
    assert set(data.keys()) == {"mode", "message", "phone", "resumeOn"}
    assert data["mode"] == "paused"
    assert data["message"] == "System upgrade in progress"
    assert data["resumeOn"] == resume_target
    assert "admin" not in resp.text
    assert "user" not in resp.text
    assert "email" not in resp.text


@pytest.mark.asyncio
async def test_closure_creation_affected_bookings_and_idempotent_tasks(admin_auth, test_session, client_with_db):
    """
    Creating a closure over existing bookings returns the affected list without changing bookings.
    Bulk action creates exactly one task per booking; running twice does not duplicate tasks.
    """
    client = client_with_db
    admin_headers = admin_auth["headers"]
    booking_repo = PostgresBookingRepository(test_session)
    task_repo = PostgresTaskRepository(test_session)

    target_date = date.today() + timedelta(days=10)

    # Create 2 bookings scheduled on target_date
    b1 = Booking(
        confirmation_id="BK-AFFECTED-1",
        preferred_date=target_date,
        preferred_time="09:00 AM",
        patient_full_name="Fatima Ali",
        patient_phone="3125550201",
        patient_email="fatima@example.com",
        status="confirmed",
    )
    b2 = Booking(
        confirmation_id="BK-AFFECTED-2",
        preferred_date=target_date,
        preferred_time="10:00 AM",
        patient_full_name="Tariq Khan",
        patient_phone="3125550202",
        patient_email="tariq@example.com",
        status="requested",
    )
    await booking_repo.save(b1)
    await booking_repo.save(b2)
    await test_session.commit()

    # 1. Admin creates closure covering target_date
    closure_payload = {
        "startDate": target_date.isoformat(),
        "endDate": target_date.isoformat(),
        "reason": "Facility Power Maintenance",
        "message": "Full clinic power shutdown",
    }
    create_resp = await client.post("/api/v1/admin/booking/closures", json=closure_payload, headers=admin_headers)
    assert create_resp.status_code == 201
    create_data = create_resp.json()

    # Affected bookings returned
    affected = create_data["affectedBookings"]
    assert len(affected) == 2
    affected_ids = [b["id"] for b in affected]
    assert str(b1.id) in affected_ids
    assert str(b2.id) in affected_ids

    # Existing bookings were NOT cancelled or moved
    b1_refreshed = await booking_repo.get_by_id(b1.id)
    assert b1_refreshed.status == "confirmed"
    assert b1_refreshed.preferred_date == target_date

    # 2. Admin creates reschedule tasks
    resched_resp = await client.post(
        "/api/v1/admin/booking/reschedule-tasks",
        json={"bookingIds": affected_ids},
        headers=admin_headers,
    )
    assert resched_resp.status_code == 201
    resched_data = resched_resp.json()
    assert resched_data["tasksCreated"] == 2

    # Check task contents
    tasks, _ = await task_repo.list_tasks(limit=10)
    resched_tasks = [t for t in tasks if t.title.startswith("Call to reschedule:")]
    assert len(resched_tasks) == 2
    assert any("Fatima Ali" in t.title and target_date.isoformat() in t.title for t in resched_tasks)
    assert all(t.priority == "high" for t in resched_tasks)

    # 3. Running bulk action a second time creates NO duplicate tasks
    resched_resp2 = await client.post(
        "/api/v1/admin/booking/reschedule-tasks",
        json={"bookingIds": affected_ids},
        headers=admin_headers,
    )
    assert resched_resp2.status_code == 201
    assert resched_resp2.json()["tasksCreated"] == 0

    tasks_after, _ = await task_repo.list_tasks(limit=10)
    resched_tasks_after = [t for t in tasks_after if t.title.startswith("Call to reschedule:")]
    assert len(resched_tasks_after) == 2


@pytest.mark.asyncio
async def test_mode_changes_and_closures_audited_and_rbac(admin_auth, receptionist_auth, client_with_db, test_session):
    """Mode changes and closures write activity logs. Non-admin users receive 403."""
    client = client_with_db
    admin_headers = admin_auth["headers"]
    rec_headers = receptionist_auth["headers"]

    # 1. Receptionist gets 403 on admin booking endpoints
    r1 = await client.get("/api/v1/admin/booking/settings", headers=rec_headers)
    assert r1.status_code == 403

    r2 = await client.post("/api/v1/admin/booking/mode", json={"mode": "paused"}, headers=rec_headers)
    assert r2.status_code == 403

    r3 = await client.get("/api/v1/admin/booking/closures", headers=rec_headers)
    assert r3.status_code == 403

    # 2. Admin performs mode change and closure creation
    await client.post(
        "/api/v1/admin/booking/mode",
        json={"mode": "paused", "message": "Audited pause"},
        headers=admin_headers,
    )

    today = date.today()
    c_resp = await client.post(
        "/api/v1/admin/booking/closures",
        json={
            "startDate": (today + timedelta(days=20)).isoformat(),
            "endDate": (today + timedelta(days=20)).isoformat(),
            "reason": "Staff Training",
        },
        headers=admin_headers,
    )
    assert c_resp.status_code == 201
    closure_id = c_resp.json()["closure"]["id"]

    # 3. Check activity logs
    res = await test_session.execute(select(ActivityLogORM))
    logs = res.scalars().all()
    actions = [l.action for l in logs]
    assert "update_booking_mode" in actions
    assert "create_clinic_closure" in actions

    # Verify audit details include actor and changes
    mode_log = next(l for l in logs if l.action == "update_booking_mode")
    assert mode_log.user_id == admin_auth["user"].id
    details = json.loads(mode_log.details_json) if mode_log.details_json else {}
    assert details["before"]["mode"] == "open"
    assert details["after"]["mode"] == "paused"

    # Delete closure and check audit
    del_resp = await client.delete(f"/api/v1/admin/booking/closures/{closure_id}", headers=admin_headers)
    assert del_resp.status_code == 204

    res_after = await test_session.execute(select(ActivityLogORM))
    logs_after = res_after.scalars().all()
    del_actions = [l.action for l in logs_after]
    assert "delete_clinic_closure" in del_actions


@pytest.mark.asyncio
async def test_reopening_removes_auto_banner_but_preserves_manual(admin_auth, client_with_db, test_session):
    """Reopening removes auto booking announcement but preserves manual announcements."""
    client = client_with_db
    admin_headers = admin_auth["headers"]
    announcement_repo = PostgresAnnouncementRepository(test_session)

    # 1. Seed manual announcement
    manual_ann = Announcement(
        content="Free dental consultation every Saturday this month!",
        is_active=True,
        display_order=1,
        is_auto_booking_banner=False,
    )
    await announcement_repo.save(manual_ann)
    await test_session.commit()

    # 2. Pause booking -> triggers auto banner
    pause_msg = "Online booking is paused for server migration."
    await client.post(
        "/api/v1/admin/booking/mode",
        json={"mode": "paused", "message": pause_msg},
        headers=admin_headers,
    )

    # Public announcements should have 2 items: manual + auto banner
    ann_resp = await client.get("/api/v1/public/announcements")
    assert ann_resp.status_code == 200
    ann_list = ann_resp.json()
    assert len(ann_list) == 2
    contents = [a["content"] for a in ann_list]
    assert pause_msg in contents
    assert "Free dental consultation every Saturday this month!" in contents

    # 3. Reopen booking
    await client.post(
        "/api/v1/admin/booking/mode",
        json={"mode": "open"},
        headers=admin_headers,
    )

    # Auto banner is removed, manual remains!
    ann_resp2 = await client.get("/api/v1/public/announcements")
    assert ann_resp2.status_code == 200
    ann_list2 = ann_resp2.json()
    assert len(ann_list2) == 1
    assert ann_list2[0]["content"] == "Free dental consultation every Saturday this month!"
