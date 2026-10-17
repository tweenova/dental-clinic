import pytest
from app.core.config import Settings


def test_settings_debug_tolerant_of_non_boolean_values():
    # Non-boolean strings such as "release", "prod", "production" should not crash and should parse to False
    s_release = Settings(DEBUG="release")
    assert s_release.DEBUG is False

    s_prod = Settings(DEBUG="prod")
    assert s_prod.DEBUG is False

    s_unknown = Settings(DEBUG="something_random")
    assert s_unknown.DEBUG is False

    # Boolean and recognized truthy strings should parse to True
    s_true = Settings(DEBUG="true")
    assert s_true.DEBUG is True

    s_one = Settings(DEBUG="1")
    assert s_one.DEBUG is True

    s_dev = Settings(DEBUG="dev")
    assert s_dev.DEBUG is True

    # Falsy values
    s_false = Settings(DEBUG="false")
    assert s_false.DEBUG is False

    s_zero = Settings(DEBUG="0")
    assert s_zero.DEBUG is False


def test_production_refuses_default_jwt_secret():
    # Production with default dev secret must raise ValueError
    with pytest.raises(ValueError, match="Production startup refused"):
        Settings(
            ENVIRONMENT="production",
            JWT_SECRET_KEY="dev-marlow-dental-insecure-secret-key-change-in-production-2026",
        )

    # Production with robust custom secret succeeds
    valid_prod = Settings(
        ENVIRONMENT="production",
        JWT_SECRET_KEY="super-secret-random-hex-production-key-at-least-32-chars-long",
    )
    assert valid_prod.ENVIRONMENT == "production"

