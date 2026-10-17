import sys
from contextlib import asynccontextmanager
from pathlib import Path

# Ensure project root is on sys.path when executed directly (e.g. python app/main.py)
_BACKEND_ROOT = str(Path(__file__).resolve().parent.parent)
if _BACKEND_ROOT not in sys.path:
    sys.path.insert(0, _BACKEND_ROOT)

from fastapi import FastAPI, HTTPException, Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from starlette.exceptions import HTTPException as StarletteHTTPException

from app.core.config import settings
import asyncio
from app.core.database import init_db, close_db, get_session_factory
from app.core.limiter import limiter
from app.core.logging import logger
from app.api.v1.router import api_v1_router
from app.api.v1.endpoints.health import health_check


@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Manages the lifecycle of the web server from startup to shutdown.

    When the application starts, it logs a startup message, prepares the database
    connection pool, and optionally launches the background reminder scheduler.
    When the application stops, it cleanly closes all open database connections.
    """
    # Startup
    logger.info("Starting up %s in %s environment", settings.APP_NAME, settings.ENVIRONMENT)
    upload_path = Path(settings.UPLOAD_DIR).resolve()
    upload_path.mkdir(parents=True, exist_ok=True)
    await init_db()

    scheduler_task = None
    if getattr(settings, "SCHEDULER_ENABLED", False):
        async def reminder_scheduler_loop():
            logger.info("Starting background reminder scheduler loop (interval=%ds)", settings.SCHEDULER_INTERVAL_SECONDS)
            from app.infrastructure.repositories.postgres_booking_repo import PostgresBookingRepository
            from app.infrastructure.repositories.postgres_patient_repo import PostgresPatientRepository
            from app.infrastructure.repositories.postgres_task_repo import PostgresTaskRepository
            from app.infrastructure.repositories.postgres_lead_repo import PostgresLeadRepository
            from app.infrastructure.repositories.postgres_message_repo import PostgresMessageRepository
            from app.infrastructure.repositories.postgres_appointment_repo import PostgresAppointmentRepository
            from app.infrastructure.repositories.postgres_booking_settings_repo import PostgresBookingSettingsRepository
            from app.application.services.reception_service import ReceptionService

            while True:
                try:
                    await asyncio.sleep(settings.SCHEDULER_INTERVAL_SECONDS)
                    session_factory = get_session_factory()
                    async with session_factory() as session:
                        service = ReceptionService(
                            booking_repo=PostgresBookingRepository(session),
                            patient_repo=PostgresPatientRepository(session),
                            task_repo=PostgresTaskRepository(session),
                            lead_repo=PostgresLeadRepository(session),
                            message_repo=PostgresMessageRepository(session),
                            appointment_repo=PostgresAppointmentRepository(session),
                            booking_settings_repo=PostgresBookingSettingsRepository(session),
                        )
                        res = await service.dispatch_due_reminders()
                        await session.commit()
                        if res.get("dispatchedCount", 0) > 0:
                            logger.info("Scheduler dispatched %d reminders", res["dispatchedCount"])
                except asyncio.CancelledError:
                    break
                except Exception as e:
                    logger.warning("Error in background reminder scheduler loop: %s", str(e))

        scheduler_task = asyncio.create_task(reminder_scheduler_loop())

    yield

    # Shutdown
    if scheduler_task:
        scheduler_task.cancel()
        try:
            await scheduler_task
        except asyncio.CancelledError:
            pass

    logger.info("Shutting down %s", settings.APP_NAME)
    await close_db()


app = FastAPI(
    title=settings.APP_NAME,
    lifespan=lifespan,
    docs_url="/docs" if settings.DEBUG else None,
    redoc_url=None,
)

# Attach rate limiter to app state
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# CORS Configuration: strictly allow configured origins with full HTTP method support
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["*"],
)


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    """
    Catches any unexpected errors that occur while processing an incoming web request.
    Preserves HTTPException and RequestValidationError while masking unhandled crashes.
    """
    if isinstance(exc, (HTTPException, StarletteHTTPException, RequestValidationError)):
        raise exc

    logger.error("Unhandled exception processing request: %s", request.url.path)
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={"detail": "An unexpected error occurred. Please try again or contact the clinic."},
    )


# Mount static uploads directory for local development
upload_dir_path = Path(settings.UPLOAD_DIR).resolve()
upload_dir_path.mkdir(parents=True, exist_ok=True)
app.mount("/media", StaticFiles(directory=str(upload_dir_path)), name="media")

# Mount API V1 routes
app.include_router(api_v1_router, prefix=settings.API_V1_PREFIX)

# Root health check alias
app.add_api_route("/health", health_check, methods=["GET"], tags=["Health"], summary="Root Health Check")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host="127.0.0.1", port=8000, reload=True)

