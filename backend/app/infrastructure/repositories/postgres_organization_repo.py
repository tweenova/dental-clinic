from typing import List, Optional
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.domain.models.organization import Location, Organization
from app.domain.repositories.organization_repo import LocationRepository, OrganizationRepository
from app.infrastructure.database.orm_models import LocationORM, OrganizationORM


class PostgresOrganizationRepository(OrganizationRepository):
    """PostgreSQL implementation of the OrganizationRepository abstraction."""

    def __init__(self, session: AsyncSession):
        self._session = session

    @staticmethod
    def _to_domain(orm: OrganizationORM) -> Organization:
        return Organization(
            id=orm.id,
            name=orm.name,
            display_name=orm.display_name,
            tagline=orm.tagline,
            description=orm.description,
            logo_url=orm.logo_url,
            contact_email=orm.contact_email,
            contact_phone=orm.contact_phone,
            website_url=orm.website_url,
            primary_color=getattr(orm, "primary_color", None),
            secondary_color=getattr(orm, "secondary_color", None),
            background_color=getattr(orm, "background_color", None),
            primary_font=getattr(orm, "primary_font", None),
            secondary_font=getattr(orm, "secondary_font", None),
            currency_code=getattr(orm, "currency_code", "PKR") or "PKR",
            currency_symbol=getattr(orm, "currency_symbol", "Rs") or "Rs",
            timezone=getattr(orm, "timezone", "Asia/Karachi") or "Asia/Karachi",
            is_active=orm.is_active,
            created_at=orm.created_at,
            updated_at=orm.updated_at,
        )

    async def get_current(self) -> Optional[Organization]:
        stmt = select(OrganizationORM).order_by(OrganizationORM.created_at.asc()).limit(1)
        result = await self._session.execute(stmt)
        orm = result.scalar_one_or_none()
        return self._to_domain(orm) if orm else None

    async def get_by_id(self, org_id: UUID) -> Optional[Organization]:
        orm = await self._session.get(OrganizationORM, org_id)
        return self._to_domain(orm) if orm else None

    async def save(self, org: Organization) -> Organization:
        existing = await self._session.get(OrganizationORM, org.id)
        if existing:
            existing.name = org.name
            existing.display_name = org.display_name
            existing.tagline = org.tagline
            existing.description = org.description
            existing.logo_url = org.logo_url
            existing.contact_email = org.contact_email
            existing.contact_phone = org.contact_phone
            existing.website_url = org.website_url
            existing.primary_color = org.primary_color
            existing.secondary_color = org.secondary_color
            existing.background_color = org.background_color
            existing.primary_font = org.primary_font
            existing.secondary_font = org.secondary_font
            existing.currency_code = org.currency_code
            existing.currency_symbol = org.currency_symbol
            existing.timezone = org.timezone
            existing.is_active = org.is_active
            existing.updated_at = org.updated_at
            await self._session.flush()
            return self._to_domain(existing)
        else:
            orm = OrganizationORM(
                id=org.id,
                name=org.name,
                display_name=org.display_name,
                tagline=org.tagline,
                description=org.description,
                logo_url=org.logo_url,
                contact_email=org.contact_email,
                contact_phone=org.contact_phone,
                website_url=org.website_url,
                primary_color=org.primary_color,
                secondary_color=org.secondary_color,
                background_color=org.background_color,
                primary_font=org.primary_font,
                secondary_font=org.secondary_font,
                currency_code=org.currency_code,
                currency_symbol=org.currency_symbol,
                timezone=org.timezone,
                is_active=org.is_active,
                created_at=org.created_at,
                updated_at=org.updated_at,
            )
            self._session.add(orm)
            await self._session.flush()
            return self._to_domain(orm)


class PostgresLocationRepository(LocationRepository):
    """PostgreSQL implementation of the LocationRepository abstraction."""

    def __init__(self, session: AsyncSession):
        self._session = session

    @staticmethod
    def _to_domain(orm: LocationORM) -> Location:
        return Location(
            id=orm.id,
            organization_id=orm.organization_id,
            name=orm.name,
            address_line1=orm.address_line1,
            address_line2=orm.address_line2,
            city=orm.city,
            state=orm.state,
            postal_code=orm.postal_code,
            country=orm.country,
            phone=orm.phone,
            email=orm.email,
            hours_info=orm.hours_info,
            is_primary=orm.is_primary,
            is_active=orm.is_active,
            display_order=orm.display_order,
            created_at=orm.created_at,
            updated_at=orm.updated_at,
        )

    async def list_all(self, include_inactive: bool = False) -> List[Location]:
        stmt = select(LocationORM)
        if not include_inactive:
            stmt = stmt.where(LocationORM.is_active.is_(True))
        stmt = stmt.order_by(LocationORM.display_order.asc(), LocationORM.name.asc())
        result = await self._session.execute(stmt)
        return [self._to_domain(orm) for orm in result.scalars().all()]

    async def get_by_id(self, location_id: UUID) -> Optional[Location]:
        orm = await self._session.get(LocationORM, location_id)
        return self._to_domain(orm) if orm else None

    async def save(self, location: Location) -> Location:
        existing = await self._session.get(LocationORM, location.id)
        if existing:
            existing.organization_id = location.organization_id
            existing.name = location.name
            existing.address_line1 = location.address_line1
            existing.address_line2 = location.address_line2
            existing.city = location.city
            existing.state = location.state
            existing.postal_code = location.postal_code
            existing.country = location.country
            existing.phone = location.phone
            existing.email = location.email
            existing.hours_info = location.hours_info
            existing.is_primary = location.is_primary
            existing.is_active = location.is_active
            existing.display_order = location.display_order
            existing.updated_at = location.updated_at
            await self._session.flush()
            return self._to_domain(existing)
        else:
            orm = LocationORM(
                id=location.id,
                organization_id=location.organization_id,
                name=location.name,
                address_line1=location.address_line1,
                address_line2=location.address_line2,
                city=location.city,
                state=location.state,
                postal_code=location.postal_code,
                country=location.country,
                phone=location.phone,
                email=location.email,
                hours_info=location.hours_info,
                is_primary=location.is_primary,
                is_active=location.is_active,
                display_order=location.display_order,
                created_at=location.created_at,
                updated_at=location.updated_at,
            )
            self._session.add(orm)
            await self._session.flush()
            return self._to_domain(orm)
