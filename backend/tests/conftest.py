import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.core.database import get_db_session
from app.core.security import hash_password
from app.domain.models.user import User, UserRole
from app.infrastructure.database.orm_models import Base
from app.infrastructure.repositories.postgres_user_repo import PostgresUserRepository
from app.main import app, limiter

# Disable rate limiting in test suite so fast sequential tests aren't blocked by 429
limiter.enabled = False


@pytest.fixture(scope="session")
def anyio_backend():
    return "asyncio"


@pytest_asyncio.fixture
async def async_client():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        yield client


@pytest_asyncio.fixture
async def test_session():
    """Provides an isolated in-memory SQLite session with all tables initialized."""
    engine = create_async_engine("sqlite+aiosqlite:///:memory:", echo=False)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    session_factory = async_sessionmaker(bind=engine, class_=AsyncSession, expire_on_commit=False)
    async with session_factory() as session:
        yield session

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
    await engine.dispose()


@pytest_asyncio.fixture
async def client_with_db(test_session: AsyncSession):
    """An AsyncClient with the database dependency overridden to point to test_session."""
    async def override_get_db():
        yield test_session

    app.dependency_overrides[get_db_session] = override_get_db
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        yield client
    app.dependency_overrides.pop(get_db_session, None)


@pytest_asyncio.fixture
async def admin_auth(test_session: AsyncSession, client_with_db: AsyncClient):
    """Creates a test admin user and logs in, returning auth headers and client."""
    user_repo = PostgresUserRepository(test_session)
    admin_user = User(
        email="testadmin@marlowdental.com",
        hashed_password=hash_password("AdminTest123!"),
        full_name="Test Administrator",
        role=UserRole.ADMIN,
        is_active=True,
    )
    await user_repo.save(admin_user)
    await test_session.commit()

    resp = await client_with_db.post(
        "/api/v1/auth/login",
        json={"email": "testadmin@marlowdental.com", "password": "AdminTest123!"},
    )
    assert resp.status_code == 200
    token = resp.json()["accessToken"]
    headers = {"Authorization": f"Bearer {token}"}
    return {
        "headers": headers,
        "token": token,
        "client": client_with_db,
        "user": admin_user,
        "cookies": resp.cookies,
    }


@pytest_asyncio.fixture
async def receptionist_auth(test_session: AsyncSession, client_with_db: AsyncClient):
    """Creates a test receptionist user and logs in, returning auth headers and client."""
    user_repo = PostgresUserRepository(test_session)
    rec_user = User(
        email="testreceptionist@marlowdental.com",
        hashed_password=hash_password("Receptionist123!"),
        full_name="Test Receptionist",
        role=UserRole.RECEPTIONIST,
        is_active=True,
    )
    await user_repo.save(rec_user)
    await test_session.commit()

    resp = await client_with_db.post(
        "/api/v1/auth/login",
        json={"email": "testreceptionist@marlowdental.com", "password": "Receptionist123!"},
    )
    assert resp.status_code == 200
    token = resp.json()["accessToken"]
    headers = {"Authorization": f"Bearer {token}"}
    return {
        "headers": headers,
        "token": token,
        "client": client_with_db,
        "user": rec_user,
        "cookies": resp.cookies,
    }


@pytest_asyncio.fixture
async def doctor_auth(test_session: AsyncSession, client_with_db: AsyncClient):
    """Creates a test doctor user and logs in, returning auth headers and client."""
    user_repo = PostgresUserRepository(test_session)
    doc_user = User(
        email="testdoctor@marlowdental.com",
        hashed_password=hash_password("DoctorTest123!"),
        full_name="Test Doctor",
        role=UserRole.DOCTOR,
        is_active=True,
    )
    await user_repo.save(doc_user)
    await test_session.commit()

    resp = await client_with_db.post(
        "/api/v1/auth/login",
        json={"email": "testdoctor@marlowdental.com", "password": "DoctorTest123!"},
    )
    assert resp.status_code == 200
    token = resp.json()["accessToken"]
    headers = {"Authorization": f"Bearer {token}"}
    return {
        "headers": headers,
        "token": token,
        "client": client_with_db,
        "user": doc_user,
        "cookies": resp.cookies,
    }
