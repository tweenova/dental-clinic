# Marlow Dental — Backend API

> See ../AGENTS.md for the permanent, project-wide rules that apply here too — this file adds backend-specific detail on top of those, it does not replace them.

Production-ready FastAPI service handling appointment requests, authentication, and clinic CMS for Marlow Dental. Built strictly following Domain-Driven Design, the Repository Pattern, and permanent project engineering principles (KISS, YAGNI, DRY, SOLID, PHI-Safe Logging, and safe soft-deletes).

---

## 1. Architecture & Dependency Direction

The service enforces a strict one-way dependency rule:

```text
API (Routes, Dependencies & DTOs)
       ↓
Application Service
       ↓
Domain Repository (Abstract Protocol/ABC)
       ↓
PostgreSQL Repository (SQLAlchemy 2.0 Async + asyncpg)
       ↓
PostgreSQL Database ("dentai_dev")
```

- **Domain isolation**: The domain layer (`domain/models/`, `domain/repositories/`) consists of pure Python dataclasses and enums with zero imports of FastAPI or SQLAlchemy.
- **Relational schema**: Flat, constrained relational columns across `appointments`, `users`, `refresh_tokens`, `organizations`, `locations`, `team_members`, `services`, `faq_items`, and `site_sections`.
- **Soft Delete Policy**: CMS entities (team members, services, FAQs, site sections) are never hard-deleted via API calls. They utilize `is_active = false` soft-deletion toggles.
- **PHI-Safe Logging**: Patient name, telephone, email, symptoms/notes, and insurance providers are strictly excluded from logs, error payloads, and HTTP responses.
- **Authentication Security**: Short-lived JWT access tokens, long-lived refresh tokens stored as secure HttpOnly cookies, server-side persistence, rotation on each refresh, and instant revocation on logout.

---

## 2. Directory Structure

```text
backend/
├── app/
│   ├── main.py                     # FastAPI application factory, lifespan, CORS, rate limiting, static media mount
│   ├── cli.py                      # Safe CLI commands (database seeding, admin creation)
│   ├── core/
│   │   ├── config.py               # Pydantic BaseSettings (.env configuration & token secrets)
│   │   ├── database.py             # Async engine & session lifecycle (startup/shutdown)
│   │   ├── logging.py              # PHI-safe logger configuration (SQL echo disabled)
│   │   └── security.py             # Bcrypt hashing, PyJWT access tokens, refresh token hashing
│   ├── domain/
│   │   ├── models/                 # Pure domain entities (appointment, user, organization, team_member, service, cms)
│   │   ├── repositories/           # Abstract repository protocols (ABC interfaces)
│   │   └── services/               # Domain service interfaces (StorageService protocol)
│   ├── application/
│   │   ├── dtos/                   # Pydantic request/response validation schemas
│   │   └── services/               # Orchestration services (appointment, auth, team, service, cms, organization)
│   ├── infrastructure/
│   │   ├── database/
│   │   │   └── orm_models.py       # SQLAlchemy declarative ORM mappings & table constraints
│   │   ├── storage/
│   │   │   └── local_storage.py    # Local disk media storage implementation (5MB limit, MIME checks)
│   │   └── repositories/           # Concrete PostgreSQL repository implementations
│   └── api/
│       ├── deps.py                 # Dependency injection providers & require_admin auth guards
│       └── v1/
│           ├── router.py           # V1 endpoint aggregator
│           └── endpoints/
│               ├── health.py       # Health check
│               ├── appointments.py # Patient appointment booking
│               ├── auth.py         # Login, refresh, logout, me
│               ├── public_content.py # Dynamic site content, team, services, FAQs
│               ├── admin_cms.py    # Admin site section & FAQ editing
│               ├── admin_team.py   # Admin team member CRUD & active toggling
│               ├── admin_services.py # Admin services CRUD & active toggling
│               ├── admin_organization.py # Admin organization & location management
│               ├── admin_media.py  # Local media upload with validation
│               ├── reception.py    # Front-desk dashboard, schedule, bookings, patients, tasks, leads, messages, recalls
│               └── doctor.py       # Doctor schedule & clinical visit notes
├── alembic/
│   ├── versions/
│   │   ├── 0001_initial_appointments.py # Initial migration creating appointments table
│   │   ├── 0002_admin_auth_and_clinic_cms.py # Admin auth, CMS, team, services, locations
│   │   ├── 0003_sessions_inactivity.py # Server sessions, inactivity configs, rotation grace
│   │   └── d1f1356f1a35_organization_scaling_erd.py # Complete 25-table scaling ERD
│   ├── env.py                      # Async SQLAlchemy Alembic migration runner
│   └── script.py.mako
├── alembic.ini
├── tests/
│   ├── conftest.py                 # SQLite test client fixtures, mock session, reception & doctor auth
│   ├── test_health.py              # Health endpoint and DB degradation tests
│   ├── test_domain.py              # Domain entity & status transition tests
│   ├── test_repository.py          # Relational persistence & unique constraint tests
│   ├── test_postgres_integration.py # Real PostgreSQL connection & constraint verification
│   ├── test_service.py             # Service logic & collision retry tests
│   ├── test_appointments.py        # API contract, validation, CORS & PHI-logging tests
│   ├── test_auth.py                # Login, 7d tokens, 35m rotation, grace period, sessions, inactivity
│   ├── test_team.py                # Admin team CRUD and soft deletion tests
│   ├── test_services.py            # Admin services CRUD and soft deletion tests
│   ├── test_cms.py                 # CMS site sections and FAQ management tests
│   └── test_reception_and_roles.py # Reception dashboard, RBAC, deduplication, tasks, leads, doctor notes
├── .env.example
├── requirements.txt
└── README.md
```

---

## 3. PostgreSQL Database Setup

A running instance of **PostgreSQL 15+ (16 recommended)** is required for local backend development.

### Verifying PostgreSQL Installation
Check whether PostgreSQL tools are available in your path or running service:

```bash
# Check client version
psql --version

# On Windows PowerShell, check running service:
Get-Service *postgres*
```

### Creating the Local Development Database
Connect to PostgreSQL and create the dedicated development database:

```sql
CREATE DATABASE dentai_dev;
```
Or via CLI:
```bash
createdb -U postgres -h localhost dentai_dev
```

*Note: Never connect to or execute destructive statements (`DROP`, `TRUNCATE`, `DELETE`) against production databases. Development and test operations must always target `dentai_dev`.*

---

## 4. Environment Variables

Copy `.env.example` to `.env`:

```bash
cp .env.example .env
```

| Variable | Example Value | Purpose |
| :--- | :--- | :--- |
| `ENVIRONMENT` | `development` | Deployment environment name |
| `DEBUG` | `false` | Disables interactive debug docs in production |
| `APP_NAME` | `Marlow Dental API` | Service name |
| `API_V1_PREFIX` | `/api/v1` | URL prefix for V1 endpoints |
| `ALLOWED_ORIGINS` | `http://localhost:3000,http://127.0.0.1:3000` | Whitelisted CORS origins |
| `DATABASE_URL` | `postgresql+asyncpg://postgres:YOUR_PASSWORD@localhost:5432/dentai_dev` | PostgreSQL async connection string |
| `APPOINTMENTS_RATE_LIMIT` | `5/minute` | Rate limit threshold per IP |
| `JWT_SECRET_KEY` | `dev-jwt-secret-key-32-chars-minimum` | Secret key for signing JWT access tokens |
| `REFRESH_SECRET_KEY` | `dev-refresh-secret-key-32-chars-minimum` | Secret key for refresh token operations |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | `10080` | Lifetime of JWT access token (7 days) |
| `REFRESH_TOKEN_EXPIRE_DAYS` | `7` | Lifetime of refresh token (7 days) |
| `REFRESH_TOKEN_ROTATE_AFTER_MINUTES` | `35` | Silent rotation window threshold (35m) |
| `REFRESH_COOKIE_NAME` | `marlow_refresh_token` | Name of the HttpOnly refresh token cookie |
| `REFRESH_COOKIE_SECURE` | `false` | Set to true in production HTTPS |
| `CONCURRENCY_GRACE_PERIOD_SECONDS` | `30` | Grace period for rotated refresh tokens |
| `AUTH_LOGIN_RATE_LIMIT` | `5/minute` | Rate limit for /auth/login |
| `AUTH_REFRESH_RATE_LIMIT` | `30/minute` | Rate limit for /auth/refresh |
| `UPLOAD_DIR` | `uploads` | Local media storage directory |
| `MAX_UPLOAD_SIZE_BYTES` | `5242880` | Maximum media upload size (5MB) |

---

## 5. Setup & Running Locally

### Virtual Environment & Dependencies

```bash
# Using uv (recommended) or standard venv:
uv venv .venv --python python3.14
uv pip install -r requirements.txt
```

### Schema Migrations (Alembic)
Run migrations to create the schema and all tables:

```bash
# Apply pending migrations to reach head:
uv run alembic upgrade head

# Verify current revision:
uv run alembic current
```

### CLI Bootstrap Commands

To safely initialize the database with baseline clinic data and create an initial admin without hardcoding credentials:

```bash
# 1. Seed initial organization, location, core services, clinical director, and FAQs:
uv run python -m app.cli seed

# 2. Safely create or update an administrator account:
uv run python -m app.cli create-admin --email admin@marlowdental.com --password "YourSecurePassword" --name "Clinic Administrator"
```

### Running the API Server

```bash
# Start development server on port 8000
uv run uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

---

## 6. API Surface

### Authentication
- `POST /api/v1/auth/login`: Authenticates email + password; creates server-side session, returns 7-day JWT access token (in memory) and sets HttpOnly refresh cookie.
- `POST /api/v1/auth/refresh`: Evaluates 35-minute rotation window; rotates refresh token only if >= 35m, honors 30s concurrency grace period, and returns a fresh JWT access token.
- `POST /api/v1/auth/logout`: Revokes server-side session, marks refresh token revoked, and clears cookie.
- `GET  /api/v1/auth/me`: Validates session `sid` claim and returns profile of current authenticated user.
- `PATCH /api/v1/auth/inactivity-settings`: Updates user inactivity timeout and warning preferences.

### Public Content
- `GET /api/v1/public/content`: Consolidated dynamic CMS content for homepage, about, contact, footer, and SEO.
- `GET /api/v1/public/services`: Active clinic services and procedure catalog.
- `GET /api/v1/public/team`: Active team members, specialties, and doctor credentials.
- `GET /api/v1/public/faq`: Active clinic FAQ items.
- `GET /api/v1/public/locations`: Active clinic locations.
- `POST /api/v1/appointments`: Patient appointment request booking.

### Admin Management (Requires `admin` role)
- `GET /api/v1/admin/cms/sections`: Retrieve all site sections.
- `PUT /api/v1/admin/cms/sections/{section_key}`: Update structured section content.
- `GET /api/v1/admin/cms/faqs`: List all FAQ items (including inactive).
- `POST /api/v1/admin/cms/faqs`: Create a new FAQ item.
- `PUT /api/v1/admin/cms/faqs/{faq_id}`: Edit FAQ question, answer, order, or active state.
- `GET /api/v1/admin/services`: List all services (including inactive).
- `POST /api/v1/admin/services`: Create service.
- `PUT /api/v1/admin/services/{service_id}`: Update service metadata, pricing, or active state.
- `GET /api/v1/admin/team`: List all team members.
- `POST /api/v1/admin/team`: Create team member.
- `PUT /api/v1/admin/team/{member_id}`: Update biography, role, titles, license, or active state.
- `GET /api/v1/admin/organizations`: Retrieve organization data.
- `PUT /api/v1/admin/organizations/{org_id}`: Update organization details.
- `POST /api/v1/admin/media/upload`: Upload image/document to local storage.

---

## 7. Running Tests

Run the full pytest suite:

```bash
uv run pytest -v
```

All 32 automated tests verify:
- Health status and database degradation handling (2 tests)
- Domain status transitions and entities (2 tests)
- Relational schema persistence and unique constraints (2 tests)
- Real PostgreSQL async connectivity and integration (3 tests)
- Service ID generation and collision retry logic (2 tests)
- Appointment API contract, validation, CORS & PHI-logging (9 tests)
- JWT 7-day login, invalid passwords, unknown users, protected /me session validation, 35m rotation threshold, 30s concurrency grace period, session revocation on logout, and inactivity configuration updates (9 tests)
- Admin team member lifecycle & soft deletion (1 test)
- Admin services lifecycle & soft deletion (1 test)
- Admin CMS sections and FAQ lifecycle (1 test)
