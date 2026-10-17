from datetime import datetime, timedelta, timezone
import hashlib
import secrets
from typing import Any, Dict, Optional
import bcrypt
import jwt

from app.core.config import settings


def validate_password_strength(password: str) -> None:
    """
    Enforces minimum password security policy:
    - At least 8 characters
    - At least one uppercase character
    - At least one lowercase character
    - At least one number
    """
    if len(password) < 8:
        raise ValueError("Password must be at least 8 characters long.")
    if not any(c.isupper() for c in password):
        raise ValueError("Password must contain at least one uppercase letter.")
    if not any(c.islower() for c in password):
        raise ValueError("Password must contain at least one lowercase letter.")
    if not any(c.isdigit() for c in password):
        raise ValueError("Password must contain at least one digit.")


def hash_password(password: str) -> str:
    """Hashes a plaintext password using bcrypt with random salt."""
    salt = bcrypt.gensalt()
    return bcrypt.hashpw(password.encode("utf-8"), salt).decode("utf-8")


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verifies a plaintext password against a stored bcrypt hash."""
    try:
        return bcrypt.checkpw(
            plain_password.encode("utf-8"),
            hashed_password.encode("utf-8"),
        )
    except Exception:
        return False


def create_access_token(
    subject: str,
    role: str,
    session_id: Optional[str] = None,
    expires_delta: Optional[timedelta] = None,
) -> str:
    """
    Creates a signed JWT access token containing subject, role, and session_id (sid).
    No sensitive PHI or passwords are ever placed in the payload.
    """
    now = datetime.now(timezone.utc)
    if expires_delta:
        expire = now + expires_delta
    else:
        expire = now + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)

    payload: Dict[str, Any] = {
        "sub": subject,
        "role": role,
        "iat": now,
        "exp": expire,
        "type": "access",
    }
    if session_id:
        payload["sid"] = session_id

    return jwt.encode(payload, settings.JWT_SECRET_KEY, algorithm=settings.JWT_ALGORITHM)


def decode_access_token(token: str) -> Optional[Dict[str, Any]]:
    """
    Decodes and validates a JWT access token.
    Returns the payload dictionary or None if invalid or expired.
    """
    try:
        payload = jwt.decode(
            token,
            settings.JWT_SECRET_KEY,
            algorithms=[settings.JWT_ALGORITHM],
        )
        if payload.get("type") != "access":
            return None
        return payload
    except (jwt.PyJWTError, Exception):
        return None


def generate_refresh_token() -> str:
    """Generates an opaque, cryptographically secure refresh token."""
    return secrets.token_urlsafe(64)


def hash_refresh_token(token: str) -> str:
    """Hashes a refresh token with SHA-256 for secure database lookup."""
    return hashlib.sha256(token.encode("utf-8")).hexdigest()
