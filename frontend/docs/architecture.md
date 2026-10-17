# Technical Architecture — Marlow Dental

## 1. Core Framework & Build
- **Framework**: Next.js 16.3 (App Router, Webpack/Turbopack, React 19.2)
- **Styling**: Tailwind CSS v4 with custom CSS custom properties in `src/app/globals.css`
- **Motion Library**: `motion` (`motion/react` v12) for 2D scroll-triggered reveals, staggered entries, and layout transitions
- **Icons**: `lucide-react`
- **Typography**: Google Fonts via `next/font/google` loading Fraunces (display serif) and Manrope (interface sans)

## 2. Directory Structure

```text
dental-clinic-project/
├── AGENTS.md                     # Global rules binding frontend & backend
├── README.md                     # Monorepo overview and quickstart
├── frontend/                     # Next.js 16 App Router application
│   ├── src/
│   │   ├── app/
│   │   │   ├── layout.tsx        # Root layout with fonts, AuthProvider, ThemeProvider, JSON-LD
│   │   │   ├── page.tsx          # Home page assembling dynamic marketing sections
│   │   │   ├── globals.css       # Design tokens, fluid type scale, warm shadow scale
│   │   │   ├── icon.svg          # SVG brand mark
│   │   │   ├── opengraph-image.tsx # Dynamic OG image generation
│   │   │   ├── robots.ts         # Robots.txt metadata route
│   │   │   ├── sitemap.ts        # Sitemap.xml metadata route
│   │   │   ├── manifest.ts       # Web application manifest
│   │   │   ├── error.tsx         # Route-level error boundary
│   │   │   ├── not-found.tsx     # Custom art-directed 404 page
│   │   │   ├── login/
│   │   │   │   └── page.tsx      # Secure staff / admin login screen
│   │   │   ├── admin/
│   │   │   │   ├── layout.tsx    # Admin shell with navigation & auth route guard
│   │   │   │   ├── page.tsx      # Overview dashboard
│   │   │   │   ├── website/page.tsx # Website CMS editor (General, Homepage, About, Contact, FAQ, SEO)
│   │   │   │   ├── team/page.tsx # Team members CRUD, credentials & soft deletion
│   │   │   │   ├── services/page.tsx # Service catalog CRUD & soft deletion
│   │   │   │   ├── locations/page.tsx # Multi-location overview shell
│   │   │   │   └── account/page.tsx # Admin profile and sign-out
│   │   │   ├── book/
│   │   │   │   ├── layout.tsx    # Dedicated metadata for booking route
│   │   │   │   └── page.tsx      # URL-synced multi-step booking wizard (dynamic services)
│   │   │   ├── privacy/page.tsx  # Privacy policy
│   │   │   ├── accessibility/page.tsx # Physical & digital accessibility statement
│   │   │   └── terms/page.tsx    # Terms of service & cancellation rules
│   │   ├── components/
│   │   │   ├── ui/               # Shared UI Primitives (Button, Card, TextField, etc.)
│   │   │   ├── layout/           # Global Shell Components (SiteHeader, Footer, MobileMenu)
│   │   │   ├── sections/         # Home Page Content Sections (Hero, Doctor, Services, Visit, FAQ)
│   │   │   └── providers/
│   │   │       ├── auth-provider.tsx # Session state, JWT storage, refresh rotation, login/logout
│   │   │       └── theme-provider.tsx # Theme context and localStorage persistence
│   │   └── lib/
│   │       ├── api.ts            # Single API boundary for FastAPI backend (auth, appointments, CMS)
│   │       ├── search-index.ts   # Client search index over actual static content
│   │       ├── utm.ts            # UTM parameter preservation utility
│   │       └── utils.ts          # Shared styling (cn) and local timezone calculator
│   └── docs/                     # Frontend architectural documentation
└── backend/                      # Backend application (FastAPI + PostgreSQL)
    ├── alembic/                  # Database migration scripts & env.py
    │   └── versions/
    │       ├── 0001_initial_appointments.py
    │       └── 0002_admin_auth_and_clinic_cms.py
    ├── app/                      # Application layered architecture
    │   ├── api/v1/               # FastAPI endpoints & route definitions
    │   ├── application/          # Service layer, DTOs & business workflows
    │   ├── core/                 # Config, DB engine, logging, security
    │   ├── domain/               # Pure business models & repository protocols
    │   └── infrastructure/       # SQLAlchemy models, storage, & repository implementations
    ├── tests/                    # Pytest test suite (29 passing unit/integration tests)
    └── README.md                 # Setup, local run, and CLI instructions
```

## 3. Authentication & Authorization Architecture

- **Token Strategy**:
  - **7-Day Access Token (In-Memory)**: JSON Web Token (JWT) with HS256 signature containing user ID, subject (email), role (`admin`), server session ID (`sid`), and 7-day expiration (10,080 minutes). Kept exclusively in-memory within React `AuthProvider` state (`src/lib/api.ts`). Never stored in `localStorage`, `sessionStorage`, cookies, or URLs.
  - **7-Day Refresh Token (HttpOnly Cookie)**: 256-bit cryptographically secure token string (`secrets.token_urlsafe(32)`), stored as a strict `HttpOnly`, `SameSite=Lax` cookie (`marlow_refresh_token`). Configurable via `settings.REFRESH_COOKIE_NAME`.
  - **Server-Side Session Tracking**: Every login generates an active record in `user_sessions` with IP, user agent, expiration, and active status. On every authenticated request, `get_current_user` validates that the `sid` claim in the JWT corresponds to an active database session. Instant session revocation occurs on logout or security invalidation.
  - **35-Minute Rotation Window**: `REFRESH_TOKEN_ROTATE_AFTER_MINUTES = 35`. Refresh requests within 35 minutes re-issue fresh access tokens while keeping the existing refresh cookie, avoiding high row churn. After 35 minutes, a new refresh token is generated, hashed, and swapped.
  - **Concurrency & Replay Safety**:
    - *Backend Grace Period*: A 30-second window (`CONCURRENCY_GRACE_PERIOD_SECONDS = 30`) allows concurrent requests carrying a just-rotated refresh token to succeed rather than triggering false replay-attack revocations.
    - *Frontend Single-Flight Lock*: `isRefreshing` prevents parallel refresh calls from frontend tabs/components.
    - *FIFO Request Replay Queue*: When multiple API calls encounter an expired access token, the first triggers `/api/v1/auth/refresh` while subsequent requests enqueue in `failedQueue`. Upon refresh success, queued requests replay in original FIFO order with the new access token.
  - **Inactivity Security Architecture**:
    - User activity tracking in `AuthProvider` monitors direct browser interactions (`mousemove`, `keydown`, `touchstart`, `scroll`, `click`) throttled to 3-second checks. Background network traffic does NOT reset inactivity.
    - Configurable settings on user account (`inactivity_enabled`, `inactivity_timeout_minutes`, `inactivity_warning_seconds`).
    - Accessible countdown warning modal ("Stay Signed In") provides affirmative extension or auto-logout upon timer expiry.
  - **Rate Limiting**:
    - Login: 5 requests/minute/IP.
    - Refresh: 30 requests/minute/IP.

## 4. Clinic Content Management (CMS) & Dynamic Organization Foundation

- **Organization & Locations**:
  - Hierarchy: `Organization` (Marlow Dental Medical Complex) -> `Locations` (Lincoln Park clinic, Oak Brook center, expandable) -> `TeamMembers`.
  - `PublicContentProvider` acts as the single frontend boundary, hydrating organization identity, locations, and clinical staff directory once and distributing to presentational components.
- **Data-Driven Team Roles**:
  - Unified `TeamMember` model stores roles and titles (`Director`, `Dentist`, `Orthodontist`, `Pediatric Specialist`, `Hygienist`, `Oral Surgeon`).
  - The public website dynamically identifies the Clinical Director through role/title criteria rather than hardcoded string comparisons (e.g. `is_director` or role matching `Director`), allowing immediate updates when staff change.
- **Soft Deletion Policy**:
  - CMS entities (`TeamMember`, `Service`, `FaqItem`, `Location`, `SiteSection`) are never hard-deleted via API calls. Soft-deletion toggles `is_active = false`.
  - Public endpoints (`/api/v1/public/*`) strictly filter `WHERE is_active = true`.

## 5. Media Storage Abstraction

- **Interface**: Abstract `StorageService` domain protocol (`upload_file`, `delete_file`, `get_url`).
- **Development Implementation**: `LocalStorageService` saving files to `uploads/` directory, validating file sizes (capped at 5MB) and permitted MIME types (`image/jpeg`, `image/png`, `image/webp`).
- **Static File Serving**: Mounted at `/media` in FastAPI for local development, with paths stored as relative URLs ready for zero-downtime swap to AWS S3 or Cloudinary.

## 6. PostgreSQL Relational Schema

### Database Migrations
1. `0001_initial_appointments.py`: Created `appointments` table with UUID primary key, unique confirmation ID, and composite status/date indexes.
2. `0002_admin_auth_and_clinic_cms.py`: Created `users`, `refresh_tokens`, `organizations`, `locations`, `team_members`, `services`, `faq_items`, and `site_sections`.
3. `0003_sessions_inactivity.py`: Added:
   - `user_sessions`: Active server-side sessions table for token revocation (`id`, `user_id`, `is_active`, `expires_at`, `revoked_at`).
   - `users`: Inactivity fields (`inactivity_enabled`, `inactivity_timeout_minutes`, `inactivity_warning_seconds`).
   - `refresh_tokens`: Session association (`session_id`) and timestamp tracking (`revoked_at`) for concurrency grace periods.

### PHI-Safe Logging Rule
No patient-identifiable data (name, telephone, email, clinical notes, insurance) or authentication secrets (passwords, tokens) are ever written to logs or echoed in error responses. SQL query echoing is explicitly disabled.
