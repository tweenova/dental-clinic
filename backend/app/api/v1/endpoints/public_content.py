from datetime import date, datetime
from typing import List, Optional
from uuid import UUID
from zoneinfo import ZoneInfo
from fastapi import APIRouter, Depends, Query

from app.api.deps import (
    get_announcement_service,
    get_availability_service,
    get_booking_settings_service,
    get_cms_service,
    get_organization_service,
    get_service_service,
    get_team_service,
)
from app.application.dtos.announcement_dto import AnnouncementResponse
from app.application.dtos.booking_settings_dto import (
    PublicAvailabilityResponse,
    PublicBookingStatusResponse,
    WorkingHoursDto,
)
from app.application.services.availability_service import AvailabilityService
from app.application.dtos.cms_dto import FaqResponse, PublicCmsResponse
from app.application.dtos.organization_dto import LocationResponse, OrganizationResponse
from app.application.dtos.service_dto import ServiceResponse
from app.application.dtos.team_dto import TeamMemberResponse
from app.application.services.announcement_service import AnnouncementService
from app.application.services.booking_settings_service import BookingSettingsService
from app.application.services.cms_service import CmsService
from app.application.services.organization_service import OrganizationService
from app.application.services.service_service import ServiceService
from app.application.services.team_service import TeamService

router = APIRouter(prefix="/public", tags=["Public Content"])


@router.get("/content", response_model=PublicCmsResponse)
async def get_site_content(
    cms_service: CmsService = Depends(get_cms_service),
) -> PublicCmsResponse:
    """Returns database-backed CMS copy for public frontend rendering."""
    return await cms_service.get_public_cms()


@router.get("/services", response_model=List[ServiceResponse])
async def get_public_services(
    service_service: ServiceService = Depends(get_service_service),
) -> List[ServiceResponse]:
    """Returns all active dental procedures for public display and booking."""
    services = await service_service.list_services(include_inactive=False, public_only=True)
    return [
        ServiceResponse(
            id=s.id,
            slug=s.slug,
            category=s.category,
            title=s.title,
            shortDesc=s.short_desc,
            fullDesc=s.full_desc,
            cashPrice=s.cash_price,
            duration=s.duration,
            code=s.code,
            insuranceNote=s.insurance_note,
            recommendedInterval=s.recommended_interval,
            displayOrder=s.display_order,
            isHighlighted=s.is_highlighted,
            isActive=s.is_active,
            isPublic=s.is_public,
            bookableOnline=getattr(s, "bookable_online", True),
            bufferMinutes=getattr(s, "buffer_minutes", 0),
            createdAt=s.created_at,
            updatedAt=s.updated_at,
        )
        for s in services
    ]


@router.get("/team", response_model=List[TeamMemberResponse])
async def get_public_team(
    team_service: TeamService = Depends(get_team_service),
) -> List[TeamMemberResponse]:
    """Returns all active clinicians and staff for public display."""
    members = await team_service.list_members(include_inactive=False)
    return [
        TeamMemberResponse(
            id=m.id,
            organizationId=m.organization_id,
            locationId=m.location_id,
            firstName=m.first_name,
            lastName=m.last_name,
            displayName=m.display_name,
            professionalTitle=m.professional_title,
            role=m.role,
            specialties=m.specialties,
            biography=m.biography,
            photoUrl=m.photo_url,
            education=m.education,
            credentials=m.credentials,
            licenseNumber=m.license_number,
            licenseState=m.license_state,
            servicesOffered=m.services_offered,
            displayOrder=m.display_order,
            isActive=m.is_active,
            createdAt=m.created_at,
            updatedAt=m.updated_at,
        )
        for m in members
    ]


@router.get("/locations", response_model=List[LocationResponse])
async def get_public_locations(
    org_service: OrganizationService = Depends(get_organization_service),
) -> List[LocationResponse]:
    """Returns all active office locations."""
    locations = await org_service.list_locations(include_inactive=False)
    return [
        LocationResponse(
            id=loc.id,
            organizationId=loc.organization_id,
            name=loc.name,
            addressLine1=loc.address_line1,
            addressLine2=loc.address_line2,
            city=loc.city,
            state=loc.state,
            postalCode=loc.postal_code,
            country=loc.country,
            phone=loc.phone,
            email=loc.email,
            hoursInfo=loc.hours_info,
            isPrimary=loc.is_primary,
            isActive=loc.is_active,
            displayOrder=loc.display_order,
            createdAt=loc.created_at,
            updatedAt=loc.updated_at,
        )
        for loc in locations
    ]


@router.get("/faq", response_model=List[FaqResponse])
async def get_public_faqs(
    cms_service: CmsService = Depends(get_cms_service),
) -> List[FaqResponse]:
    """Returns all active FAQ items."""
    faqs = await cms_service.list_faqs(include_inactive=False)
    return [
        FaqResponse(
            id=f.id,
            category=f.category,
            question=f.question,
            answer=f.answer,
            displayOrder=f.display_order,
            isActive=f.is_active,
            createdAt=f.created_at,
            updatedAt=f.updated_at,
        )
        for f in faqs
    ]


@router.get("/organization", response_model=OrganizationResponse)
async def get_public_organization(
    org_service: OrganizationService = Depends(get_organization_service),
) -> OrganizationResponse:
    """Returns top-level practice organization details including branding, currency, and dynamic theming."""
    org = await org_service.get_organization()
    return OrganizationResponse(
        id=org.id,
        name=org.name,
        displayName=org.display_name,
        tagline=org.tagline,
        description=org.description,
        logoUrl=org.logo_url,
        contactEmail=org.contact_email,
        contactPhone=org.contact_phone,
        websiteUrl=org.website_url,
        primaryColor=org.primary_color,
        secondaryColor=org.secondary_color,
        backgroundColor=org.background_color,
        primaryFont=org.primary_font,
        secondaryFont=org.secondary_font,
        currencyCode=org.currency_code or "PKR",
        currencySymbol=org.currency_symbol or "Rs",
        timezone=org.timezone or "Asia/Karachi",
        isActive=org.is_active,
        createdAt=org.created_at,
        updatedAt=org.updated_at,
    )


@router.get("/booking-status", response_model=PublicBookingStatusResponse)
async def get_public_booking_status(
    booking_settings_service: BookingSettingsService = Depends(get_booking_settings_service),
) -> PublicBookingStatusResponse:
    """Returns current booking availability mode, notice message, and clinic phone without personal data."""
    return await booking_settings_service.get_public_booking_status()


@router.get("/working-hours", response_model=List[WorkingHoursDto])
async def get_public_working_hours(
    booking_settings_service: BookingSettingsService = Depends(get_booking_settings_service),
) -> List[WorkingHoursDto]:
    """Returns single source of truth clinic operating hours across all 7 days of the week."""
    return await booking_settings_service.get_public_working_hours()


@router.get("/booking-schedule")
async def get_public_booking_schedule(
    booking_settings_service: BookingSettingsService = Depends(get_booking_settings_service),
):
    """Consolidated schedule configuration for date-pickers: working hours, closures, and advance window."""
    return await booking_settings_service.get_public_schedule()


@router.get("/availability", response_model=PublicAvailabilityResponse)
async def get_public_availability(
    date: Optional[date] = Query(None, description="Requested booking date (YYYY-MM-DD)"),
    serviceId: Optional[str] = Query(None, description="Optional service ID or slug"),
    teamMemberId: Optional[UUID] = Query(None, description="Optional clinician ID"),
    avail_service: AvailabilityService = Depends(get_availability_service),
) -> PublicAvailabilityResponse:
    """
    Computes real-time available booking slots based on clinic working hours,
    breaks, planned closures, approved clinician leaves, service durations and buffers,
    lead times, advance booking windows, and existing bookings in Asia/Karachi timezone.
    Never exposes personal patient or doctor information.
    """
    target_date = date or datetime.now(ZoneInfo("Asia/Karachi")).date()
    slots = await avail_service.get_available_slots(
        target_date=target_date,
        service_id=serviceId,
        team_member_id=teamMemberId,
    )
    return PublicAvailabilityResponse(
        date=target_date,
        serviceId=serviceId,
        teamMemberId=teamMemberId,
        timezone="Asia/Karachi",
        slots=slots,
    )




@router.get("/announcements", response_model=List[AnnouncementResponse])
async def get_public_announcements(
    service: AnnouncementService = Depends(get_announcement_service),
) -> List[AnnouncementResponse]:
    """Returns all active marquee ticker announcements."""
    items = await service.list_announcements(include_inactive=False)
    return [
        AnnouncementResponse(
            id=item.id,
            content=item.content,
            isActive=item.is_active,
            displayOrder=item.display_order,
            createdAt=item.created_at,
            updatedAt=item.updated_at,
        )
        for item in items
    ]


@router.get("/clinics", response_model=List[LocationResponse])
async def get_public_clinics(
    org_service: OrganizationService = Depends(get_organization_service),
) -> List[LocationResponse]:
    """Returns all active clinic branches."""
    return await get_public_locations(org_service)

