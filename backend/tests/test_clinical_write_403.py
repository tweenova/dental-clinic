"""403 authorization matrix for clinical WRITE endpoints.

Covers every WRITE route in the nine clinical categories (notes, alerts,
consents, procedures, treatment plans, prescriptions, referrals,
attachments, clinical templates) plus the reception pending-alert capture.

For every (role, endpoint) pair:
  * role NOT in the effective allow-list  -> assert 403
  * role IN the allow-list (positive control) -> assert NOT 403
"""

import re
import uuid
from datetime import datetime, timedelta, timezone
from typing import Dict

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient

from app.core.database import get_db_session
from app.core.security import create_access_token, hash_password
from app.domain.models.user import User, UserSession, UserRole
from app.main import app

ALL_ROLES = list(UserRole)

DUMMY_ID = str(uuid.uuid4())
PASSWORD = "Pass1234!"
# bcrypt costs ~0.1-0.3s per hash (12 rounds): hashing a fresh password for
# every one of the 196 parametrized cases was the dominant runtime cost, so
# the hash is computed ONCE at module import and reused by every test user.
HASHED_PASSWORD = hash_password(PASSWORD)

# (method, path, effective allowed roles -- compared as role.value.lower())
CLINICAL_WRITES = [
    ("POST", "/attachments/upload", {"doctor", "receptionist"}),
    ("POST", "/attachments/{attachment_id}/void", {"doctor"}),
    ("POST", "/consents", {"doctor"}),
    ("POST", "/consents/{consent_id}/void", {"doctor"}),
    ("POST", "/clinical/alerts/{alert_id}/confirm", {"doctor"}),
    ("POST", "/clinical/alerts/{alert_id}/dismiss", {"doctor"}),
    ("POST", "/clinical/patients/{patient_id}/alerts", {"doctor"}),
    ("POST", "/clinical/patients/{patient_id}/alerts/review", {"doctor"}),
    ("PATCH", "/clinical/patients/{patient_id}/medical-history-status", {"doctor"}),
    ("PATCH", "/doctor/appointments/{id}/notes", {"doctor"}),
    ("POST", "/doctor/clinical-notes/{note_id}/apply-template", {"doctor"}),
    ("PATCH", "/doctor/chart/findings/{finding_id}", {"doctor"}),
    ("POST", "/doctor/chart/findings/{finding_id}/resolve", {"doctor"}),
    ("PATCH", "/doctor/chart/procedures/{procedure_id}/status", {"doctor"}),
    ("POST", "/doctor/encounters/{id}/chart/findings", {"doctor"}),
    ("POST", "/doctor/encounters/{id}/chart/procedures", {"doctor"}),
    ("POST", "/doctor/encounters/{id}/note/amend", {"doctor"}),
    ("PUT", "/doctor/encounters/{id}/note/draft", {"doctor"}),
    ("POST", "/doctor/encounters/{id}/note/sign", {"doctor"}),
    ("POST", "/doctor/documents/prescriptions", {"doctor"}),
    ("POST", "/doctor/documents/prescriptions/{prescription_id}/sign", {"doctor"}),
    ("POST", "/doctor/documents/referrals", {"doctor"}),
    ("POST", "/doctor/documents/referrals/{referral_id}/sign", {"doctor"}),
    ("POST", "/doctor/treatment-plans", {"doctor"}),
    ("PATCH", "/doctor/treatment-plans/{item_id}/status", {"doctor"}),
    ("POST", "/doctor/encounters", {"doctor"}),
    ("PATCH", "/doctor/encounters/{id}/status", {"doctor"}),
    ("POST", "/admin/note-templates", {"admin", "doctor"}),
    ("PUT", "/admin/note-templates/{template_id}", {"admin", "doctor"}),
    (
        "POST",
        "/reception/patients/{patient_id}/pending-alerts",
        {"receptionist", "clinic branch manager"},
    ),
]


@pytest_asyncio.fixture
async def matrix_client(test_session):
    """ASGI client with the DB overridden and server exceptions NOT raised,
    so positive-control requests on dummy IDs surface as HTTP responses."""

    async def override_get_db():
        yield test_session

    app.dependency_overrides[get_db_session] = override_get_db
    transport = ASGITransport(app=app, raise_app_exceptions=False)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        yield client
    app.dependency_overrides.pop(get_db_session, None)


async def _headers_for_role(session, role: UserRole) -> Dict[str, str]:
    """Create a user (or linked doctor) for this test's fresh in-memory DB and
    return Bearer headers.

    The access token is minted directly with the exact claims a real login
    issues (sub / role / sid), instead of POSTing /auth/login: the HTTP login
    performs a second bcrypt verification plus session & refresh-token
    revocation queries on every call, which dominated suite runtime.
    """
    from app.domain.models.team_member import TeamMember
    from app.infrastructure.repositories.postgres_team_repo import PostgresTeamMemberRepository
    from app.infrastructure.repositories.postgres_user_repo import (
        PostgresUserRepository,
        PostgresUserSessionRepository,
    )

    # Doctors need a linked clinical staff profile: several clinical handlers
    # fail closed (403 "not linked") for doctors without one, which would
    # mask the role-gate assertion this matrix is testing.
    team_member_id = None
    if role == UserRole.DOCTOR:
        tm = TeamMember(
            organization_id=uuid.uuid4(),
            first_name="Matrix",
            last_name="Doctor",
            display_name="Dr. Matrix403",
            role="Doctor",
            professional_title="Dental Surgeon",
            is_active=True,
        )
        team_member_id = (await PostgresTeamMemberRepository(session).save(tm)).id
        await session.commit()

    user = User(
        email=f"m403_{role.name.lower()}_{uuid.uuid4().hex[:6]}@marlowdental.com",
        hashed_password=HASHED_PASSWORD,
        full_name=f"Matrix {role.value}",
        role=role,
        team_member_id=team_member_id,
        is_active=True,
    )
    await PostgresUserRepository(session).save(user)
    await session.commit()

    session_row = UserSession(
        user_id=user.id,
        expires_at=datetime.now(timezone.utc) + timedelta(days=7),
    )
    await PostgresUserSessionRepository(session).save(session_row)
    await session.commit()

    token = create_access_token(
        subject=str(user.id),
        role=role.value,
        session_id=str(session_row.id),
    )
    return {"Authorization": f"Bearer {token}"}


def _endpoint_id(method: str, path: str) -> str:
    return ("%s-%s" % (method, path)).replace("{", "").replace("}", "")


@pytest.mark.asyncio
@pytest.mark.parametrize(
    "method,path,allowed",
    CLINICAL_WRITES,
    ids=[_endpoint_id(m, p) for m, p, _ in CLINICAL_WRITES],
)
@pytest.mark.parametrize(
    "role",
    ALL_ROLES,
    ids=[r.value.lower().replace(" ", "-") for r in ALL_ROLES],
)
async def test_clinical_write_403(role, method, path, allowed, test_session, matrix_client):
    headers = await _headers_for_role(test_session, role)
    url = "/api/v1" + re.sub(r"\{[^}]+\}", DUMMY_ID, path)

    kwargs = {"headers": headers}
    if (method, path) == ("POST", "/attachments/upload"):
        # Omit required form fields on purpose: allowed roles stop at 422
        # validation, denied roles must still be stopped by the role gate (403).
        kwargs["files"] = {"file": ("scan.pdf", b"%PDF-1.4 fake", "application/pdf")}
    else:
        kwargs["json"] = {}

    resp = await matrix_client.request(method, url, **kwargs)

    if role.value.lower() in allowed:
        assert resp.status_code != 403, (
            f"{role.value} should be allowed on {method} {path} but got 403: {resp.text}"
        )
    else:
        assert resp.status_code == 403, (
            f"{role.value} must get 403 on {method} {path} "
            f"(allowed={sorted(allowed)}), got {resp.status_code}: {resp.text}"
        )


@pytest.mark.asyncio
async def test_revoked_session_returns_401(test_session, matrix_client):
    """Verifies server-side session revocation: a valid JWT whose DB session is revoked yields 401."""
    from app.infrastructure.repositories.postgres_user_repo import (
        PostgresUserRepository,
        PostgresUserSessionRepository,
    )

    user = User(
        email=f"revoked_{uuid.uuid4().hex[:6]}@marlowdental.com",
        hashed_password=HASHED_PASSWORD,
        full_name="Revoked Doctor",
        role=UserRole.DOCTOR,
        is_active=True,
    )
    await PostgresUserRepository(test_session).save(user)
    await test_session.commit()

    session_row = UserSession(
        user_id=user.id,
        expires_at=datetime.now(timezone.utc) + timedelta(days=7),
        is_active=False,
        revoked_at=datetime.now(timezone.utc),
    )
    await PostgresUserSessionRepository(test_session).save(session_row)
    await test_session.commit()

    token = create_access_token(
        subject=str(user.id),
        role=user.role.value,
        session_id=str(session_row.id),
    )
    headers = {"Authorization": f"Bearer {token}"}

    resp = await matrix_client.get("/api/v1/auth/me", headers=headers)
    assert resp.status_code == 401
    assert "revoked or expired" in resp.json()["detail"]

