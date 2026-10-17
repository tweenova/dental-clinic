from abc import ABC, abstractmethod
from datetime import datetime
from typing import List, Optional
from uuid import UUID

from app.domain.models.booking_crm import PatientMedicalAlert


class MedicalAlertRepository(ABC):
    @abstractmethod
    async def get_alerts_for_patient(
        self, patient_id: UUID, active_only: bool = True
    ) -> List[PatientMedicalAlert]:
        pass

    @abstractmethod
    async def get_by_id(self, alert_id: UUID) -> Optional[PatientMedicalAlert]:
        pass

    @abstractmethod
    async def save(self, alert: PatientMedicalAlert) -> PatientMedicalAlert:
        pass

    @abstractmethod
    async def review_all_for_patient(self, patient_id: UUID, reviewed_at: datetime) -> None:
        pass
