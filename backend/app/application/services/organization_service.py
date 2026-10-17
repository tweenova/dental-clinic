from datetime import datetime, timezone
from typing import List, Optional
from uuid import UUID

from fastapi import HTTPException, status

from app.application.dtos.organization_dto import (
    LocationCreateRequest,
    LocationUpdateRequest,
    OrganizationUpdateRequest,
)
from app.domain.models.organization import Location, Organization
from app.domain.repositories.organization_repo import LocationRepository, OrganizationRepository


class OrganizationService:
    """Orchestrates organization and clinic location operations."""

    def __init__(
        self,
        org_repo: OrganizationRepository,
        location_repo: LocationRepository,
    ):
        self.org_repo = org_repo
        self.location_repo = location_repo

    async def get_organization(self) -> Organization:
        org = await self.org_repo.get_current()
        if not org:
            # Create default Marlow Dental organization if not exists
            org = Organization(
                name="Marlow Dental",
                display_name="Marlow Dental Practice",
                tagline="Comprehensive, unhurried dental care.",
                description="Independent dental practice focused on direct doctor continuity and upfront fee transparency.",
                contact_email="care@marlowdental.com",
                contact_phone="+92 300 1234567",
                website_url="https://marlowdental.com",
            )
            org = await self.org_repo.save(org)
        return org

    async def update_organization(self, req: OrganizationUpdateRequest) -> Organization:
        org = await self.get_organization()

        if req.name is not None:
            org.name = req.name.strip()
        if req.displayName is not None:
            org.display_name = req.displayName.strip()
        if req.tagline is not None:
            org.tagline = req.tagline.strip() or None
        if req.description is not None:
            org.description = req.description.strip() or None
        if req.logoUrl is not None:
            org.logo_url = req.logoUrl or None
        if req.contactEmail is not None:
            org.contact_email = req.contactEmail.strip() or None
        if req.contactPhone is not None:
            org.contact_phone = req.contactPhone.strip() or None
        if req.websiteUrl is not None:
            org.website_url = req.websiteUrl.strip() or None
        if req.primaryColor is not None:
            org.primary_color = req.primaryColor.strip() or None
        if req.secondaryColor is not None:
            org.secondary_color = req.secondaryColor.strip() or None
        if req.backgroundColor is not None:
            org.background_color = req.backgroundColor.strip() or None
        if req.primaryFont is not None:
            org.primary_font = req.primaryFont.strip() or None
        if req.secondaryFont is not None:
            org.secondary_font = req.secondaryFont.strip() or None
        if req.currencyCode is not None:
            org.currency_code = req.currencyCode.strip() or "PKR"
        if req.currencySymbol is not None:
            org.currency_symbol = req.currencySymbol.strip() or "Rs"
        if req.timezone is not None:
            org.timezone = req.timezone.strip() or "Asia/Karachi"

        org.updated_at = datetime.now(timezone.utc)
        return await self.org_repo.save(org)

    async def list_locations(self, include_inactive: bool = False) -> List[Location]:
        return await self.location_repo.list_all(include_inactive=include_inactive)

    async def get_location(self, location_id: UUID) -> Location:
        loc = await self.location_repo.get_by_id(location_id)
        if not loc:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Location not found.",
            )
        return loc

    async def create_location(self, req: LocationCreateRequest) -> Location:
        org = await self.get_organization()
        loc = Location(
            organization_id=org.id,
            name=req.name.strip(),
            address_line1=req.addressLine1.strip(),
            address_line2=req.addressLine2.strip() if req.addressLine2 else None,
            city=req.city.strip(),
            state=req.state.strip(),
            postal_code=req.postalCode.strip(),
            country=req.country.strip(),
            phone=req.phone.strip() if req.phone else None,
            email=req.email.strip() if req.email else None,
            hours_info=req.hoursInfo.strip() if req.hoursInfo else None,
            is_primary=req.isPrimary,
            is_active=req.isActive,
            display_order=req.displayOrder,
        )
        return await self.location_repo.save(loc)

    async def update_location(self, location_id: UUID, req: LocationUpdateRequest) -> Location:
        loc = await self.get_location(location_id)

        if req.name is not None:
            loc.name = req.name.strip()
        if req.addressLine1 is not None:
            loc.address_line1 = req.addressLine1.strip()
        if req.addressLine2 is not None:
            loc.address_line2 = req.addressLine2.strip() or None
        if req.city is not None:
            loc.city = req.city.strip()
        if req.state is not None:
            loc.state = req.state.strip()
        if req.postalCode is not None:
            loc.postal_code = req.postalCode.strip()
        if req.country is not None:
            loc.country = req.country.strip()
        if req.phone is not None:
            loc.phone = req.phone.strip() or None
        if req.email is not None:
            loc.email = req.email.strip() or None
        if req.hoursInfo is not None:
            loc.hours_info = req.hoursInfo.strip() or None
        if req.isPrimary is not None:
            loc.is_primary = req.isPrimary
        if req.isActive is not None:
            loc.is_active = req.isActive
        if req.displayOrder is not None:
            loc.display_order = req.displayOrder

        loc.updated_at = datetime.now(timezone.utc)
        return await self.location_repo.save(loc)

    async def set_location_status(self, location_id: UUID, is_active: bool) -> Location:
        loc = await self.get_location(location_id)
        loc.is_active = is_active
        loc.updated_at = datetime.now(timezone.utc)
        return await self.location_repo.save(loc)
