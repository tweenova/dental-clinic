from datetime import datetime, timezone
from typing import Optional
from uuid import UUID

from sqlalchemy import delete, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.domain.models.user import RefreshToken, User, UserRole, UserSession
from app.domain.repositories.user_repo import RefreshTokenRepository, UserRepository, UserSessionRepository
from app.infrastructure.database.orm_models import RefreshTokenORM, UserORM, UserSessionORM


class PostgresUserRepository(UserRepository):
    """PostgreSQL implementation of the UserRepository abstraction."""

    def __init__(self, session: AsyncSession):
        self._session = session

    @staticmethod
    def _to_domain(orm: UserORM) -> User:
        raw_role = (orm.role or "admin").strip().lower()
        role_map = {
            "admin": UserRole.ADMIN,
            "receptionist": UserRole.RECEPTIONIST,
            "doctor": UserRole.DOCTOR,
            "patient": UserRole.PATIENT,
            "platform owner": UserRole.PLATFORM_OWNER,
            "super admin": UserRole.SUPER_ADMIN,
            "clinic branch manager": UserRole.CLINIC_BRANCH_MANAGER,
        }
        role = role_map.get(raw_role, UserRole.ADMIN)
        return User(
            id=orm.id,
            email=orm.email,
            hashed_password=orm.hashed_password,
            full_name=orm.full_name,
            role=role,
            is_active=orm.is_active,
            clinic_id=orm.clinic_id if hasattr(orm, "clinic_id") else None,
            inactivity_enabled=orm.inactivity_enabled,
            inactivity_timeout_minutes=orm.inactivity_timeout_minutes,
            inactivity_warning_seconds=orm.inactivity_warning_seconds,
            created_at=orm.created_at,
            updated_at=orm.updated_at,
        )

    @staticmethod
    def _to_orm(domain: User) -> UserORM:
        return UserORM(
            id=domain.id,
            email=domain.email,
            hashed_password=domain.hashed_password,
            full_name=domain.full_name,
            role=domain.role.value,
            is_active=domain.is_active,
            inactivity_enabled=domain.inactivity_enabled,
            inactivity_timeout_minutes=domain.inactivity_timeout_minutes,
            inactivity_warning_seconds=domain.inactivity_warning_seconds,
            created_at=domain.created_at,
            updated_at=domain.updated_at,
        )

    async def get_by_id(self, user_id: UUID) -> Optional[User]:
        stmt = select(UserORM).where(UserORM.id == user_id)
        result = await self._session.execute(stmt)
        orm = result.scalar_one_or_none()
        return self._to_domain(orm) if orm else None

    async def get_by_email(self, email: str) -> Optional[User]:
        stmt = select(UserORM).where(UserORM.email == email.strip().lower())
        result = await self._session.execute(stmt)
        orm = result.scalar_one_or_none()
        return self._to_domain(orm) if orm else None

    async def save(self, user: User) -> User:
        existing = await self._session.get(UserORM, user.id)
        if existing:
            existing.email = user.email.strip().lower()
            existing.hashed_password = user.hashed_password
            existing.full_name = user.full_name
            existing.role = user.role.value
            existing.is_active = user.is_active
            existing.inactivity_enabled = user.inactivity_enabled
            existing.inactivity_timeout_minutes = user.inactivity_timeout_minutes
            existing.inactivity_warning_seconds = user.inactivity_warning_seconds
            existing.updated_at = datetime.now(timezone.utc)
            await self._session.flush()
            return self._to_domain(existing)
        else:
            orm = self._to_orm(user)
            self._session.add(orm)
            await self._session.flush()
            return self._to_domain(orm)

    async def update_inactivity_settings(
        self,
        user_id: UUID,
        inactivity_enabled: bool,
        inactivity_timeout_minutes: int,
        inactivity_warning_seconds: int,
    ) -> Optional[User]:
        existing = await self._session.get(UserORM, user_id)
        if not existing:
            return None
        existing.inactivity_enabled = inactivity_enabled
        existing.inactivity_timeout_minutes = inactivity_timeout_minutes
        existing.inactivity_warning_seconds = inactivity_warning_seconds
        existing.updated_at = datetime.now(timezone.utc)
        await self._session.flush()
        return self._to_domain(existing)


class PostgresUserSessionRepository(UserSessionRepository):
    """PostgreSQL implementation of the UserSessionRepository abstraction."""

    def __init__(self, session: AsyncSession):
        self._session = session

    @staticmethod
    def _to_domain(orm: UserSessionORM) -> UserSession:
        return UserSession(
            id=orm.id,
            user_id=orm.user_id,
            expires_at=orm.expires_at,
            is_active=orm.is_active,
            ip_address=orm.ip_address,
            user_agent=orm.user_agent,
            created_at=orm.created_at,
            revoked_at=orm.revoked_at,
        )

    async def save(self, session: UserSession) -> UserSession:
        orm = UserSessionORM(
            id=session.id,
            user_id=session.user_id,
            expires_at=session.expires_at,
            is_active=session.is_active,
            ip_address=session.ip_address,
            user_agent=session.user_agent,
            created_at=session.created_at,
            revoked_at=session.revoked_at,
        )
        self._session.add(orm)
        await self._session.flush()
        return self._to_domain(orm)

    async def get_by_id(self, session_id: UUID) -> Optional[UserSession]:
        stmt = select(UserSessionORM).where(UserSessionORM.id == session_id)
        result = await self._session.execute(stmt)
        orm = result.scalar_one_or_none()
        return self._to_domain(orm) if orm else None

    async def revoke(self, session_id: UUID) -> None:
        stmt = (
            update(UserSessionORM)
            .where(UserSessionORM.id == session_id)
            .values(is_active=False, revoked_at=datetime.now(timezone.utc))
        )
        await self._session.execute(stmt)
        await self._session.flush()

    async def revoke_all_for_user(self, user_id: UUID) -> None:
        stmt = (
            update(UserSessionORM)
            .where(UserSessionORM.user_id == user_id)
            .values(is_active=False, revoked_at=datetime.now(timezone.utc))
        )
        await self._session.execute(stmt)
        await self._session.flush()


class PostgresRefreshTokenRepository(RefreshTokenRepository):
    """PostgreSQL implementation of the RefreshTokenRepository abstraction."""

    def __init__(self, session: AsyncSession):
        self._session = session

    @staticmethod
    def _to_domain(orm: RefreshTokenORM) -> RefreshToken:
        return RefreshToken(
            id=orm.id,
            user_id=orm.user_id,
            token_hash=orm.token_hash,
            expires_at=orm.expires_at,
            session_id=orm.session_id,
            is_revoked=orm.is_revoked,
            replaced_by=orm.replaced_by,
            created_at=orm.created_at,
            revoked_at=orm.revoked_at,
        )

    async def save(self, token: RefreshToken) -> RefreshToken:
        orm = RefreshTokenORM(
            id=token.id,
            user_id=token.user_id,
            session_id=token.session_id,
            token_hash=token.token_hash,
            expires_at=token.expires_at,
            is_revoked=token.is_revoked,
            replaced_by=token.replaced_by,
            created_at=token.created_at,
            revoked_at=token.revoked_at,
        )
        self._session.add(orm)
        await self._session.flush()
        return self._to_domain(orm)

    async def get_by_id(self, token_id: UUID) -> Optional[RefreshToken]:
        stmt = select(RefreshTokenORM).where(RefreshTokenORM.id == token_id)
        result = await self._session.execute(stmt)
        orm = result.scalar_one_or_none()
        return self._to_domain(orm) if orm else None

    async def get_by_hash(self, token_hash: str) -> Optional[RefreshToken]:
        stmt = select(RefreshTokenORM).where(RefreshTokenORM.token_hash == token_hash)
        result = await self._session.execute(stmt)
        orm = result.scalar_one_or_none()
        return self._to_domain(orm) if orm else None

    async def revoke(self, token_id: UUID, replaced_by: Optional[UUID] = None) -> None:
        stmt = (
            update(RefreshTokenORM)
            .where(RefreshTokenORM.id == token_id)
            .values(
                is_revoked=True,
                replaced_by=replaced_by,
                revoked_at=datetime.now(timezone.utc),
            )
        )
        await self._session.execute(stmt)
        await self._session.flush()

    async def revoke_all_for_user(self, user_id: UUID) -> None:
        stmt = (
            update(RefreshTokenORM)
            .where(RefreshTokenORM.user_id == user_id)
            .values(is_revoked=True, revoked_at=datetime.now(timezone.utc))
        )
        await self._session.execute(stmt)
        await self._session.flush()
