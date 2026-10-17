from fastapi import APIRouter

from app.api.v1.endpoints import (
    admin_announcements,
    admin_audit,
    admin_booking,
    admin_cms,
    admin_media,
    admin_messaging,
    admin_organization,
    admin_reports,
    admin_services,
    admin_team,
    admin_users,
    appointments,
    auth,
    clinical_alerts,
    clinical_documents,
    clinical_note_templates,
    doctor,
    doctor_tasks,
    health,
    patient_attachments,
    public_content,
    reception,
    treatment_plans,
)

api_v1_router = APIRouter()

# Public & Core routes
api_v1_router.include_router(health.router, tags=["Health"])
api_v1_router.include_router(appointments.router, tags=["Appointments"])
api_v1_router.include_router(auth.router, tags=["Authentication"])
api_v1_router.include_router(public_content.router, tags=["Public Content"])

# Receptionist Front-Office workspace
api_v1_router.include_router(reception.router, tags=["Receptionist Front-Office"])

# Clinical & Practitioner routes
api_v1_router.include_router(clinical_alerts.router, tags=["Clinical Medical Alerts"])
api_v1_router.include_router(doctor.router, tags=["Doctor Clinical Foundation"])
api_v1_router.include_router(doctor_tasks.router, tags=["Doctor Tasks"])
api_v1_router.include_router(treatment_plans.router, tags=["Treatment Plans"])
api_v1_router.include_router(clinical_note_templates.router, tags=["Clinical Note Templates"])
api_v1_router.include_router(patient_attachments.router, tags=["Patient Attachments & Consents"])
api_v1_router.include_router(clinical_documents.router, tags=["Clinical Documents"])

# Admin CMS & Clinic Management routes
api_v1_router.include_router(admin_cms.router, tags=["Admin CMS"])
api_v1_router.include_router(admin_announcements.router, tags=["Admin Announcements"])
api_v1_router.include_router(admin_team.router, tags=["Admin Team"])
api_v1_router.include_router(admin_services.router, tags=["Admin Services"])
api_v1_router.include_router(admin_organization.router, tags=["Admin Organization"])
api_v1_router.include_router(admin_media.router, tags=["Admin Media"])
api_v1_router.include_router(admin_users.router, tags=["Admin Staff Accounts"])
api_v1_router.include_router(admin_booking.router, tags=["Admin Booking Settings"])
api_v1_router.include_router(admin_messaging.router, tags=["Admin Messaging & Reminders"])
api_v1_router.include_router(admin_audit.router, tags=["Admin Audit Viewer"])
api_v1_router.include_router(admin_reports.router, tags=["Admin Reports"])
