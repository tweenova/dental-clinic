from abc import ABC, abstractmethod
from typing import List, Optional, Tuple
from uuid import UUID

from app.domain.models.booking_crm import Task


class TaskRepository(ABC):
    """
    Contract for managing front-office and clinical operational tasks.
    """

    @abstractmethod
    async def save(self, task: Task) -> Task:
        """Saves a new task or updates an existing task."""
        pass

    @abstractmethod
    async def get_by_id(self, task_id: UUID) -> Optional[Task]:
        """Retrieves a task by its unique ID."""
        pass

    @abstractmethod
    async def list_tasks(
        self,
        clinic_id: Optional[UUID] = None,
        assigned_to_user_id: Optional[UUID] = None,
        status: Optional[str] = None,
        priority: Optional[str] = None,
        limit: int = 100,
        offset: int = 0,
    ) -> Tuple[List[Task], int]:
        """Returns filtered tasks with pagination and total count."""
        pass
