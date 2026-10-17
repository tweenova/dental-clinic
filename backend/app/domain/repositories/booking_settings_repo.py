from abc import ABC, abstractmethod
from datetime import date
from typing import List, Optional
from uuid import UUID

from app.domain.models.booking_settings import (
    BookingSettings,
    ClinicClosure,
    ProviderAvailability,
    ProviderTimeOff,
    ServiceProviderLink,
    WorkingHours,
)


class BookingSettingsRepository(ABC):
    """
    Protocol for reading and mutating clinic working hours, closures, and booking settings.
    """

    @abstractmethod
    async def get_settings(self, clinic_id: Optional[UUID] = None) -> BookingSettings:
        pass

    @abstractmethod
    async def update_settings(self, settings: BookingSettings) -> BookingSettings:
        pass

    @abstractmethod
    async def list_working_hours(self, clinic_id: Optional[UUID] = None) -> List[WorkingHours]:
        pass

    @abstractmethod
    async def update_working_hours(self, hours: List[WorkingHours]) -> List[WorkingHours]:
        pass

    @abstractmethod
    async def list_closures(self, clinic_id: Optional[UUID] = None, future_only: bool = False) -> List[ClinicClosure]:
        pass

    @abstractmethod
    async def get_closure(self, closure_id: UUID) -> Optional[ClinicClosure]:
        pass

    @abstractmethod
    async def save_closure(self, closure: ClinicClosure) -> ClinicClosure:
        pass

    @abstractmethod
    async def delete_closure(self, closure_id: UUID) -> bool:
        pass

    @abstractmethod
    async def list_provider_availabilities(self, team_member_id: Optional[UUID] = None) -> List[ProviderAvailability]:
        pass

    @abstractmethod
    async def save_provider_availability(self, avail: ProviderAvailability) -> ProviderAvailability:
        pass

    @abstractmethod
    async def delete_provider_availability(self, avail_id: UUID) -> bool:
        pass

    @abstractmethod
    async def list_provider_time_off(self, team_member_id: Optional[UUID] = None, future_only: bool = False) -> List[ProviderTimeOff]:
        pass

    @abstractmethod
    async def save_provider_time_off(self, time_off: ProviderTimeOff) -> ProviderTimeOff:
        pass

    @abstractmethod
    async def delete_provider_time_off(self, time_off_id: UUID) -> bool:
        pass

    @abstractmethod
    async def list_service_providers(self, service_id: Optional[UUID] = None, team_member_id: Optional[UUID] = None) -> List[ServiceProviderLink]:
        pass

    @abstractmethod
    async def set_service_providers(self, service_id: UUID, team_member_ids: List[UUID]) -> None:
        pass

