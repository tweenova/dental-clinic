from fastapi import APIRouter

from app.api.v1.endpoints import (
    admin_announcements,
    admin_cms,
    admin_media,
    admin_organization,
    admin_permissions,
    admin_services,
    admin_team,
    appointments,
    auth,
    doctor,
    health,
    public_content,
    reception,
)

api_v1_router = APIRouter()

# Public & Core routes
api_v1_router.include_router(health.router, tags=["Health"])
api_v1_router.include_router(appointments.router, tags=["Appointments"])
api_v1_router.include_router(auth.router, tags=["Authentication"])
api_v1_router.include_router(public_content.router, tags=["Public Content"])

# Receptionist Front-Office workspace
api_v1_router.include_router(reception.router, tags=["Receptionist Front-Office"])

# Doctor workspace foundation
api_v1_router.include_router(doctor.router, tags=["Doctor Clinical Foundation"])

# Admin CMS & Clinic Management routes
api_v1_router.include_router(admin_cms.router, tags=["Admin CMS"])
api_v1_router.include_router(admin_announcements.router, tags=["Admin Announcements"])
api_v1_router.include_router(admin_permissions.router, tags=["Admin Permissions"])
api_v1_router.include_router(admin_team.router, tags=["Admin Team"])
api_v1_router.include_router(admin_services.router, tags=["Admin Services"])
api_v1_router.include_router(admin_organization.router, tags=["Admin Organization"])
api_v1_router.include_router(admin_media.router, tags=["Admin Media"])
