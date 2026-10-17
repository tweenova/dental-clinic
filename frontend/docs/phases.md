# Implementation Phases — Marlow Dental Production Pass

## Execution Log & Verification

- [x] **Phase 1: Codebase Audit & Dependency Alignment**
  - Inspected all 11 source files across `src/app/` and `src/components/`.
  - Removed all 3D/WebGL artifacts (`three`, `@types/three`, and `src/components/3d`).
  - Installed single permitted motion library: `motion` (`motion/react` v12).
  - Eliminated all em-dashes from headings, body text, title tags, metadata, and comments.
  - Removed unverified "4.9 · 412 reviews" and invented testimonials.

- [x] **Phase 2: Design Tokens & Shared UI Primitives**
  - Updated `globals.css` with fluid typography (`.fluid-h1`, `.fluid-h2`), warm shadow scale (`shadow-subtle`, `shadow-card`, `shadow-elevated`), and integrated `sand` token.
  - Built `src/components/ui/button.tsx` preserving intentional pill shape (`rounded-full`) with hover lift and active press.
  - Built `src/components/ui/card.tsx` referencing `--radius-card` and warm shadow scale.
  - Built `src/components/ui/section-heading.tsx` consolidating eyebrow, heading, and description.
  - Built `src/components/ui/text-field.tsx` with programmatic label association, inline validation errors, and `aria-live="polite"`.
  - Built `src/components/ui/skeleton.tsx` for loading states.

- [x] **Phase 3: Motion System & 2D Depth**
  - Implemented 2D scroll-triggered reveals (`whileInView`) on home page sections.
  - Implemented staggered entry for objection items, service rows, and FAQs.
  - Implemented smooth CSS grid-based height transition (`grid-template-rows: 0fr -> 1fr`) for FAQ accordion.
  - Added CSS perspective tilt to hero credential card on pointer hover.
  - Configured full `prefers-reduced-motion: reduce` fallback across all animated elements.

- [x] **Phase 4: Production Readiness & Compliance Pages**
  - Implemented real dark mode toggle with persistent preference and system sync.
  - Built real structured compliance pages:
    - `/privacy` (labeled for legal review)
    - `/accessibility` (physical and digital accommodations)
    - `/terms` (labeled for legal review)
  - Added `error.tsx` (calm, non-alarming route error boundary) and `not-found.tsx` (custom 404).
  - Configured `robots.ts`, `sitemap.ts`, `manifest.ts`, and dynamic `opengraph-image.tsx`.
  - Added dedicated route metadata for `/book` via `src/app/book/layout.tsx`.
  - Added scroll progress, back-to-top, skip-to-content, floating contact dock, and cookie consent.

- [x] **Phase 5: Booking Wizard Rebuild (`/book`)**
  - Rebuilt `/book` with URL-synced step state (`?step=0|1|2|3`), preserving progress across refreshes and supporting browser back/forward buttons.
  - Replaced silent button disables with real-time inline validation triggered on field blur with `aria-live="polite"`.
  - Added floor `min` attribute on date input preventing selection of past dates.
  - Reused `<SiteHeader variant="minimal" />` instead of duplicating header markup.
  - Added step crossfade animation and restrained checkmark completion indicator.
  - Clearly commented submission handler as pending backend integration for `POST /api/appointments`.

- [x] **Phase 6: Backend Boundary Preparation (`src/lib/api.ts`)**
  - Centralized future `fetch` calls into `src/lib/api.ts`.
  - Clearly labeled mock datasets as mock arrays pending FastAPI + PostgreSQL endpoints.

- [x] **Phase 7: Documentation Synchronization**
  - Synchronized all six files in `docs/`: `prd.md`, `architecture.md`, `design.md`, `rules.md`, `phases.md`, `memory.md`.
  - Verified static generation build (`npm run build` succeeds with 14 static routes).

## Backend Milestones (PostgreSQL Edition)

- [x] **Phase 8: Backend Foundation & Infrastructure**
  - Scaffolded `backend/` application directory with exact mandated folder structure and `__init__.py` files.
  - Implemented `core/config.py` using `pydantic-settings` (.env management).
  - Implemented `core/database.py` with async SQLAlchemy 2.0 engine, scoped session factory, and database lifecycle management.
  - Implemented `core/logging.py` with PHI-safe logging (SQL parameter echoing disabled).
  - Exposed `GET /api/v1/health` with live database health check (returns 200 on connected, 503 degraded on disconnected).

- [x] **Phase 9: Domain, Schema & Persistence**
  - Implemented pure Python domain model `Appointment` and `AppointmentStatus` enum in `domain/models/` (zero SQLAlchemy imports).
  - Defined abstract `AppointmentRepository` protocol in `domain/repositories/`.
  - Implemented SQLAlchemy declarative model `AppointmentORM` with relational constraints and indexes in `infrastructure/database/orm_models.py`.
  - Configured async Alembic environment and created initial migration `0001_initial_appointments.py` with UUID PK, confirmation ID unique constraint, and composite status/date indexes.
  - Implemented `PostgresAppointmentRepository` with domain-to-ORM mapping and tested database-level unique constraint rejection.

- [x] **Phase 10: Application Service, API Endpoints & Security**
  - Implemented Pydantic DTOs `AppointmentCreateRequest` and `AppointmentCreateResponse` with field-level validators matching frontend constraints.
  - Built `AppointmentService` with `MD-YYYY-XXXX` confirmation ID generation and collision retry logic.
  - Exposed `POST /api/v1/appointments` with rate limiting (`slowapi`), CORS restrictions, and dependency injection.
  - Built and verified automated pytest suite (17/17 tests passing across health, domain, repository, service, API, CORS, rate limiting, and zero-PHI logging).
  - Generated `backend/.env.example` and comprehensive `backend/README.md`.

- [x] **Phase 11: Frontend Integration**
  - Configured `frontend/.env.example` documenting `NEXT_PUBLIC_API_URL=http://localhost:8000`.
  - Connected `/book` wizard directly to `POST /api/v1/appointments` via `submitBookingRequest` in `src/lib/api.ts`.
  - Replaced silent/fake confirmation fallback with defensive error state and accessible announcement banner (`role="alert"` and `aria-live="polite"`).
  - Verified Next.js Turbopack production build (`npm run build`) generates all 14 static routes without error.
  - Verified backend payload validation parity between Pydantic DTOs and Next.js form state.

- [x] **Phase 12: Admin Authentication, Server-Side Sessions & Inactivity Security**
  - Designed and executed Alembic migration `0003_sessions_inactivity.py` adding `user_sessions` relational table with `sid` verification, `inactivity_*` configuration fields on `users`, and concurrency tracking on `refresh_tokens`.
  - Upgraded authentication contract: 7-day memory-only JWT access tokens (10,080m) and 7-day HttpOnly refresh cookies (`marlow_refresh_token`, SameSite=Lax).
  - Implemented 35-minute rotation window (`REFRESH_TOKEN_ROTATE_AFTER_MINUTES=35`): requests prior to 35m reuse valid refresh tokens to prevent unnecessary churn.
  - Implemented 30-second backend concurrency grace period (`CONCURRENCY_GRACE_PERIOD_SECONDS=30`) protecting parallel browser tab requests from false replay-attack revocations.
  - Built frontend single-flight refresh lock (`isRefreshing`) and FIFO request replay queue (`failedQueue`) in `src/lib/api.ts`, replaying concurrent requests cleanly in order upon token refresh.
  - Built configurable inactivity logout architecture with countdown modal warning ("Stay Signed In"), tracking real user interaction (mouse, key, touch, scroll) while strictly excluding background network traffic.
  - Added shared rate limiting across auth endpoints (Login 5/min, Refresh 30/min) using `slowapi`.
  - Added Inactivity Security controls to `/admin/account` allowing administrators to toggle timeout duration (15m, 30m, 60m, 120m) and warning window.

- [x] **Phase 13: Dynamic Multi-Location & Multi-Doctor Public Architecture**
  - Built centralized `PublicContentProvider` resolving live organization identity, physical location offices, clinical staff directory, and structured CMS sections.
  - Fully eliminated hardcoded business information, phone numbers, addresses, office hours, and clinician names across all public components (`SiteHeader`, `Footer`, `MobileMenu`, `FloatingAction`, `Hero`, `Commitments`, `Visit`, `Doctor`, `FAQ`, `/book`, `search-index`, and compliance pages).
  - Replaced solo-dentist layout with scalable multi-doctor medical group presentation (`Doctor.tsx` rendering Clinical Director profile alongside multi-doctor clinical team roster).
  - Implemented multi-location selector tabs in `Visit.tsx` dynamically presenting address, phone, email, hours, and navigation maps per facility.
  - Built dynamic client search index transformation layer without stale hardcoded arrays.
  - Built reusable `LegalContactBox` across legal pages (`/privacy`, `/terms`, `/accessibility`, `404`, `500`) dynamically referencing clinic officer contacts.
  - Verified backend test suite with 32 passing automated tests (100% pass rate).
  - Verified frontend production build with 21 static and dynamic routes compiled without errors.

## Deferred Capabilities (Explicitly Not Built)

- [ ] **Phase 14: Clinical Operations & Integrations (Deferred)**
  - Patient portal, patient-facing login, medical intake forms, and electronic health records (EHR).
  - Appointment calendar scheduling and triage management dashboard.
  - Audit trail history and enterprise RBAC permissions UI.
  - Payment processing (Stripe / CareCredit).
  - Transactional SMS (Twilio) and confirmation emails.
  - Real-time operatory chair availability engine.
