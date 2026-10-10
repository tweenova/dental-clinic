from fastapi import APIRouter, Depends, HTTPException, Request, Response, status

from app.api.deps import get_auth_service, get_current_user
from app.application.dtos.auth_dto import (
    LoginRequest,
    LoginResponse,
    TokenRefreshRequest,
    TokenRefreshResponse,
    UpdateInactivitySettingsRequest,
    UserResponse,
)
from app.application.services.auth_service import AuthService
from app.core.config import settings
from app.core.limiter import limiter
from app.domain.models.user import User

router = APIRouter(prefix="/auth", tags=["Authentication"])


def _set_refresh_cookie(response: Response, refresh_token: str) -> None:
    response.set_cookie(
        key=settings.REFRESH_COOKIE_NAME,
        value=refresh_token,
        httponly=True,
        secure=settings.COOKIE_SECURE,
        samesite=settings.COOKIE_SAMESITE,
        max_age=settings.REFRESH_TOKEN_EXPIRE_DAYS * 86400,
        path="/",
        domain=settings.COOKIE_DOMAIN,
    )


def _clear_refresh_cookie(response: Response) -> None:
    response.delete_cookie(
        key=settings.REFRESH_COOKIE_NAME,
        path="/",
        domain=settings.COOKIE_DOMAIN,
        httponly=True,
        secure=settings.COOKIE_SECURE,
        samesite=settings.COOKIE_SAMESITE,
    )


def _map_user_response(user: User) -> UserResponse:
    return UserResponse(
        id=user.id,
        email=user.email,
        fullName=user.full_name,
        role=user.role.value,
        isActive=user.is_active,
        clinicId=user.clinic_id,
        teamMemberId=user.team_member_id,
        inactivityEnabled=user.inactivity_enabled,
        inactivityTimeoutMinutes=user.inactivity_timeout_minutes,
        inactivityWarningSeconds=user.inactivity_warning_seconds,
    )


@router.post("/login", response_model=LoginResponse)
@limiter.limit(settings.LOGIN_RATE_LIMIT)
async def login(
    request: Request,
    req: LoginRequest,
    response: Response,
    auth_service: AuthService = Depends(get_auth_service),
) -> LoginResponse:
    """
    Authenticates a user with email and password.
    Returns a 7-day JWT access token (with session claim) in response body,
    and sets a secure HTTP-only refresh token cookie.
    Protected by rate limiting against brute-force attacks.
    """
    client_ip = request.client.host if request.client else None
    user_agent = request.headers.get("user-agent")

    access_token, refresh_token, user = await auth_service.authenticate_user(
        email=req.email,
        password=req.password,
        ip_address=client_ip,
        user_agent=user_agent,
    )

    _set_refresh_cookie(response, refresh_token)

    return LoginResponse(
        accessToken=access_token,
        tokenType="Bearer",
        expiresInSeconds=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        user=_map_user_response(user),
    )


@router.post("/refresh", response_model=TokenRefreshResponse)
@limiter.limit(settings.REFRESH_RATE_LIMIT)
async def refresh_token(
    request: Request,
    response: Response,
    req_body: TokenRefreshRequest = TokenRefreshRequest(),
    auth_service: AuthService = Depends(get_auth_service),
) -> TokenRefreshResponse:
    """
    Refreshes the access token using the HTTP-only refresh cookie.
    If the refresh token is >= 35 minutes old, rotates it silently.
    If < 35 minutes old, reuses the valid token without creating unnecessary DB rows.
    Supports concurrency grace period to avoid session-nuking on race conditions.
    """
    token_str = request.cookies.get(settings.REFRESH_COOKIE_NAME) or req_body.refreshToken
    if not token_str:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Refresh token not found in cookies or request body.",
        )

    try:
        new_access_token, new_refresh_token, user, rotated = await auth_service.rotate_refresh_token(token_str)
    except HTTPException:
        _clear_refresh_cookie(response)
        raise

    if rotated:
        _set_refresh_cookie(response, new_refresh_token)

    return TokenRefreshResponse(
        accessToken=new_access_token,
        tokenType="Bearer",
        expiresInSeconds=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        rotated=rotated,
    )


@router.post("/logout")
async def logout(
    request: Request,
    response: Response,
    auth_service: AuthService = Depends(get_auth_service),
) -> dict:
    """
    Revokes the active refresh token and server-side session, and clears the HTTP-only cookie.
    """
    token_str = request.cookies.get(settings.REFRESH_COOKIE_NAME)
    if token_str:
        await auth_service.logout(token_str)

    _clear_refresh_cookie(response)
    return {"success": True, "message": "Successfully logged out."}


@router.get("/me", response_model=UserResponse)
async def get_current_user_profile(
    current_user: User = Depends(get_current_user),
) -> UserResponse:
    """
    Returns the authenticated user's profile, role, and inactivity preferences.
    Requires a valid JWT Bearer token with active server-side session.
    """
    return _map_user_response(current_user)


@router.patch("/inactivity-settings", response_model=UserResponse)
async def update_inactivity_settings(
    req: UpdateInactivitySettingsRequest,
    current_user: User = Depends(get_current_user),
    auth_service: AuthService = Depends(get_auth_service),
) -> UserResponse:
    """
    Updates the authenticated user's inactivity timeout and warning settings.
    """
    updated_user = await auth_service.update_inactivity_settings(
        user_id=current_user.id,
        enabled=req.inactivityEnabled,
        timeout_minutes=req.inactivityTimeoutMinutes,
        warning_seconds=req.inactivityWarningSeconds,
    )
    return _map_user_response(updated_user)
