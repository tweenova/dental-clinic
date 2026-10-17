from datetime import date, datetime
from typing import Optional
from uuid import UUID, uuid4

from sqlalchemy import Boolean, CheckConstraint, Date, DateTime, ForeignKey, Index, Integer, String, Text, Uuid, false, func, true
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship


class Base(DeclarativeBase):
    """Base class for all SQLAlchemy database table definitions in the application."""
    pass


class RoleORM(Base):
    """Stores platform and clinic roles."""
    __tablename__ = "roles"

    id: Mapped[UUID] = mapped_column(
        Uuid(as_uuid=True),
        primary_key=True,
        default=uuid4,
    )
    name: Mapped[str] = mapped_column(
        String(100),
        unique=True,
        nullable=False,
        index=True,
    )
    description: Mapped[Optional[str]] = mapped_column(
        Text,
        nullable=True,
    )
    is_system: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=False,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
    )


class PermissionORM(Base):
    """Stores system capabilities and permissions."""
    __tablename__ = "permissions"

    id: Mapped[UUID] = mapped_column(
        Uuid(as_uuid=True),
        primary_key=True,
        default=uuid4,
    )
    code: Mapped[str] = mapped_column(
        String(100),
        unique=True,
        nullable=False,
        index=True,
    )
    module: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
    )
    description: Mapped[Optional[str]] = mapped_column(
        Text,
        nullable=True,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )


class RolePermissionORM(Base):
    """Join table associating roles with permissions.

    RETAINED FOR SCHEMA COMPATIBILITY ONLY: the /admin/permissions GET and PUT
    endpoints (the only readers/writers of this table) were removed because
    authorization is enforced exclusively through require_role() closures in
    app/api/deps.py, and no code reads role_permissions anymore.
    """
    __tablename__ = "role_permissions"

    id: Mapped[UUID] = mapped_column(
        Uuid(as_uuid=True),
        primary_key=True,
        default=uuid4,
    )
    role_id: Mapped[UUID] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("roles.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    permission_id: Mapped[UUID] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("permissions.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )


class OrganizationORM(Base):
    """
    Stores top-level practice/organization details including dynamic theming.
    """
    __tablename__ = "organizations"

    id: Mapped[UUID] = mapped_column(
        Uuid(as_uuid=True),
        primary_key=True,
        default=uuid4,
    )
    name: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
    )
    display_name: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
    )
    tagline: Mapped[Optional[str]] = mapped_column(
        Text,
        nullable=True,
    )
    description: Mapped[Optional[str]] = mapped_column(
        Text,
        nullable=True,
    )
    logo_url: Mapped[Optional[str]] = mapped_column(
        Text,
        nullable=True,
    )
    contact_email: Mapped[Optional[str]] = mapped_column(
        String(255),
        nullable=True,
    )
    contact_phone: Mapped[Optional[str]] = mapped_column(
        String(50),
        nullable=True,
    )
    website_url: Mapped[Optional[str]] = mapped_column(
        Text,
        nullable=True,
    )
    # Theming & Branding Columns
    primary_color: Mapped[Optional[str]] = mapped_column(
        String(50),
        nullable=True,
    )
    secondary_color: Mapped[Optional[str]] = mapped_column(
        String(50),
        nullable=True,
    )
    background_color: Mapped[Optional[str]] = mapped_column(
        String(50),
        nullable=True,
    )
    primary_font: Mapped[Optional[str]] = mapped_column(
        String(100),
        nullable=True,
    )
    secondary_font: Mapped[Optional[str]] = mapped_column(
        String(100),
        nullable=True,
    )
    is_active: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=True,
    )
    currency_code: Mapped[str] = mapped_column(
        String(10),
        nullable=False,
        default="PKR",
        server_default="PKR",
    )
    currency_symbol: Mapped[str] = mapped_column(
        String(10),
        nullable=False,
        default="Rs",
        server_default="Rs",
    )
    timezone: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
        default="Asia/Karachi",
        server_default="Asia/Karachi",
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
    )


class ClinicORM(Base):
    """
    Stores nationwide practice clinics / branches per ERD.
    """
    __tablename__ = "clinics"

    id: Mapped[UUID] = mapped_column(
        Uuid(as_uuid=True),
        primary_key=True,
        default=uuid4,
    )
    organization_id: Mapped[UUID] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("organizations.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    name: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
    )
    address_line1: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
    )
    address_line2: Mapped[Optional[str]] = mapped_column(
        String(255),
        nullable=True,
    )
    city: Mapped[str] = mapped_column(
        String(100),
        nullable=False,
        index=True,
    )
    state: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
    )
    postal_code: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
    )
    country: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
        default="US",
    )
    phone: Mapped[Optional[str]] = mapped_column(
        String(50),
        nullable=True,
    )
    email: Mapped[Optional[str]] = mapped_column(
        String(255),
        nullable=True,
    )
    hours_info: Mapped[Optional[str]] = mapped_column(
        Text,
        nullable=True,
    )
    is_primary: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=True,
    )
    is_active: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=True,
    )
    display_order: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        default=0,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
    )


class LocationORM(Base):
    """
    Stores practice locations/offices (retained for backward compatibility).
    """
    __tablename__ = "locations"

    id: Mapped[UUID] = mapped_column(
        Uuid(as_uuid=True),
        primary_key=True,
        default=uuid4,
    )
    organization_id: Mapped[UUID] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("organizations.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    name: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
    )
    address_line1: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
    )
    address_line2: Mapped[Optional[str]] = mapped_column(
        String(255),
        nullable=True,
    )
    city: Mapped[str] = mapped_column(
        String(100),
        nullable=False,
    )
    state: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
    )
    postal_code: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
    )
    country: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
        default="US",
    )
    phone: Mapped[Optional[str]] = mapped_column(
        String(50),
        nullable=True,
    )
    email: Mapped[Optional[str]] = mapped_column(
        String(255),
        nullable=True,
    )
    hours_info: Mapped[Optional[str]] = mapped_column(
        Text,
        nullable=True,
    )
    is_primary: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=True,
    )
    is_active: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=True,
    )
    display_order: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        default=0,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
    )


class UserORM(Base):
    """
    Stores authenticated staff and administrative accounts.
    """
    __tablename__ = "users"

    id: Mapped[UUID] = mapped_column(
        Uuid(as_uuid=True),
        primary_key=True,
        default=uuid4,
    )
    email: Mapped[str] = mapped_column(
        String(255),
        unique=True,
        nullable=False,
        index=True,
    )
    hashed_password: Mapped[str] = mapped_column(
        Text,
        nullable=False,
    )
    full_name: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
    )
    role: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
        default="admin",
    )
    clinic_id: Mapped[Optional[UUID]] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("clinics.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    team_member_id: Mapped[Optional[UUID]] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("team_members.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    is_active: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=True,
    )
    requires_password_change: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=False,
    )
    inactivity_enabled: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=True,
    )
    inactivity_timeout_minutes: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        default=15,
    )
    inactivity_warning_seconds: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        default=60,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
    )


class UserSessionORM(Base):
    """
    Tracks active authenticated user sessions for server-side revocation of 7-day access tokens.
    """
    __tablename__ = "user_sessions"

    id: Mapped[UUID] = mapped_column(
        Uuid(as_uuid=True),
        primary_key=True,
        default=uuid4,
    )
    user_id: Mapped[UUID] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    is_active: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=True,
    )
    expires_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
    )
    ip_address: Mapped[Optional[str]] = mapped_column(
        String(50),
        nullable=True,
    )
    user_agent: Mapped[Optional[str]] = mapped_column(
        Text,
        nullable=True,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )
    revoked_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )


class RefreshTokenORM(Base):
    """
    Stores issued refresh tokens for rotation, expiration, and server-side revocation.
    """
    __tablename__ = "refresh_tokens"

    id: Mapped[UUID] = mapped_column(
        Uuid(as_uuid=True),
        primary_key=True,
        default=uuid4,
    )
    user_id: Mapped[UUID] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    session_id: Mapped[Optional[UUID]] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("user_sessions.id", ondelete="CASCADE"),
        nullable=True,
        index=True,
    )
    token_hash: Mapped[str] = mapped_column(
        String(128),
        unique=True,
        nullable=False,
        index=True,
    )
    expires_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
    )
    is_revoked: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=False,
    )
    replaced_by: Mapped[Optional[UUID]] = mapped_column(
        Uuid(as_uuid=True),
        nullable=True,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )
    revoked_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )


class PatientORM(Base):
    """
    Stores patient records. Zero insurance fields.
    """
    __tablename__ = "patients"

    id: Mapped[UUID] = mapped_column(
        Uuid(as_uuid=True),
        primary_key=True,
        default=uuid4,
    )
    organization_id: Mapped[Optional[UUID]] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("organizations.id", ondelete="SET NULL"),
        nullable=True,
    )
    clinic_id: Mapped[Optional[UUID]] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("clinics.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    first_name: Mapped[str] = mapped_column(
        String(100),
        nullable=False,
    )
    last_name: Mapped[str] = mapped_column(
        String(100),
        nullable=False,
    )
    phone: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
        index=True,
    )
    email: Mapped[Optional[str]] = mapped_column(
        String(255),
        nullable=True,
        index=True,
    )
    date_of_birth: Mapped[Optional[date]] = mapped_column(
        Date,
        nullable=True,
    )
    notes: Mapped[Optional[str]] = mapped_column(
        Text,
        nullable=True,
    )
    medical_history_status: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
        server_default="not_asked",
        default="not_asked",
    )
    file_number: Mapped[Optional[str]] = mapped_column(
        String(50),
        nullable=True,
        unique=True,
        index=True,
    )
    guardian_name: Mapped[Optional[str]] = mapped_column(
        String(150),
        nullable=True,
    )
    guardian_phone: Mapped[Optional[str]] = mapped_column(
        String(50),
        nullable=True,
    )
    guardian_relationship: Mapped[Optional[str]] = mapped_column(
        String(50),
        nullable=True,
    )
    emergency_contact_name: Mapped[Optional[str]] = mapped_column(
        String(150),
        nullable=True,
    )
    emergency_contact_phone: Mapped[Optional[str]] = mapped_column(
        String(50),
        nullable=True,
    )
    emergency_contact_relationship: Mapped[Optional[str]] = mapped_column(
        String(50),
        nullable=True,
    )
    messaging_opt_out: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=False,
        server_default=false(),
    )
    preferred_channel: Mapped[str] = mapped_column(
        String(16),
        nullable=False,
        default="sms",
        server_default="sms",
    )
    is_active: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=True,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
    )


class PatientMedicalAlertORM(Base):
    """
    Stores clinical and pending patient medical alerts (allergies, conditions, medications).
    """
    __tablename__ = "patient_medical_alerts"

    id: Mapped[UUID] = mapped_column(
        Uuid(as_uuid=True),
        primary_key=True,
        default=uuid4,
    )
    patient_id: Mapped[UUID] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("patients.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    type: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
    )
    description: Mapped[str] = mapped_column(
        Text,
        nullable=False,
    )
    severity: Mapped[Optional[str]] = mapped_column(
        String(50),
        nullable=True,
    )
    recorded_by_user_id: Mapped[Optional[UUID]] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )
    recorded_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )
    last_reviewed_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )
    is_active: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=True,
    )
    is_confirmed: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=True,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
    )



class TeamMemberORM(Base):
    """
    Stores clinical and administrative team members.
    """
    __tablename__ = "team_members"

    id: Mapped[UUID] = mapped_column(
        Uuid(as_uuid=True),
        primary_key=True,
        default=uuid4,
    )
    organization_id: Mapped[UUID] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("organizations.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    location_id: Mapped[Optional[UUID]] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("locations.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    clinic_id: Mapped[Optional[UUID]] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("clinics.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    first_name: Mapped[str] = mapped_column(
        String(100),
        nullable=False,
    )
    last_name: Mapped[str] = mapped_column(
        String(100),
        nullable=False,
    )
    display_name: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
    )
    professional_title: Mapped[str] = mapped_column(
        String(150),
        nullable=False,
    )
    role: Mapped[str] = mapped_column(
        String(100),
        nullable=False,
    )
    specialties_json: Mapped[Optional[str]] = mapped_column(
        Text,
        nullable=True,
    )
    biography: Mapped[Optional[str]] = mapped_column(
        Text,
        nullable=True,
    )
    photo_url: Mapped[Optional[str]] = mapped_column(
        Text,
        nullable=True,
    )
    education: Mapped[Optional[str]] = mapped_column(
        Text,
        nullable=True,
    )
    credentials: Mapped[Optional[str]] = mapped_column(
        String(100),
        nullable=True,
    )
    license_number: Mapped[Optional[str]] = mapped_column(
        String(100),
        nullable=True,
    )
    license_state: Mapped[Optional[str]] = mapped_column(
        String(100),
        nullable=True,
    )
    services_offered: Mapped[Optional[str]] = mapped_column(
        Text,
        nullable=True,
    )
    display_order: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        default=0,
    )
    is_active: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=True,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
    )


class ServiceORM(Base):
    """
    Stores manageable procedures, treatments, pricing, and descriptions.
    """
    __tablename__ = "services"

    id: Mapped[UUID] = mapped_column(
        Uuid(as_uuid=True),
        primary_key=True,
        default=uuid4,
    )
    slug: Mapped[str] = mapped_column(
        String(100),
        unique=True,
        nullable=False,
        index=True,
    )
    category: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
    )
    title: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
    )
    short_desc: Mapped[str] = mapped_column(
        Text,
        nullable=False,
    )
    full_desc: Mapped[Optional[str]] = mapped_column(
        Text,
        nullable=True,
    )
    cash_price: Mapped[str] = mapped_column(
        String(100),
        nullable=False,
    )
    duration: Mapped[str] = mapped_column(
        String(100),
        nullable=False,
    )
    code: Mapped[Optional[str]] = mapped_column(
        String(100),
        nullable=True,
    )
    insurance_note: Mapped[Optional[str]] = mapped_column(
        Text,
        nullable=True,
    )
    recommended_interval: Mapped[Optional[str]] = mapped_column(
        String(150),
        nullable=True,
    )
    recall_interval_days: Mapped[Optional[int]] = mapped_column(
        Integer,
        nullable=True,
    )
    display_order: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        default=0,
    )
    is_highlighted: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=False,
    )
    is_active: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=True,
    )
    is_public: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=True,
    )
    bookable_online: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=True,
    )
    buffer_minutes: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        default=0,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
    )



class LeadSourceORM(Base):
    """
    Stores acquisition channels.
    """
    __tablename__ = "lead_sources"

    id: Mapped[UUID] = mapped_column(
        Uuid(as_uuid=True),
        primary_key=True,
        default=uuid4,
    )
    name: Mapped[str] = mapped_column(
        String(100),
        nullable=False,
    )
    utm_source: Mapped[Optional[str]] = mapped_column(
        String(100),
        nullable=True,
    )
    is_active: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=True,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )


class LeadORM(Base):
    """
    Stores leads and inquiries. Zero insurance fields.
    """
    __tablename__ = "leads"

    id: Mapped[UUID] = mapped_column(
        Uuid(as_uuid=True),
        primary_key=True,
        default=uuid4,
    )
    organization_id: Mapped[Optional[UUID]] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("organizations.id", ondelete="SET NULL"),
        nullable=True,
    )
    clinic_id: Mapped[Optional[UUID]] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("clinics.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    patient_id: Mapped[Optional[UUID]] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("patients.id", ondelete="SET NULL"),
        nullable=True,
    )
    lead_source_id: Mapped[Optional[UUID]] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("lead_sources.id", ondelete="SET NULL"),
        nullable=True,
    )
    full_name: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
    )
    phone: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
    )
    email: Mapped[Optional[str]] = mapped_column(
        String(255),
        nullable=True,
    )
    status: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
        default="new",
    )
    notes: Mapped[Optional[str]] = mapped_column(
        Text,
        nullable=True,
    )
    utm_source: Mapped[Optional[str]] = mapped_column(
        String(100),
        nullable=True,
    )
    utm_campaign: Mapped[Optional[str]] = mapped_column(
        String(100),
        nullable=True,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
    )


class BookingORM(Base):
    """
    Stores appointment bookings. Zero insurance fields.
    """
    __tablename__ = "bookings"

    id: Mapped[UUID] = mapped_column(
        Uuid(as_uuid=True),
        primary_key=True,
        default=uuid4,
    )
    confirmation_id: Mapped[str] = mapped_column(
        String(50),
        unique=True,
        nullable=False,
        index=True,
    )
    clinic_id: Mapped[Optional[UUID]] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("clinics.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    patient_id: Mapped[Optional[UUID]] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("patients.id", ondelete="SET NULL"),
        nullable=True,
    )
    service_id: Mapped[Optional[str]] = mapped_column(
        String(100),
        nullable=True,
    )
    team_member_id: Mapped[Optional[UUID]] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("team_members.id", ondelete="SET NULL"),
        nullable=True,
    )
    slot_id: Mapped[Optional[UUID]] = mapped_column(
        Uuid(as_uuid=True),
        nullable=True,
    )
    preferred_date: Mapped[date] = mapped_column(
        Date,
        nullable=False,
        index=True,
    )
    preferred_time: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
    )
    status: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
        default="requested",
    )
    patient_full_name: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
    )
    patient_phone: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
    )
    patient_email: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
    )
    notes: Mapped[Optional[str]] = mapped_column(
        Text,
        nullable=True,
    )
    utm_source: Mapped[Optional[str]] = mapped_column(
        String(100),
        nullable=True,
    )
    utm_campaign: Mapped[Optional[str]] = mapped_column(
        String(100),
        nullable=True,
    )
    staff_notes: Mapped[Optional[str]] = mapped_column(
        Text,
        nullable=True,
    )
    arrived_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )
    started_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )
    completed_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )
    cancellation_reason: Mapped[Optional[str]] = mapped_column(
        Text,
        nullable=True,
    )
    cancelled_by_user_id: Mapped[Optional[UUID]] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )
    reminded_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )
    reminded_by_user_id: Mapped[Optional[UUID]] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
    )


class TaskORM(Base):
    """
    Stores administrative and clinical tasks.
    """
    __tablename__ = "tasks"

    id: Mapped[UUID] = mapped_column(
        Uuid(as_uuid=True),
        primary_key=True,
        default=uuid4,
    )
    clinic_id: Mapped[Optional[UUID]] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("clinics.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    assigned_to_user_id: Mapped[Optional[UUID]] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    created_by_user_id: Mapped[Optional[UUID]] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    patient_id: Mapped[Optional[UUID]] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("patients.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    booking_id: Mapped[Optional[UUID]] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("bookings.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    title: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
    )
    description: Mapped[Optional[str]] = mapped_column(
        Text,
        nullable=True,
    )
    due_date: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )
    status: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
        default="pending",
    )
    priority: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
        default="medium",
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
    )


class MessageORM(Base):
    """
    Stores patient communications and reminders.
    """
    __tablename__ = "messages"

    id: Mapped[UUID] = mapped_column(
        Uuid(as_uuid=True),
        primary_key=True,
        default=uuid4,
    )
    patient_id: Mapped[Optional[UUID]] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("patients.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    sender_id: Mapped[Optional[UUID]] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )
    recipient_id: Mapped[Optional[UUID]] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )
    phone: Mapped[Optional[str]] = mapped_column(
        String(50),
        nullable=True,
    )
    email: Mapped[Optional[str]] = mapped_column(
        String(255),
        nullable=True,
    )
    content: Mapped[str] = mapped_column(
        Text,
        nullable=False,
    )
    channel: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
        default="sms",
    )
    status: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
        default="logged",
    )
    booking_id: Mapped[Optional[UUID]] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("bookings.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    delivery_status: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
        default="simulated",
        server_default="simulated",
    )
    error_detail: Mapped[Optional[str]] = mapped_column(
        Text,
        nullable=True,
    )
    provider: Mapped[str] = mapped_column(
        String(32),
        nullable=False,
        default="simulated",
        server_default="simulated",
    )
    provider_message_id: Mapped[Optional[str]] = mapped_column(
        String(128),
        nullable=True,
    )
    attempts: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        default=0,
        server_default="0",
    )
    scheduled_for: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
        index=True,
    )
    sent_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )
    reminder_type: Mapped[Optional[str]] = mapped_column(
        String(32),
        nullable=True,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )


class ActivityLogORM(Base):
    """
    Audit log of actions across the platform.
    """
    __tablename__ = "activity_logs"

    id: Mapped[UUID] = mapped_column(
        Uuid(as_uuid=True),
        primary_key=True,
        default=uuid4,
    )
    user_id: Mapped[Optional[UUID]] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    action: Mapped[str] = mapped_column(
        String(100),
        nullable=False,
    )
    entity_type: Mapped[str] = mapped_column(
        String(100),
        nullable=False,
    )
    entity_id: Mapped[Optional[str]] = mapped_column(
        String(100),
        nullable=True,
    )
    details_json: Mapped[Optional[str]] = mapped_column(
        Text,
        nullable=True,
    )
    ip_address: Mapped[Optional[str]] = mapped_column(
        String(50),
        nullable=True,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )


class WorkflowRunORM(Base):
    """
    Records automated workflows and background triggers.
    """
    __tablename__ = "workflow_runs"

    id: Mapped[UUID] = mapped_column(
        Uuid(as_uuid=True),
        primary_key=True,
        default=uuid4,
    )
    workflow_name: Mapped[str] = mapped_column(
        String(100),
        nullable=False,
        index=True,
    )
    status: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
        default="completed",
    )
    trigger_event: Mapped[str] = mapped_column(
        String(100),
        nullable=False,
    )
    payload_json: Mapped[Optional[str]] = mapped_column(
        Text,
        nullable=True,
    )
    error_message: Mapped[Optional[str]] = mapped_column(
        Text,
        nullable=True,
    )
    started_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )
    completed_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )


class FaqItemORM(Base):
    """
    Stores FAQ items for public display and admin management.
    """
    __tablename__ = "faq_items"

    id: Mapped[UUID] = mapped_column(
        Uuid(as_uuid=True),
        primary_key=True,
        default=uuid4,
    )
    category: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
    )
    question: Mapped[str] = mapped_column(
        Text,
        nullable=False,
    )
    answer: Mapped[str] = mapped_column(
        Text,
        nullable=False,
    )
    display_order: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        default=0,
    )
    is_active: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=True,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
    )


class SiteSectionORM(Base):
    """
    Stores structured CMS sections (e.g. 'general', 'homepage', 'about', 'contact', 'footer', 'seo').
    """
    __tablename__ = "site_sections"

    section_key: Mapped[str] = mapped_column(
        String(100),
        primary_key=True,
    )
    content_json: Mapped[str] = mapped_column(
        Text,
        nullable=False,
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
    )


class AnnouncementORM(Base):
    """
    Stores website marquee announcement messages per ERD.
    """
    __tablename__ = "announcements"

    id: Mapped[UUID] = mapped_column(
        Uuid(as_uuid=True),
        primary_key=True,
        default=uuid4,
    )
    content: Mapped[str] = mapped_column(
        Text,
        nullable=False,
    )
    is_active: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=True,
    )
    display_order: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        default=0,
    )
    is_auto_booking_banner: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=False,
        server_default=func.false(),
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
    )


class AppointmentORM(Base):
    """
    Defines the structure of the 'appointments' table in the PostgreSQL database.
    """
    __tablename__ = "appointments_legacy"

    id: Mapped[UUID] = mapped_column(
        Uuid(as_uuid=True),
        primary_key=True,
        default=uuid4,
    )
    confirmation_id: Mapped[str] = mapped_column(
        Text,
        unique=True,
        nullable=False,
        index=True,
    )
    status: Mapped[str] = mapped_column(
        Text,
        nullable=False,
        default="requested",
    )
    service_id: Mapped[str] = mapped_column(
        Text,
        nullable=False,
    )
    preferred_date: Mapped[date] = mapped_column(
        Date,
        nullable=False,
        index=True,
    )
    preferred_time: Mapped[str] = mapped_column(
        Text,
        nullable=False,
    )
    patient_full_name: Mapped[str] = mapped_column(
        Text,
        nullable=False,
    )
    patient_phone: Mapped[str] = mapped_column(
        Text,
        nullable=False,
    )
    patient_email: Mapped[str] = mapped_column(
        Text,
        nullable=False,
    )
    notes: Mapped[Optional[str]] = mapped_column(
        Text,
        nullable=True,
    )
    utm_source: Mapped[Optional[str]] = mapped_column(
        Text,
        nullable=True,
    )
    utm_campaign: Mapped[Optional[str]] = mapped_column(
        Text,
        nullable=True,
    )
    staff_notes: Mapped[Optional[str]] = mapped_column(
        Text,
        nullable=True,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
    )

    __table_args__ = (
        Index(
            "ix_appointments_status_created_at",
            "status",
            created_at.desc(),
        ),
    )


class ClinicalEncounterORM(Base):
    """
    Stores clinical encounters/visits with patient, clinician, and optional booking associations.
    """
    __tablename__ = "clinical_encounters"

    id: Mapped[UUID] = mapped_column(
        Uuid(as_uuid=True),
        primary_key=True,
        default=uuid4,
    )
    clinic_id: Mapped[Optional[UUID]] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("clinics.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    patient_id: Mapped[UUID] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("patients.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    clinician_id: Mapped[UUID] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("team_members.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    booking_id: Mapped[Optional[UUID]] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("bookings.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    appointment_id: Mapped[Optional[UUID]] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("appointments_legacy.id", ondelete="SET NULL"),
        nullable=True,
    )
    status: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
        default="draft",
        index=True,
    )
    chief_complaint: Mapped[Optional[str]] = mapped_column(
        Text,
        nullable=True,
    )
    reason_for_visit: Mapped[Optional[str]] = mapped_column(
        Text,
        nullable=True,
    )
    started_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )
    ended_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
    )

    __table_args__ = (
        Index(
            "ix_clinical_encounters_patient_created",
            "patient_id",
            created_at.desc(),
        ),
        Index(
            "ix_clinical_encounters_clinician_status",
            "clinician_id",
            "status",
        ),
    )


class ClinicalNoteORM(Base):
    """
    Stores structured SOAP clinical note revision snapshots.
    """
    __tablename__ = "clinical_notes"

    id: Mapped[UUID] = mapped_column(
        Uuid(as_uuid=True),
        primary_key=True,
        default=uuid4,
    )
    encounter_id: Mapped[UUID] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("clinical_encounters.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    patient_id: Mapped[UUID] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("patients.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    clinic_id: Mapped[Optional[UUID]] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("clinics.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    author_id: Mapped[UUID] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("team_members.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    revision_number: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        default=1,
    )
    is_current: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=True,
        index=True,
    )
    status: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
        default="draft",
        index=True,
    )
    subjective: Mapped[Optional[str]] = mapped_column(
        Text,
        nullable=True,
    )
    objective: Mapped[Optional[str]] = mapped_column(
        Text,
        nullable=True,
    )
    assessment: Mapped[Optional[str]] = mapped_column(
        Text,
        nullable=True,
    )
    plan: Mapped[Optional[str]] = mapped_column(
        Text,
        nullable=True,
    )
    is_signed: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=False,
    )
    signed_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )
    signed_by_id: Mapped[Optional[UUID]] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("team_members.id", ondelete="RESTRICT"),
        nullable=True,
    )
    amendment_reason: Mapped[Optional[str]] = mapped_column(
        Text,
        nullable=True,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
    )

    __table_args__ = (
        Index(
            "ix_clinical_notes_encounter_revision",
            "encounter_id",
            "revision_number",
            unique=True,
        ),
        Index(
            "uq_clinical_notes_current_per_encounter",
            "encounter_id",
            unique=True,
            postgresql_where=is_current == True,
            sqlite_where=is_current == True,
        ),
    )


class DentalChartFindingORM(Base):
    """
    Stores tooth-level and surface-level dental chart findings.
    Findings are corrected in place with an audit trail and resolved via status;
    rows are never hard-deleted through the application.
    """
    __tablename__ = "dental_chart_findings"

    id: Mapped[UUID] = mapped_column(
        Uuid(as_uuid=True),
        primary_key=True,
        default=uuid4,
    )
    patient_id: Mapped[UUID] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("patients.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    clinic_id: Mapped[Optional[UUID]] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("clinics.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    encounter_id: Mapped[UUID] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("clinical_encounters.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    author_id: Mapped[UUID] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("team_members.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    tooth: Mapped[str] = mapped_column(
        String(2),
        nullable=False,
    )
    surfaces: Mapped[str] = mapped_column(
        String(32),
        nullable=False,
        default="",
    )
    condition: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
    )
    status: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
        default="active",
        index=True,
    )
    notes: Mapped[Optional[str]] = mapped_column(
        Text,
        nullable=True,
    )
    correction_reason: Mapped[Optional[str]] = mapped_column(
        Text,
        nullable=True,
    )
    corrected_by_id: Mapped[Optional[UUID]] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("team_members.id", ondelete="RESTRICT"),
        nullable=True,
    )
    corrected_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )
    resolved_by_id: Mapped[Optional[UUID]] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("team_members.id", ondelete="RESTRICT"),
        nullable=True,
    )
    resolved_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
    )

    __table_args__ = (
        CheckConstraint(
            "tooth IN ('1','2','3','4','5','6','7','8','9','10','11','12','13','14','15','16',"
            "'17','18','19','20','21','22','23','24','25','26','27','28','29','30','31','32',"
            "'A','B','C','D','E','F','G','H','I','J','K','L','M','N','O','P','Q','R','S','T')",
            name="ck_dental_findings_tooth_valid",
        ),
        CheckConstraint(
            "status IN ('active', 'resolved')",
            name="ck_dental_findings_status_valid",
        ),
        CheckConstraint(
            "surfaces = '' OR surfaces NOT LIKE '% %'",
            name="ck_dental_findings_surfaces_format",
        ),
        # Exactly one active copy of an identical finding per patient. Distinct
        # findings on the same tooth or surface remain fully legal.
        Index(
            "uq_dental_findings_active_duplicate",
            "patient_id",
            "tooth",
            "condition",
            "surfaces",
            unique=True,
            postgresql_where=status == "active",
            sqlite_where=status == "active",
        ),
        Index(
            "ix_dental_findings_patient_created",
            "patient_id",
            "created_at",
        ),
        Index(
            "ix_dental_findings_patient_tooth",
            "patient_id",
            "tooth",
        ),
    )


class DentalProcedureORM(Base):
    """
    Stores planned and performed dental procedure records referencing the
    existing services catalog. Lifecycle is carried by status transitions.
    """
    __tablename__ = "dental_procedures"

    id: Mapped[UUID] = mapped_column(
        Uuid(as_uuid=True),
        primary_key=True,
        default=uuid4,
    )
    patient_id: Mapped[UUID] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("patients.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    clinic_id: Mapped[Optional[UUID]] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("clinics.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    encounter_id: Mapped[UUID] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("clinical_encounters.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    recorded_by_id: Mapped[UUID] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("team_members.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    service_id: Mapped[UUID] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("services.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    tooth: Mapped[str] = mapped_column(
        String(2),
        nullable=False,
    )
    surfaces: Mapped[str] = mapped_column(
        String(32),
        nullable=False,
        default="",
    )
    status: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
        default="planned",
        index=True,
    )
    notes: Mapped[Optional[str]] = mapped_column(
        Text,
        nullable=True,
    )
    started_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )
    completed_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )
    completed_by_id: Mapped[Optional[UUID]] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("team_members.id", ondelete="RESTRICT"),
        nullable=True,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
    )

    __table_args__ = (
        CheckConstraint(
            "tooth IN ('1','2','3','4','5','6','7','8','9','10','11','12','13','14','15','16',"
            "'17','18','19','20','21','22','23','24','25','26','27','28','29','30','31','32',"
            "'A','B','C','D','E','F','G','H','I','J','K','L','M','N','O','P','Q','R','S','T')",
            name="ck_dental_procedures_tooth_valid",
        ),
        CheckConstraint(
            "status IN ('planned', 'in_progress', 'completed', 'cancelled')",
            name="ck_dental_procedures_status_valid",
        ),
        CheckConstraint(
            "surfaces = '' OR surfaces NOT LIKE '% %'",
            name="ck_dental_procedures_surfaces_format",
        ),
        CheckConstraint(
            "(status = 'completed') = (completed_at IS NOT NULL)",
            name="ck_dental_procedures_completion_consistency",
        ),
        Index(
            "ix_dental_procedures_patient_created",
            "patient_id",
            "created_at",
        ),
        Index(
            "ix_dental_procedures_patient_status",
            "patient_id",
            "status",
        ),
    )


class ClinicWorkingHoursORM(Base):
    """
    Stores operating hours per day of week (0=Mon .. 6=Sun) with closure status.
    """
    __tablename__ = "clinic_working_hours"

    id: Mapped[UUID] = mapped_column(
        Uuid(as_uuid=True),
        primary_key=True,
        default=uuid4,
    )
    clinic_id: Mapped[Optional[UUID]] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("clinics.id", ondelete="CASCADE"),
        nullable=True,
        index=True,
    )
    day_of_week: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        index=True,
    )
    open_time: Mapped[Optional[str]] = mapped_column(
        String(10),
        nullable=True,
    )
    close_time: Mapped[Optional[str]] = mapped_column(
        String(10),
        nullable=True,
    )
    is_closed: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=False,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
    )


class ClinicBookingSettingsORM(Base):
    """
    Stores booking controls, emergency pause, resume dates, and advance booking window.
    """
    __tablename__ = "clinic_booking_settings"

    id: Mapped[UUID] = mapped_column(
        Uuid(as_uuid=True),
        primary_key=True,
        default=uuid4,
    )
    clinic_id: Mapped[Optional[UUID]] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("clinics.id", ondelete="CASCADE"),
        nullable=True,
        index=True,
    )
    booking_mode: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
        default="open",
        server_default="open",
    )
    pause_message: Mapped[Optional[str]] = mapped_column(
        Text,
        nullable=True,
    )
    pause_started_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )
    pause_started_by_user_id: Mapped[Optional[UUID]] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )
    resume_on: Mapped[Optional[date]] = mapped_column(
        Date,
        nullable=True,
    )
    advance_booking_days: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        default=60,
    )
    min_lead_time_hours: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        default=2,
    )
    slot_interval_minutes: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        default=15,
    )
    reminder_template: Mapped[Optional[str]] = mapped_column(
        Text,
        nullable=True,
    )
    reminder_template_urdu: Mapped[Optional[str]] = mapped_column(
        Text,
        nullable=True,
    )
    reminder_24h_enabled: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=True,
        server_default=true(),
    )
    reminder_2h_enabled: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=True,
        server_default=true(),
    )
    waiting_threshold_minutes: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        default=15,
        server_default="15",
    )
    file_number_prefix: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
        default="MD-",
        server_default="MD-",
    )
    payments_enabled: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=True,
        server_default=true(),
    )
    quiet_hours_enabled: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=True,
        server_default=true(),
    )
    quiet_hours_start: Mapped[str] = mapped_column(
        String(5),
        nullable=False,
        default="21:00",
        server_default="21:00",
    )
    quiet_hours_end: Mapped[str] = mapped_column(
        String(5),
        nullable=False,
        default="08:00",
        server_default="08:00",
    )
    messaging_provider_mode: Mapped[str] = mapped_column(
        String(32),
        nullable=False,
        default="simulated",
        server_default="simulated",
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
    )


class ClinicClosureORM(Base):
    """
    Stores planned calendar closures (holidays, maintenance, renovations).
    """
    __tablename__ = "clinic_closures"

    id: Mapped[UUID] = mapped_column(
        Uuid(as_uuid=True),
        primary_key=True,
        default=uuid4,
    )
    clinic_id: Mapped[Optional[UUID]] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("clinics.id", ondelete="CASCADE"),
        nullable=True,
    )
    start_date: Mapped[date] = mapped_column(
        Date,
        nullable=False,
    )
    end_date: Mapped[date] = mapped_column(
        Date,
        nullable=False,
    )
    reason: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
    )
    message: Mapped[Optional[str]] = mapped_column(
        Text,
        nullable=True,
    )
    created_by_user_id: Mapped[Optional[UUID]] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
    )


class ProviderAvailabilityORM(Base):
    """
    Stores working hours and breaks for clinicians.
    """
    __tablename__ = "provider_availability"

    id: Mapped[UUID] = mapped_column(
        Uuid(as_uuid=True),
        primary_key=True,
        default=uuid4,
    )
    team_member_id: Mapped[UUID] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("team_members.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    day_of_week: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
    )
    start_time: Mapped[str] = mapped_column(
        String(10),
        nullable=False,
    )
    end_time: Mapped[str] = mapped_column(
        String(10),
        nullable=False,
    )
    break_start_time: Mapped[Optional[str]] = mapped_column(
        String(10),
        nullable=True,
    )
    break_end_time: Mapped[Optional[str]] = mapped_column(
        String(10),
        nullable=True,
    )
    is_active: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=True,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
    )


class ProviderTimeOffORM(Base):
    """
    Stores planned leaves, vacations, or sick leaves for clinicians.
    """
    __tablename__ = "provider_time_off"

    id: Mapped[UUID] = mapped_column(
        Uuid(as_uuid=True),
        primary_key=True,
        default=uuid4,
    )
    team_member_id: Mapped[UUID] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("team_members.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    start_date: Mapped[date] = mapped_column(
        Date,
        nullable=False,
    )
    end_date: Mapped[date] = mapped_column(
        Date,
        nullable=False,
    )
    reason: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
    )
    is_approved: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=True,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
    )


class ServiceProviderORM(Base):
    """
    Associates which clinicians provide which services.
    """
    __tablename__ = "service_providers"

    id: Mapped[UUID] = mapped_column(
        Uuid(as_uuid=True),
        primary_key=True,
        default=uuid4,
    )
    service_id: Mapped[UUID] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("services.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    team_member_id: Mapped[UUID] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("team_members.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )


class VisitPaymentORM(Base):
    """
    Stores payment collections recorded at front desk / reception for patient visits.
    """
    __tablename__ = "visit_payments"

    id: Mapped[UUID] = mapped_column(
        Uuid(as_uuid=True),
        primary_key=True,
        default=uuid4,
    )
    clinic_id: Mapped[Optional[UUID]] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("clinics.id", ondelete="CASCADE"),
        nullable=True,
        index=True,
    )
    booking_id: Mapped[Optional[UUID]] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("bookings.id", ondelete="CASCADE"),
        nullable=True,
        index=True,
    )
    patient_id: Mapped[Optional[UUID]] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("patients.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    amount_cents: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
    )
    currency: Mapped[str] = mapped_column(
        String(3),
        nullable=False,
        default="PKR",
        server_default="PKR",
    )
    method: Mapped[str] = mapped_column(
        String(32),
        nullable=False,
        default="cash",
    )
    notes: Mapped[Optional[str]] = mapped_column(
        Text,
        nullable=True,
    )
    recorded_by_user_id: Mapped[Optional[UUID]] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    amount_charged_cents: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        default=0,
        server_default="0",
    )
    is_voided: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=False,
        server_default=false(),
    )
    void_reason: Mapped[Optional[str]] = mapped_column(
        Text,
        nullable=True,
    )
    voided_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )
    voided_by_user_id: Mapped[Optional[UUID]] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )


class TreatmentPlanItemORM(Base):
    """
    Stores individual planned procedures within a patient's overall treatment plan.
    """
    __tablename__ = "treatment_plan_items"

    id: Mapped[UUID] = mapped_column(Uuid(as_uuid=True), primary_key=True, default=uuid4)
    patient_id: Mapped[UUID] = mapped_column(Uuid(as_uuid=True), ForeignKey("patients.id", ondelete="CASCADE"), nullable=False, index=True)
    tooth_number: Mapped[Optional[int]] = mapped_column(Integer, nullable=True, index=True)
    service_id: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    procedure_name: Mapped[str] = mapped_column(String(255), nullable=False)
    status: Mapped[str] = mapped_column(String(32), nullable=False, default="proposed", server_default="proposed")
    estimated_cost_cents: Mapped[int] = mapped_column(Integer, nullable=False, default=0, server_default="0")
    decision_date: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    completed_procedure_id: Mapped[Optional[UUID]] = mapped_column(Uuid(as_uuid=True), ForeignKey("dental_procedures.id", ondelete="SET NULL"), nullable=True)
    created_by_user_id: Mapped[UUID] = mapped_column(Uuid(as_uuid=True), ForeignKey("users.id", ondelete="RESTRICT"), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now())


class ClinicalNoteTemplateORM(Base):
    """
    Neutral note structure templates with prompts and section headings.
    """
    __tablename__ = "clinical_note_templates"

    id: Mapped[UUID] = mapped_column(Uuid(as_uuid=True), primary_key=True, default=uuid4)
    name: Mapped[str] = mapped_column(String(100), unique=True, nullable=False, index=True)
    subjective: Mapped[str] = mapped_column(Text, nullable=False)
    objective: Mapped[str] = mapped_column(Text, nullable=False)
    assessment: Mapped[str] = mapped_column(Text, nullable=False)
    plan: Mapped[str] = mapped_column(Text, nullable=False)
    active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True, server_default=true())
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now())


class PatientAttachmentORM(Base):
    """
    Stores private patient attachments (x-rays, photos, consent scans, etc.) outside public web root.
    """
    __tablename__ = "patient_attachments"

    id: Mapped[UUID] = mapped_column(Uuid(as_uuid=True), primary_key=True, default=uuid4)
    patient_id: Mapped[UUID] = mapped_column(Uuid(as_uuid=True), ForeignKey("patients.id", ondelete="CASCADE"), nullable=False, index=True)
    encounter_id: Mapped[Optional[UUID]] = mapped_column(Uuid(as_uuid=True), ForeignKey("clinical_encounters.id", ondelete="SET NULL"), nullable=True, index=True)
    category: Mapped[str] = mapped_column(String(32), nullable=False, index=True)
    original_filename: Mapped[str] = mapped_column(String(255), nullable=False)
    content_type: Mapped[str] = mapped_column(String(100), nullable=False)
    size: Mapped[int] = mapped_column(Integer, nullable=False)
    stored_name: Mapped[str] = mapped_column(String(255), unique=True, nullable=False)
    uploaded_by: Mapped[UUID] = mapped_column(Uuid(as_uuid=True), ForeignKey("users.id", ondelete="RESTRICT"), nullable=False)
    uploaded_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())
    voided: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False, server_default=false())
    void_reason: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    voided_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    voided_by: Mapped[Optional[UUID]] = mapped_column(Uuid(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)


class PatientConsentORM(Base):
    """
    Tracks informed consent records for patients, encounters, and procedures.
    """
    __tablename__ = "patient_consents"

    id: Mapped[UUID] = mapped_column(Uuid(as_uuid=True), primary_key=True, default=uuid4)
    patient_id: Mapped[UUID] = mapped_column(Uuid(as_uuid=True), ForeignKey("patients.id", ondelete="CASCADE"), nullable=False, index=True)
    encounter_id: Mapped[Optional[UUID]] = mapped_column(Uuid(as_uuid=True), ForeignKey("clinical_encounters.id", ondelete="SET NULL"), nullable=True, index=True)
    procedure_id: Mapped[Optional[UUID]] = mapped_column(Uuid(as_uuid=True), ForeignKey("dental_procedures.id", ondelete="SET NULL"), nullable=True)
    consent_type: Mapped[str] = mapped_column(String(100), nullable=False)
    consent_text_version: Mapped[str] = mapped_column(String(50), nullable=False, default="1.0", server_default="1.0")
    method: Mapped[str] = mapped_column(String(32), nullable=False)
    signed_name: Mapped[str] = mapped_column(String(255), nullable=False)
    attachment_id: Mapped[Optional[UUID]] = mapped_column(Uuid(as_uuid=True), ForeignKey("patient_attachments.id", ondelete="SET NULL"), nullable=True)
    obtained_by: Mapped[UUID] = mapped_column(Uuid(as_uuid=True), ForeignKey("users.id", ondelete="RESTRICT"), nullable=False)
    recorded_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())
    voided: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False, server_default=false())
    void_reason: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    voided_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    voided_by: Mapped[Optional[UUID]] = mapped_column(Uuid(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)


class PrescriptionORM(Base):
    """
    Prescription orders linked to encounters.
    """
    __tablename__ = "prescriptions"

    id: Mapped[UUID] = mapped_column(Uuid(as_uuid=True), primary_key=True, default=uuid4)
    encounter_id: Mapped[UUID] = mapped_column(Uuid(as_uuid=True), ForeignKey("clinical_encounters.id", ondelete="CASCADE"), nullable=False, index=True)
    patient_id: Mapped[UUID] = mapped_column(Uuid(as_uuid=True), ForeignKey("patients.id", ondelete="CASCADE"), nullable=False, index=True)
    status: Mapped[str] = mapped_column(String(32), nullable=False, default="draft", server_default="draft")
    items_json: Mapped[str] = mapped_column(Text, nullable=False)
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    doctor_id: Mapped[UUID] = mapped_column(Uuid(as_uuid=True), ForeignKey("users.id", ondelete="RESTRICT"), nullable=False)
    signed_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    signed_by_user_id: Mapped[Optional[UUID]] = mapped_column(Uuid(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now())


class ReferralLetterORM(Base):
    """
    Referral letters linked to encounters.
    """
    __tablename__ = "referral_letters"

    id: Mapped[UUID] = mapped_column(Uuid(as_uuid=True), primary_key=True, default=uuid4)
    encounter_id: Mapped[UUID] = mapped_column(Uuid(as_uuid=True), ForeignKey("clinical_encounters.id", ondelete="CASCADE"), nullable=False, index=True)
    patient_id: Mapped[UUID] = mapped_column(Uuid(as_uuid=True), ForeignKey("patients.id", ondelete="CASCADE"), nullable=False, index=True)
    status: Mapped[str] = mapped_column(String(32), nullable=False, default="draft", server_default="draft")
    recipient: Mapped[str] = mapped_column(String(255), nullable=False)
    reason: Mapped[str] = mapped_column(Text, nullable=False)
    summary: Mapped[str] = mapped_column(Text, nullable=False)
    doctor_id: Mapped[UUID] = mapped_column(Uuid(as_uuid=True), ForeignKey("users.id", ondelete="RESTRICT"), nullable=False)
    signed_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    signed_by_user_id: Mapped[Optional[UUID]] = mapped_column(Uuid(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now())



