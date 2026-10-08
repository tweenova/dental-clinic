from typing import Callable, Optional
from uuid import UUID

from fastapi import Depends, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.ext.asyncio import AsyncSession

from app.application.services.announcement_service import AnnouncementService
from app.application.services.appointment_service import AppointmentService
from app.application.services.auth_service import AuthService
from app.application.services.cms_service import CmsService
from app.application.services.doctor_service import DoctorService
from app.application.services.organization_service import OrganizationService
from app.application.services.reception_service import ReceptionService
from app.application.services.service_service import ServiceService
from app.application.services.team_service import TeamService
from app.core.database import get_db_session
from app.core.security import decode_access_token
from app.domain.models.user import User, UserRole
from app.domain.repositories.announcement_repo import AnnouncementRepository
from app.domain.repositories.appointment_repo import AppointmentRepository
from app.domain.repositories.booking_repo import BookingRepository
from app.domain.repositories.cms_repo import CmsRepository
from app.domain.repositories.lead_repo import LeadRepository
from app.domain.repositories.message_repo import MessageRepository
from app.domain.repositories.organization_repo import LocationRepository, OrganizationRepository
from app.domain.repositories.patient_repo import PatientRepository
from app.domain.repositories.service_repo import ServiceRepository
from app.domain.repositories.task_repo import TaskRepository
from app.domain.repositories.team_repo import TeamMemberRepository
from app.domain.repositories.user_repo import (
    RefreshTokenRepository,
    UserRepository,
    UserSessionRepository,
)
from app.domain.services.storage_service import StorageService
from app.infrastructure.repositories.postgres_announcement_repo import PostgresAnnouncementRepository
from app.infrastructure.repositories.postgres_appointment_repo import PostgresAppointmentRepository
from app.infrastructure.repositories.postgres_booking_repo import PostgresBookingRepository
from app.infrastructure.repositories.postgres_cms_repo import PostgresCmsRepository
from app.infrastructure.repositories.postgres_lead_repo import PostgresLeadRepository
from app.infrastructure.repositories.postgres_message_repo import PostgresMessageRepository
from app.infrastructure.repositories.postgres_organization_repo import (
    PostgresLocationRepository,
    PostgresOrganizationRepository,
)
from app.infrastructure.repositories.postgres_patient_repo import PostgresPatientRepository
from app.infrastructure.repositories.postgres_service_repo import PostgresServiceRepository
from app.infrastructure.repositories.postgres_task_repo import PostgresTaskRepository
from app.infrastructure.repositories.postgres_team_repo import PostgresTeamMemberRepository
from app.infrastructure.repositories.postgres_user_repo import (
    PostgresRefreshTokenRepository,
    PostgresUserRepository,
    PostgresUserSessionRepository,
)
from app.infrastructure.storage.local_storage import LocalStorageService

bearer_scheme = HTTPBearer(auto_error=False)


# --- Repositories ---

def get_appointment_repository(
    session: AsyncSession = Depends(get_db_session),
) -> AppointmentRepository:
    return PostgresAppointmentRepository(session)


def get_user_repository(
    session: AsyncSession = Depends(get_db_session),
) -> UserRepository:
    return PostgresUserRepository(session)


def get_refresh_token_repository(
    session: AsyncSession = Depends(get_db_session),
) -> RefreshTokenRepository:
    return PostgresRefreshTokenRepository(session)


def get_session_repository(
    session: AsyncSession = Depends(get_db_session),
) -> UserSessionRepository:
    return PostgresUserSessionRepository(session)


def get_organization_repository(
    session: AsyncSession = Depends(get_db_session),
) -> OrganizationRepository:
    return PostgresOrganizationRepository(session)


def get_location_repository(
    session: AsyncSession = Depends(get_db_session),
) -> LocationRepository:
    return PostgresLocationRepository(session)


def get_team_repository(
    session: AsyncSession = Depends(get_db_session),
) -> TeamMemberRepository:
    return PostgresTeamMemberRepository(session)


def get_service_repository(
    session: AsyncSession = Depends(get_db_session),
) -> ServiceRepository:
    return PostgresServiceRepository(session)


def get_cms_repository(
    session: AsyncSession = Depends(get_db_session),
) -> CmsRepository:
    return PostgresCmsRepository(session)


def get_announcement_repository(
    session: AsyncSession = Depends(get_db_session),
) -> AnnouncementRepository:
    return PostgresAnnouncementRepository(session)


def get_booking_repository(
    session: AsyncSession = Depends(get_db_session),
) -> BookingRepository:
    return PostgresBookingRepository(session)


def get_patient_repository(
    session: AsyncSession = Depends(get_db_session),
) -> PatientRepository:
    return PostgresPatientRepository(session)


def get_task_repository(
    session: AsyncSession = Depends(get_db_session),
) -> TaskRepository:
    return PostgresTaskRepository(session)


def get_lead_repository(
    session: AsyncSession = Depends(get_db_session),
) -> LeadRepository:
    return PostgresLeadRepository(session)


def get_message_repository(
    session: AsyncSession = Depends(get_db_session),
) -> MessageRepository:
    return PostgresMessageRepository(session)


def get_storage_service() -> StorageService:
    return LocalStorageService()


# --- Application Services ---

def get_appointment_service(
    repository: AppointmentRepository = Depends(get_appointment_repository),
) -> AppointmentService:
    return AppointmentService(repository)


def get_auth_service(
    user_repo: UserRepository = Depends(get_user_repository),
    refresh_token_repo: RefreshTokenRepository = Depends(get_refresh_token_repository),
    session_repo: UserSessionRepository = Depends(get_session_repository),
) -> AuthService:
    return AuthService(user_repo, refresh_token_repo, session_repo)


def get_team_service(
    team_repo: TeamMemberRepository = Depends(get_team_repository),
    org_repo: OrganizationRepository = Depends(get_organization_repository),
) -> TeamService:
    return TeamService(team_repo, org_repo)


def get_service_service(
    service_repo: ServiceRepository = Depends(get_service_repository),
) -> ServiceService:
    return ServiceService(service_repo)


def get_cms_service(
    cms_repo: CmsRepository = Depends(get_cms_repository),
) -> CmsService:
    return CmsService(cms_repo)


def get_organization_service(
    org_repo: OrganizationRepository = Depends(get_organization_repository),
    location_repo: LocationRepository = Depends(get_location_repository),
) -> OrganizationService:
    return OrganizationService(org_repo, location_repo)


def get_announcement_service(
    repo: AnnouncementRepository = Depends(get_announcement_repository),
) -> AnnouncementService:
    return AnnouncementService(repo)


def get_reception_service(
    booking_repo: BookingRepository = Depends(get_booking_repository),
    patient_repo: PatientRepository = Depends(get_patient_repository),
    task_repo: TaskRepository = Depends(get_task_repository),
    lead_repo: LeadRepository = Depends(get_lead_repository),
    message_repo: MessageRepository = Depends(get_message_repository),
    appointment_repo: AppointmentRepository = Depends(get_appointment_repository),
) -> ReceptionService:
    return ReceptionService(
        booking_repo,
        patient_repo,
        task_repo,
        lead_repo,
        message_repo,
        appointment_repo,
    )


def get_doctor_service(
    booking_repo: BookingRepository = Depends(get_booking_repository),
) -> DoctorService:
    return DoctorService(booking_repo)


# --- Authentication & Authorization Dependencies ---

async def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(bearer_scheme),
    user_repo: UserRepository = Depends(get_user_repository),
    session_repo: UserSessionRepository = Depends(get_session_repository),
) -> User:
    """
    Validates Bearer JWT access token, enforces active server-side session,
    and resolves the active user entity.
    """
    if not credentials or not credentials.credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication credentials required.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    token = credentials.credentials
    payload = decode_access_token(token)
    if not payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired access token.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # Server-side session verification for 7-day token security & instant revocation
    sid_str = payload.get("sid")
    if sid_str:
        try:
            sid = UUID(sid_str)
            active_session = await session_repo.get_by_id(sid)
            if not active_session or not active_session.is_active:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Session has been revoked or expired.",
                    headers={"WWW-Authenticate": "Bearer"},
                )
        except (ValueError, TypeError):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Malformed session ID in token.",
                headers={"WWW-Authenticate": "Bearer"},
            )

    user_id_str = payload.get("sub")
    if not user_id_str:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Malformed access token payload.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    try:
        user_id = UUID(user_id_str)
    except (ValueError, TypeError):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Malformed user ID in token.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    user = await user_repo.get_by_id(user_id)
    if not user or not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User account is inactive or not found.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    return user


def require_role(*allowed_roles: str) -> Callable:
    """
    Factory dependency enforcing role-based authorization for one or more permitted roles.
    Matches case-insensitively to support both "admin" / "Admin", "receptionist" / "Receptionist", etc.
    """
    normalized_allowed = {r.strip().lower() for r in allowed_roles}

    async def role_checker(current_user: User = Depends(get_current_user)) -> User:
        user_role_str = str(current_user.role.value).strip().lower()
        if user_role_str not in normalized_allowed:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Access forbidden: user role '{current_user.role.value}' does not have required permissions.",
            )
        return current_user

    return role_checker


# Pre-configured role dependencies
require_admin = require_role("admin", "Platform Owner", "Super Admin")
require_receptionist = require_role("receptionist", "Receptionist", "admin", "Admin", "Super Admin", "Clinic Branch Manager")
require_doctor = require_role("doctor", "Doctor", "admin", "Admin", "Super Admin")
