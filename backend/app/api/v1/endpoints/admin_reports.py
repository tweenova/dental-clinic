import csv
import io
import statistics
from datetime import date, datetime, timedelta
from typing import Any, Dict, List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, Query, Request, Response, status
from pydantic import BaseModel
from sqlalchemy import desc, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import (
    get_activity_log_repository,
    get_current_user,
    get_db_session,
    require_admin,
)
from app.domain.models.user import User
from app.infrastructure.database.orm_models import (
    BookingORM,
    ServiceORM,
    PatientORM,
    TaskORM,
    TeamMemberORM,
)
from app.infrastructure.repositories.postgres_activity_repo import (
    PostgresActivityLogRepository,
    record_activity,
)

router = APIRouter(
    prefix="/admin/reports",
    tags=["Admin Reports"],
    dependencies=[Depends(require_admin)],
)


# ---------------------------------------------------------------------------
# DTO Models
# ---------------------------------------------------------------------------

class AppointmentsReportResponse(BaseModel):
    startDate: str
    endDate: str
    totalAppointments: int
    byStatus: Dict[str, int]
    byClinician: List[Dict[str, Any]]
    dailyCounts: List[Dict[str, Any]]


class CancellationsReportResponse(BaseModel):
    startDate: str
    endDate: str
    totalBookings: int
    totalCancelled: int
    totalNoShow: int
    cancellationRatePercent: float
    noShowRatePercent: float
    reasonsBreakdown: List[Dict[str, Any]]
    recentEntries: List[Dict[str, Any]]


class RecallComplianceReportResponse(BaseModel):
    totalPatientsEvaluated: int
    totalRecallsDue: int
    recallsContacted: int
    recallsBooked: int
    complianceRatePercent: float
    byService: List[Dict[str, Any]]
    overdueBuckets: Dict[str, int]


class OperationalTimingReportResponse(BaseModel):
    startDate: str
    endDate: str
    totalVisitsRecorded: int
    medianWaitMinutes: Optional[float] = None
    averageWaitMinutes: Optional[float] = None
    medianChairMinutes: Optional[float] = None
    averageChairMinutes: Optional[float] = None
    waitTimeDistribution: Dict[str, int]
    chairTimeDistribution: Dict[str, int]


# ---------------------------------------------------------------------------
# 1. Appointments Report
# ---------------------------------------------------------------------------

@router.get("/appointments", response_model=AppointmentsReportResponse)
async def get_appointments_report(
    start_date: Optional[date] = Query(None, description="Start date (YYYY-MM-DD)"),
    end_date: Optional[date] = Query(None, description="End date (YYYY-MM-DD)"),
    clinician_id: Optional[UUID] = Query(None, description="Optional team member filter"),
    session: AsyncSession = Depends(get_db_session),
) -> AppointmentsReportResponse:
    """
    Returns appointment counts by status, clinician distribution, and daily timeline.
    Aggregate workflow metrics only (no per-person clinician scores).
    """
    today = date.today()
    s_date = start_date or (today - timedelta(days=30))
    e_date = end_date or today

    conditions = [
        BookingORM.preferred_date >= s_date,
        BookingORM.preferred_date <= e_date,
    ]
    if clinician_id:
        conditions.append(BookingORM.team_member_id == clinician_id)

    # 1. By status query
    status_query = (
        select(BookingORM.status, func.count(BookingORM.id))
        .where(*conditions)
        .group_by(BookingORM.status)
    )
    status_res = await session.execute(status_query)
    by_status = {r[0]: r[1] for r in status_res.all()}
    total = sum(by_status.values())

    # 2. By clinician query
    clinician_query = (
        select(
            BookingORM.team_member_id,
            TeamMemberORM.display_name,
            BookingORM.status,
            func.count(BookingORM.id),
        )
        .outerjoin(TeamMemberORM, BookingORM.team_member_id == TeamMemberORM.id)
        .where(*conditions)
        .group_by(BookingORM.team_member_id, TeamMemberORM.display_name, BookingORM.status)
    )
    clin_res = await session.execute(clinician_query)
    clin_dict: Dict[str, Dict[str, Any]] = {}
    for t_id, d_name, b_status, count in clin_res.all():
        cid = str(t_id) if t_id else "unassigned"
        cname = d_name or "Unassigned Clinician"
        if cid not in clin_dict:
            clin_dict[cid] = {
                "clinicianId": cid,
                "clinicianName": cname,
                "total": 0,
                "statuses": {},
            }
        clin_dict[cid]["total"] += count
        clin_dict[cid]["statuses"][b_status] = count

    by_clinician = sorted(clin_dict.values(), key=lambda x: x["total"], reverse=True)

    # 3. Daily timeline
    daily_stmt = (
        select(BookingORM.preferred_date, BookingORM.status, func.count(BookingORM.id))
        .where(*conditions)
        .group_by(BookingORM.preferred_date, BookingORM.status)
        .order_by(BookingORM.preferred_date)
    )
    daily_res = await session.execute(daily_stmt)
    daily_map: Dict[str, Dict[str, int]] = {}
    for d, st, cnt in daily_res.all():
        ds = d.isoformat()
        if ds not in daily_map:
            daily_map[ds] = {"date": ds, "total": 0, "completed": 0, "cancelled": 0}
        daily_map[ds]["total"] += cnt
        if st == "completed":
            daily_map[ds]["completed"] += cnt
        elif st in ("cancelled", "no_show"):
            daily_map[ds]["cancelled"] += cnt

    daily_counts = sorted(daily_map.values(), key=lambda x: x["date"])

    return AppointmentsReportResponse(
        startDate=s_date.isoformat(),
        endDate=e_date.isoformat(),
        totalAppointments=total,
        byStatus=by_status,
        byClinician=by_clinician,
        dailyCounts=daily_counts,
    )


@router.get("/export/appointments")
async def export_appointments_report_csv(
    request: Request,
    start_date: Optional[date] = Query(None),
    end_date: Optional[date] = Query(None),
    clinician_id: Optional[UUID] = Query(None),
    session: AsyncSession = Depends(get_db_session),
    activity_repo: PostgresActivityLogRepository = Depends(get_activity_log_repository),
    current_user: User = Depends(get_current_user),
) -> Response:
    """Exports appointment activity report as CSV. Audited."""
    today = date.today()
    s_date = start_date or (today - timedelta(days=30))
    e_date = end_date or today

    conditions = [
        BookingORM.preferred_date >= s_date,
        BookingORM.preferred_date <= e_date,
    ]
    if clinician_id:
        conditions.append(BookingORM.team_member_id == clinician_id)

    query = (
        select(
            BookingORM.preferred_date,
            BookingORM.preferred_time,
            BookingORM.confirmation_id,
            BookingORM.status,
            BookingORM.patient_full_name,
            BookingORM.patient_phone,
            BookingORM.service_id,
            TeamMemberORM.display_name.label("clinician_name"),
        )
        .outerjoin(TeamMemberORM, BookingORM.team_member_id == TeamMemberORM.id)
        .where(*conditions)
        .order_by(desc(BookingORM.preferred_date), BookingORM.preferred_time)
        .limit(5000)
    )
    res = await session.execute(query)
    rows = res.all()

    await record_activity(
        activity_repo=activity_repo,
        action="export",
        entity_type="report_appointments",
        entity_id="appointments_csv",
        user_id=current_user.id,
        details={"recordCount": len(rows), "startDate": s_date.isoformat(), "endDate": e_date.isoformat()},
        ip_address=request.client.host if request.client else None,
    )

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["Date", "Time", "Confirmation ID", "Status", "Patient Name", "Phone", "Service", "Clinician"])
    for r in rows:
        writer.writerow([
            r.preferred_date.isoformat(),
            r.preferred_time,
            r.confirmation_id,
            r.status,
            r.patient_full_name,
            r.patient_phone,
            r.service_id or "N/A",
            r.clinician_name or "Unassigned",
        ])

    csv_data = output.getvalue()
    filename = f"appointments_report_{s_date}_{e_date}.csv"
    return Response(content=csv_data, media_type="text/csv", headers={"Content-Disposition": f'attachment; filename="{filename}"'})


# ---------------------------------------------------------------------------
# 2. Cancellations and No-Shows Report
# ---------------------------------------------------------------------------

@router.get("/cancellations-no-shows", response_model=CancellationsReportResponse)
async def get_cancellations_report(
    start_date: Optional[date] = Query(None),
    end_date: Optional[date] = Query(None),
    clinician_id: Optional[UUID] = Query(None),
    session: AsyncSession = Depends(get_db_session),
) -> CancellationsReportResponse:
    """
    Returns cancellations and no-shows aggregate metrics with root-cause categorization.
    """
    today = date.today()
    s_date = start_date or (today - timedelta(days=30))
    e_date = end_date or today

    base_conditions = [
        BookingORM.preferred_date >= s_date,
        BookingORM.preferred_date <= e_date,
    ]
    if clinician_id:
        base_conditions.append(BookingORM.team_member_id == clinician_id)

    # Total bookings
    total_bookings = (await session.execute(select(func.count(BookingORM.id)).where(*base_conditions))).scalar() or 0

    # Cancellations and no-shows
    canc_conditions = base_conditions + [BookingORM.status.in_(["cancelled", "no_show"])]
    canc_query = (
        select(
            BookingORM.id,
            BookingORM.preferred_date,
            BookingORM.confirmation_id,
            BookingORM.status,
            BookingORM.cancellation_reason,
            BookingORM.patient_full_name,
            TeamMemberORM.display_name.label("clinician_name"),
        )
        .outerjoin(TeamMemberORM, BookingORM.team_member_id == TeamMemberORM.id)
        .where(*canc_conditions)
        .order_by(desc(BookingORM.preferred_date))
    )
    canc_res = await session.execute(canc_query)
    canc_rows = canc_res.all()

    total_cancelled = sum(1 for r in canc_rows if r.status == "cancelled")
    total_no_show = sum(1 for r in canc_rows if r.status == "no_show")

    canc_rate = round((total_cancelled / total_bookings * 100), 1) if total_bookings > 0 else 0.0
    noshow_rate = round((total_no_show / total_bookings * 100), 1) if total_bookings > 0 else 0.0

    # Group reasons
    reasons_count: Dict[str, int] = {}
    for r in canc_rows:
        reason = (r.cancellation_reason or "No reason recorded").strip()
        reasons_count[reason] = reasons_count.get(reason, 0) + 1

    total_with_reasons = len(canc_rows)
    reasons_breakdown = [
        {
            "reason": r,
            "count": c,
            "percentage": round((c / total_with_reasons * 100), 1) if total_with_reasons > 0 else 0.0,
        }
        for r, c in sorted(reasons_count.items(), key=lambda x: x[1], reverse=True)
    ]

    recent_entries = [
        {
            "date": r.preferred_date.isoformat(),
            "confirmationId": r.confirmation_id,
            "patientName": r.patient_full_name,
            "clinicianName": r.clinician_name or "Unassigned",
            "status": r.status,
            "reason": r.cancellation_reason or "None recorded",
        }
        for r in canc_rows[:25]
    ]

    return CancellationsReportResponse(
        startDate=s_date.isoformat(),
        endDate=e_date.isoformat(),
        totalBookings=total_bookings,
        totalCancelled=total_cancelled,
        totalNoShow=total_no_show,
        cancellationRatePercent=canc_rate,
        noShowRatePercent=noshow_rate,
        reasonsBreakdown=reasons_breakdown,
        recentEntries=recent_entries,
    )


@router.get("/export/cancellations-no-shows")
async def export_cancellations_report_csv(
    request: Request,
    start_date: Optional[date] = Query(None),
    end_date: Optional[date] = Query(None),
    clinician_id: Optional[UUID] = Query(None),
    session: AsyncSession = Depends(get_db_session),
    activity_repo: PostgresActivityLogRepository = Depends(get_activity_log_repository),
    current_user: User = Depends(get_current_user),
) -> Response:
    """Exports cancellations and no-shows as CSV with reasons. Audited."""
    today = date.today()
    s_date = start_date or (today - timedelta(days=30))
    e_date = end_date or today

    conditions = [
        BookingORM.preferred_date >= s_date,
        BookingORM.preferred_date <= e_date,
        BookingORM.status.in_(["cancelled", "no_show"]),
    ]
    if clinician_id:
        conditions.append(BookingORM.team_member_id == clinician_id)

    query = (
        select(
            BookingORM.preferred_date,
            BookingORM.confirmation_id,
            BookingORM.status,
            BookingORM.patient_full_name,
            BookingORM.patient_phone,
            BookingORM.cancellation_reason,
            TeamMemberORM.display_name.label("clinician_name"),
        )
        .outerjoin(TeamMemberORM, BookingORM.team_member_id == TeamMemberORM.id)
        .where(*conditions)
        .order_by(desc(BookingORM.preferred_date))
        .limit(5000)
    )
    rows = (await session.execute(query)).all()

    await record_activity(
        activity_repo=activity_repo,
        action="export",
        entity_type="report_cancellations",
        entity_id="cancellations_csv",
        user_id=current_user.id,
        details={"recordCount": len(rows), "startDate": s_date.isoformat(), "endDate": e_date.isoformat()},
        ip_address=request.client.host if request.client else None,
    )

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["Date", "Confirmation ID", "Type", "Patient Name", "Phone", "Clinician", "Reason"])
    for r in rows:
        writer.writerow([
            r.preferred_date.isoformat(),
            r.confirmation_id,
            r.status,
            r.patient_full_name,
            r.patient_phone,
            r.clinician_name or "Unassigned",
            r.cancellation_reason or "N/A",
        ])

    csv_data = output.getvalue()
    filename = f"cancellations_report_{s_date}_{e_date}.csv"
    return Response(content=csv_data, media_type="text/csv", headers={"Content-Disposition": f'attachment; filename="{filename}"'})


# ---------------------------------------------------------------------------
# 3. Recall Compliance Report
# ---------------------------------------------------------------------------

@router.get("/recall-compliance", response_model=RecallComplianceReportResponse)
async def get_recall_compliance_report(
    session: AsyncSession = Depends(get_db_session),
) -> RecallComplianceReportResponse:
    """
    Computes recall compliance rates, overdue buckets, and service breakdowns.
    Recalls are evaluated from each service's configured recall interval.
    """
    # 1. Fetch services with recall intervals
    services_res = await session.execute(
        select(ServiceORM).where(
            ServiceORM.is_active.is_(True),
            ServiceORM.recall_interval_days.isnot(None),
        )
    )
    services_with_recalls = services_res.scalars().all()
    service_map = {str(s.id): s for s in services_with_recalls}
    service_slug_map = {s.slug: s for s in services_with_recalls}

    today = date.today()

    # 2. Query completed bookings
    completed_query = (
        select(
            BookingORM.patient_id,
            BookingORM.service_id,
            func.max(BookingORM.preferred_date).label("last_visit"),
        )
        .where(
            BookingORM.status == "completed",
            BookingORM.patient_id.isnot(None),
        )
        .group_by(BookingORM.patient_id, BookingORM.service_id)
    )
    completed_rows = (await session.execute(completed_query)).all()

    # 3. Query recall tasks already created for patients
    tasks_query = select(TaskORM.patient_id).where(
        TaskORM.patient_id.isnot(None),
        TaskORM.title.ilike("%recall%"),
    )
    task_res = await session.execute(tasks_query)
    patient_ids_contacted = set(t[0] for t in task_res.all())

    total_due = 0
    total_contacted = 0
    total_booked = 0

    by_service_dict: Dict[str, Dict[str, Any]] = {}
    overdue_buckets = {"0_30_days": 0, "31_60_days": 0, "60_plus_days": 0}

    for p_id, s_id, last_visit in completed_rows:
        svc = service_map.get(s_id) or service_slug_map.get(s_id)
        if not svc or not svc.recall_interval_days:
            continue

        due_date = last_visit + timedelta(days=svc.recall_interval_days)
        if due_date <= today:
            total_due += 1
            days_over = (today - due_date).days
            if days_over <= 30:
                overdue_buckets["0_30_days"] += 1
            elif days_over <= 60:
                overdue_buckets["31_60_days"] += 1
            else:
                overdue_buckets["60_plus_days"] += 1

            is_contacted = p_id in patient_ids_contacted
            if is_contacted:
                total_contacted += 1

            s_name = svc.title
            if s_name not in by_service_dict:
                by_service_dict[s_name] = {"serviceName": s_name, "dueCount": 0, "contactedCount": 0}
            by_service_dict[s_name]["dueCount"] += 1
            if is_contacted:
                by_service_dict[s_name]["contactedCount"] += 1

    compliance_rate = round((total_contacted / total_due * 100), 1) if total_due > 0 else 0.0

    by_service = [
        {
            "serviceName": d["serviceName"],
            "dueCount": d["dueCount"],
            "contactedCount": d["contactedCount"],
            "complianceRate": round((d["contactedCount"] / d["dueCount"] * 100), 1) if d["dueCount"] > 0 else 0.0,
        }
        for d in sorted(by_service_dict.values(), key=lambda x: x["dueCount"], reverse=True)
    ]

    return RecallComplianceReportResponse(
        totalPatientsEvaluated=len(completed_rows),
        totalRecallsDue=total_due,
        recallsContacted=total_contacted,
        recallsBooked=total_booked,
        complianceRatePercent=compliance_rate,
        byService=by_service,
        overdueBuckets=overdue_buckets,
    )


@router.get("/export/recall-compliance")
async def export_recall_compliance_report_csv(
    request: Request,
    session: AsyncSession = Depends(get_db_session),
    activity_repo: PostgresActivityLogRepository = Depends(get_activity_log_repository),
    current_user: User = Depends(get_current_user),
) -> Response:
    """Exports recall compliance list as CSV. Audited."""
    services_res = await session.execute(
        select(ServiceORM).where(
            ServiceORM.is_active.is_(True),
            ServiceORM.recall_interval_days.isnot(None),
        )
    )
    services_with_recalls = services_res.scalars().all()
    service_map = {str(s.id): s for s in services_with_recalls}
    service_slug_map = {s.slug: s for s in services_with_recalls}

    today = date.today()

    completed_query = (
        select(
            BookingORM.patient_id,
            BookingORM.patient_full_name,
            BookingORM.patient_phone,
            BookingORM.service_id,
            func.max(BookingORM.preferred_date).label("last_visit"),
        )
        .where(
            BookingORM.status == "completed",
            BookingORM.patient_id.isnot(None),
        )
        .group_by(
            BookingORM.patient_id,
            BookingORM.patient_full_name,
            BookingORM.patient_phone,
            BookingORM.service_id,
        )
    )
    rows = (await session.execute(completed_query)).all()

    tasks_query = select(TaskORM.patient_id).where(
        TaskORM.patient_id.isnot(None),
        TaskORM.title.ilike("%recall%"),
    )
    patient_ids_contacted = set(t[0] for t in (await session.execute(tasks_query)).all())

    await record_activity(
        activity_repo=activity_repo,
        action="export",
        entity_type="report_recalls",
        entity_id="recalls_csv",
        user_id=current_user.id,
        details={"evaluatedRows": len(rows)},
        ip_address=request.client.host if request.client else None,
    )

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["Patient Name", "Phone", "Service", "Last Visit Date", "Due Date", "Days Overdue", "Contact Status"])

    for p_id, p_name, p_phone, s_id, last_visit in rows:
        svc = service_map.get(s_id) or service_slug_map.get(s_id)
        if not svc or not svc.recall_interval_days:
            continue
        due_date = last_visit + timedelta(days=svc.recall_interval_days)
        if due_date <= today:
            days_over = (today - due_date).days
            contact_status = "Contact Task Queued" if p_id in patient_ids_contacted else "Pending Contact"
            writer.writerow([
                p_name,
                p_phone,
                svc.title,
                last_visit.isoformat(),
                due_date.isoformat(),
                days_over,
                contact_status,
            ])

    csv_data = output.getvalue()
    filename = f"recall_compliance_{today.isoformat()}.csv"
    return Response(content=csv_data, media_type="text/csv", headers={"Content-Disposition": f'attachment; filename="{filename}"'})


# ---------------------------------------------------------------------------
# 4. Operational Wait & Chair Times Report
# ---------------------------------------------------------------------------

@router.get("/operational-timing", response_model=OperationalTimingReportResponse)
async def get_operational_timing_report(
    start_date: Optional[date] = Query(None),
    end_date: Optional[date] = Query(None),
    clinician_id: Optional[UUID] = Query(None),
    session: AsyncSession = Depends(get_db_session),
) -> OperationalTimingReportResponse:
    """
    Computes median and average wait time (arrived -> started) and chair time (started -> completed).
    Aggregate workflow metrics only: no per-person scores.
    """
    today = date.today()
    s_date = start_date or (today - timedelta(days=30))
    e_date = end_date or today

    conditions = [
        BookingORM.preferred_date >= s_date,
        BookingORM.preferred_date <= e_date,
        BookingORM.status == "completed",
    ]
    if clinician_id:
        conditions.append(BookingORM.team_member_id == clinician_id)

    query = select(
        BookingORM.arrived_at,
        BookingORM.started_at,
        BookingORM.completed_at,
    ).where(*conditions)

    res = await session.execute(query)
    rows = res.all()

    wait_times: List[float] = []
    chair_times: List[float] = []

    wait_dist = {"under_10m": 0, "10_to_20m": 0, "20_to_30m": 0, "over_30m": 0}
    chair_dist = {"under_15m": 0, "15_to_30m": 0, "30_to_45m": 0, "45_to_60m": 0, "over_60m": 0}

    for arrived_at, started_at, completed_at in rows:
        if arrived_at and started_at and started_at >= arrived_at:
            mins = (started_at - arrived_at).total_seconds() / 60.0
            wait_times.append(mins)
            if mins < 10:
                wait_dist["under_10m"] += 1
            elif mins <= 20:
                wait_dist["10_to_20m"] += 1
            elif mins <= 30:
                wait_dist["20_to_30m"] += 1
            else:
                wait_dist["over_30m"] += 1

        if started_at and completed_at and completed_at >= started_at:
            mins = (completed_at - started_at).total_seconds() / 60.0
            chair_times.append(mins)
            if mins < 15:
                chair_dist["under_15m"] += 1
            elif mins <= 30:
                chair_dist["15_to_30m"] += 1
            elif mins <= 45:
                chair_dist["30_to_45m"] += 1
            elif mins <= 60:
                chair_dist["45_to_60m"] += 1
            else:
                chair_dist["over_60m"] += 1

    median_wait = round(statistics.median(wait_times), 1) if wait_times else None
    avg_wait = round(sum(wait_times) / len(wait_times), 1) if wait_times else None

    median_chair = round(statistics.median(chair_times), 1) if chair_times else None
    avg_chair = round(sum(chair_times) / len(chair_times), 1) if chair_times else None

    return OperationalTimingReportResponse(
        startDate=s_date.isoformat(),
        endDate=e_date.isoformat(),
        totalVisitsRecorded=len(rows),
        medianWaitMinutes=median_wait,
        averageWaitMinutes=avg_wait,
        medianChairMinutes=median_chair,
        averageChairMinutes=avg_chair,
        waitTimeDistribution=wait_dist,
        chairTimeDistribution=chair_dist,
    )


@router.get("/export/operational-timing")
async def export_operational_timing_csv(
    request: Request,
    start_date: Optional[date] = Query(None),
    end_date: Optional[date] = Query(None),
    clinician_id: Optional[UUID] = Query(None),
    session: AsyncSession = Depends(get_db_session),
    activity_repo: PostgresActivityLogRepository = Depends(get_activity_log_repository),
    current_user: User = Depends(get_current_user),
) -> Response:
    """Exports visit wait and chair timing data as CSV. Audited."""
    today = date.today()
    s_date = start_date or (today - timedelta(days=30))
    e_date = end_date or today

    conditions = [
        BookingORM.preferred_date >= s_date,
        BookingORM.preferred_date <= e_date,
        BookingORM.status == "completed",
    ]
    if clinician_id:
        conditions.append(BookingORM.team_member_id == clinician_id)

    query = (
        select(
            BookingORM.preferred_date,
            BookingORM.confirmation_id,
            BookingORM.service_id,
            BookingORM.arrived_at,
            BookingORM.started_at,
            BookingORM.completed_at,
            TeamMemberORM.display_name.label("clinician_name"),
        )
        .outerjoin(TeamMemberORM, BookingORM.team_member_id == TeamMemberORM.id)
        .where(*conditions)
        .order_by(desc(BookingORM.preferred_date))
        .limit(5000)
    )
    rows = (await session.execute(query)).all()

    await record_activity(
        activity_repo=activity_repo,
        action="export",
        entity_type="report_operational_timing",
        entity_id="operational_timing_csv",
        user_id=current_user.id,
        details={"recordCount": len(rows), "startDate": s_date.isoformat(), "endDate": e_date.isoformat()},
        ip_address=request.client.host if request.client else None,
    )

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow([
        "Date",
        "Confirmation ID",
        "Service",
        "Clinician",
        "Arrived At",
        "Started At",
        "Completed At",
        "Wait Time (Minutes)",
        "Chair Time (Minutes)",
    ])

    for r in rows:
        wait_m = round((r.started_at - r.arrived_at).total_seconds() / 60.0, 1) if (r.arrived_at and r.started_at and r.started_at >= r.arrived_at) else "N/A"
        chair_m = round((r.completed_at - r.started_at).total_seconds() / 60.0, 1) if (r.started_at and r.completed_at and r.completed_at >= r.started_at) else "N/A"
        writer.writerow([
            r.preferred_date.isoformat(),
            r.confirmation_id,
            r.service_id or "N/A",
            r.clinician_name or "Unassigned",
            r.arrived_at.strftime("%H:%M:%S") if r.arrived_at else "N/A",
            r.started_at.strftime("%H:%M:%S") if r.started_at else "N/A",
            r.completed_at.strftime("%H:%M:%S") if r.completed_at else "N/A",
            wait_m,
            chair_m,
        ])

    csv_data = output.getvalue()
    filename = f"operational_timing_{s_date}_{e_date}.csv"
    return Response(content=csv_data, media_type="text/csv", headers={"Content-Disposition": f'attachment; filename="{filename}"'})
