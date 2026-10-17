from abc import ABC, abstractmethod
from typing import Optional
from uuid import UUID

from app.domain.models.user import RefreshToken, User, UserSession


class UserRepository(ABC):
    """Abstract interface defining persistence operations for User entities."""

    @abstractmethod
    async def get_by_id(self, user_id: UUID) -> Optional[User]:
        pass

    @abstractmethod
    async def get_by_email(self, email: str) -> Optional[User]:
        pass

    @abstractmethod
    async def save(self, user: User) -> User:
        pass

    @abstractmethod
    async def list_users(
        self, role: Optional[str] = None, is_active: Optional[bool] = None
    ) -> list[User]:
        pass

    @abstractmethod
    async def update_inactivity_settings(
        self,
        user_id: UUID,
        inactivity_enabled: bool,
        inactivity_timeout_minutes: int,
        inactivity_warning_seconds: int,
    ) -> Optional[User]:
        pass


class UserSessionRepository(ABC):
    """Abstract interface defining persistence operations for UserSession entities."""

    @abstractmethod
    async def save(self, session: UserSession) -> UserSession:
        pass

    @abstractmethod
    async def get_by_id(self, session_id: UUID) -> Optional[UserSession]:
        pass

    @abstractmethod
    async def revoke(self, session_id: UUID) -> None:
        pass

    @abstractmethod
    async def revoke_all_for_user(self, user_id: UUID) -> None:
        pass


class RefreshTokenRepository(ABC):
    """Abstract interface defining persistence operations for RefreshToken entities."""

    @abstractmethod
    async def save(self, token: RefreshToken) -> RefreshToken:
        pass

    @abstractmethod
    async def get_by_id(self, token_id: UUID) -> Optional[RefreshToken]:
        pass

    @abstractmethod
    async def get_by_hash(self, token_hash: str) -> Optional[RefreshToken]:
        pass

    @abstractmethod
    async def revoke(self, token_id: UUID, replaced_by: Optional[UUID] = None) -> None:
        pass

    @abstractmethod
    async def revoke_all_for_user(self, user_id: UUID) -> None:
        pass
