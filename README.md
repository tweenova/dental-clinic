# Marlow Dental — Clinic Web Platform & Appointment API

A production-grade web platform, administrative CMS, and appointment scheduling system for **Marlow Dental Medical Complex**, a multidisciplinary dental group founded by Dr. Sarah Marlow, DDS in Lincoln Park, Chicago.

This repository is maintained as a clean, decoupled monorepo containing:
1. **Frontend**: Next.js 16.3 (React 19, TypeScript, Tailwind CSS v4, Motion 12) App Router web application.
2. **Backend**: FastAPI (Python 3.14+, SQLAlchemy 2.0 Async, PostgreSQL, Alembic) Domain-Driven API service.

---

## 1. Project Overview & Architecture

Marlow Dental's digital platform delivers:
- **Public Patient Experience**: Dynamic homepage, multi-location selector, multidisciplinary clinical team directory, dynamic service catalog, accordion FAQ, and a 4-step URL-synced appointment booking wizard (`/book`).
- **Staff Administration (CMS)**: Secure editorial dashboard (`/admin`) for updating practice details, physical locations, clinical staff credentials, dental procedures, FAQ answers, and website content sections.
- **Front-Office Receptionist Workspace (`/reception`)**: Full front-desk command center including:
  - **Today at a Glance & Patient Flow**: Real-time database metrics, arrival times, wait durations, chair handoffs, and quick actions.
  - **Operational Schedule**: Day & list calendar views, provider filters, slot creation, rescheduling, and cancellation.
  - **Appointments & Intake Triage**: Canonical relational bookings management, website request reviews (`/reception/appointments/requests`), and upcoming confirmation queues (`/reception/appointments/confirmations`).
  - **Check-In & Waiting Room Flow (`/reception/check-in`)**: Live status transitions (`scheduled` → `arrived` → `in_progress` → `completed`).
  - **Patient Directory & Profiles (`/reception/patients`)**: Server-side search by name/phone/email/MRN, duplicate detection safeguards, and comprehensive charts.
  - **Operational Tasks Board (`/reception/tasks`)**: Front-desk task tracking, priority queues, and patient follow-ups.
  - **Communications Center (`/reception/messages`)**: SMS, email, portal, and internal staff communication logs.
  - **Preventive Recalls (`/reception/recalls`)**: Hygiene and periodic exam cycle tracking.
  - **ASAP Waitlist (`/reception/waitlist`)**: Cancellation fill queue for open chair time.
  - **Prospective Leads (`/reception/leads`)**: Inquiry triage and 1-click conversion to patient charts.
- **Practitioner Foundation (`/doctor`)**: Doctor schedule view and patient visit clinical notes updater.
- **Multi-Role RBAC & Clinic Scoping**: Strict backend permission checks and `clinic_id` boundary enforcement for `admin`, `receptionist`, `doctor`, and `patient` roles.
- **Enterprise-Grade Authentication**:
  - **7-day access token** held strictly in frontend memory (`src/lib/api.ts`).
  - **7-day refresh token** delivered as a secure, browser-managed `HttpOnly`, `SameSite=Lax` cookie (`marlow_refresh_token`).
  - **35-minute silent rotation window**: Refresh requests within 35 minutes preserve valid tokens; requests at or after 35 minutes rotate the cryptographic token pair.
  - **Concurrency & Replay Safety**: 30-second backend grace period paired with a frontend single-flight lock (`isRefreshing`) and FIFO request replay queue (`failedQueue`).
  - **Server-Side Session Revocation**: Every access token contains a session ID (`sid`) validated against the `user_sessions` PostgreSQL table on every protected request.
  - **Configurable Inactivity Logout**: Interactive countdown warning modal ("Stay Signed In") tracking true user activity (mouse, keyboard, touch, scroll) while ignoring background API traffic.

```text
               PUBLIC FRONTEND & ADMIN CMS ARCHITECTURE

   ┌────────────────────────────────────────────────────────┐
   │            Browser (Next.js 16 Web App)                │
   │  ┌───────────────────────┐  ┌───────────────────────┐  │
   │  │  Access Token (Memory)│  │  HttpOnly Cookie (7d) │  │
   │  └──────────┬────────────┘  └───────────┬───────────┘  │
   │             │ (Bearer JWT)              │ (Credentials)│
   │             ▼                           ▼              │
   │  ┌──────────────────────────────────────────────────┐  │
   │  │  Centralized API Boundary (src/lib/api.ts)       │  │
   │  │  - Single-Flight Refresh Lock                    │  │
   │  │  - FIFO Request Replay Queue                     │  │
   │  └──────────────────────┬───────────────────────────┘  │
   └─────────────────────────┼──────────────────────────────┘
                             │ HTTP/JSON
                             ▼
   ┌────────────────────────────────────────────────────────┐
   │            Backend API (FastAPI + Python 3.14)          │
   │  ┌──────────────────────────────────────────────────┐  │
   │  │  SlowAPI Rate Limiter (Login: 5/m, Refresh: 30/m)│  │
   │  └──────────────────────┬───────────────────────────┘  │
   │  ┌──────────────────────▼───────────────────────────┐  │
   │  │  Auth & Session Layer (Validates `sid` claim)    │  │
   │  └──────────────────────┬───────────────────────────┘  │
   │  ┌──────────────────────▼───────────────────────────┐  │
   │  │  Application Services (Auth, Team, Services, CMS)│  │
   │  └──────────────────────┬───────────────────────────┘  │
   │  ┌──────────────────────▼───────────────────────────┐  │
   │  │  Domain Repositories (Abstract Protocols)        │  │
   │  └──────────────────────┬───────────────────────────┘  │
   └─────────────────────────┼──────────────────────────────┘
                             │ SQLAlchemy 2.0 (asyncpg)
                             ▼
   ┌────────────────────────────────────────────────────────┐
   │         PostgreSQL Database ("dentai_dev")             │
   │  - user_sessions, users, refresh_tokens                │
   │  - organizations, locations, team_members              │
   │  - services, faq_items, site_sections, appointments    │
   └────────────────────────────────────────────────────────┘
```

---

## 2. Repository Structure

```text
dental-clinic-project/
├── frontend/                     # Next.js 16 App Router application (Node.js/TypeScript)
│   ├── src/
│   │   ├── app/                  # App Router pages (/book, /admin, /login, /privacy, etc.)
│   │   ├── components/           # UI primitives, layout shell, sections & providers
│   │   │   ├── layout/           # SiteHeader, Footer, MobileMenu, FloatingAction, LegalBox
│   │   │   ├── providers/        # AuthProvider (inactivity & sessions), PublicContentProvider
│   │   │   ├── sections/         # Hero, Doctor, Services, Visit, FAQ, Commitments
│   │   │   └── ui/               # Button, Card, TextField, SearchDialog, Modal
│   │   └── lib/                  # Centralized api.ts (memory token, FIFO queue), utils
│   ├── public/                   # Static media assets and branding
│   ├── docs/                     # Specifications (prd, architecture, design, rules, phases, memory)
│   ├── package.json              # Frontend npm dependencies and scripts
│   └── README.md                 # Frontend-specific notes
├── backend/                      # FastAPI service (Python 3.14+)
│   ├── app/
│   │   ├── api/v1/               # HTTP endpoints (auth, public_content, admin_*, appointments)
│   │   ├── application/          # DTOs and Application Services (AuthService, etc.)
│   │   ├── core/                 # Config (.env), database engine, logging, security, limiter
│   │   ├── domain/               # Pure business models and abstract repository protocols
│   │   └── infrastructure/       # SQLAlchemy ORM models, repositories, local storage
│   ├── alembic/                  # Database migration scripts & env.py
│   │   └── versions/             # Migrations: 0001, 0002, 0003
│   ├── tests/                    # Pytest test suite (40/40 tests passing)
│   ├── requirements.txt          # Python package requirements
│   ├── .env.example              # Template for backend configuration
│   └── README.md                 # Backend-specific architecture and CLI guide
├── AGENTS.md                     # Permanent safety guidelines and rules for AI agents
├── .gitignore                    # Monorepo git ignore definitions
└── README.md                     # This file (Complete Beginner's Quickstart Guide)
```

---

## 3. Prerequisites & Environment Verification

Before running the project, verify that the required developer tools are installed on your system. Open **PowerShell** or your terminal and run:

```powershell
git --version      # Recommended: Git 2.40+
node --version     # Recommended: Node.js v20.x or v22.x LTS
npm --version      # Recommended: npm 10.x+
python --version   # Recommended: Python 3.12, 3.13, or 3.14
uv --version       # Recommended: uv 0.4+ (High-performance Python package manager)
psql --version     # Recommended: PostgreSQL 15 or 16 client
```

> **What are these tools?**
> - **Git**: Version control system that tracks your code changes and manages branches.
> - **Node.js & npm**: The JavaScript runtime and package manager used to build and run the Next.js frontend.
> - **Python**: The programming language that powers the FastAPI backend service.
> - **uv**: An extremely fast, modern Python package manager that handles virtual environments and installs dependencies in seconds (similar to how `npm` works for JavaScript).
> - **PostgreSQL**: An open-source relational SQL database where patient appointments, clinical staff, services, and admin accounts are saved.

---

## 4. Cloning the Repository & Git Workflow

### Cloning

To clone the official repository to your local computer:

```powershell
git clone https://github.com/abdulli23309-ops/dental-clinic-project.git
cd dental-clinic-project
```

### Git Concepts for Rookies

When collaborating on this repository:
1. **Always check your working tree before pulling**:
   ```powershell
   git status
   ```
2. **Fetch all recent changes from the remote server**:
   ```powershell
   git fetch origin
   ```
   *`git fetch` downloads the latest branch information from GitHub without modifying your local code files.*
3. **Switch to the active feature branch**:
   ```powershell
   git switch feat/complete-admin-auth-cms-system
   ```
4. **Pull new commits into your local branch**:
   ```powershell
   git pull origin feat/complete-admin-auth-cms-system
   ```
   *`git pull` combines `git fetch` and `git merge`, bringing the remote commits directly into your local workspace.*

> ⚠️ **Safety Rules (from `AGENTS.md`)**:
> Never run destructive git commands like `git reset --hard`, `git clean -fd`, or `git push --force`. Always make small, focused commits and open reviewable pull requests.

---

## 5. Backend Setup (Python, Virtual Environments, and Database)

Python works differently than Node.js/npm. In Node, packages are installed into a local `node_modules` folder by default. In standard Python, packages might accidentally install into your entire operating system if you don't use a **virtual environment**.

A virtual environment (stored in the `.venv` directory) is an isolated folder containing its own dedicated copy of Python and installed packages. This prevents version conflicts across different projects.

### Step 5.1: Create Virtual Environment and Install Dependencies

Open a terminal and navigate to the `backend/` folder:

```powershell
cd "E:\dental clinic project\backend"

# Create a virtual environment using Python 3.14:
uv venv .venv --python python3.14

# Install all required Python packages into .venv:
uv pip install -r requirements.txt
```

*(This command is the Python equivalent of running `npm install`.)*

### Step 5.2: Configure Backend Environment Variables

Copy the template `.env.example` file to create your local `.env`:

```powershell
cp .env.example .env
```

Open `backend/.env` in your code editor and verify your database connection string:

```env
DATABASE_URL=postgresql+asyncpg://postgres:YOUR_POSTGRES_PASSWORD@localhost:5432/dentai_dev
JWT_SECRET_KEY=dev-jwt-secret-key-32-chars-minimum
REFRESH_SECRET_KEY=dev-refresh-secret-key-32-chars-minimum
ACCESS_TOKEN_EXPIRE_MINUTES=10080
REFRESH_TOKEN_EXPIRE_DAYS=7
REFRESH_TOKEN_ROTATE_AFTER_MINUTES=35
REFRESH_COOKIE_NAME=marlow_refresh_token
REFRESH_COOKIE_SECURE=false
CONCURRENCY_GRACE_PERIOD_SECONDS=30
AUTH_LOGIN_RATE_LIMIT=5/minute
AUTH_REFRESH_RATE_LIMIT=30/minute
```

*Replace `YOUR_POSTGRES_PASSWORD` with your local PostgreSQL server password. Never commit passwords or `.env` files to git.*

### Step 5.3: Create PostgreSQL Database

Make sure your PostgreSQL server is running. Create the `dentai_dev` database:

```powershell
# Using the PostgreSQL command-line tool:
createdb -U postgres -h localhost dentai_dev
```
*(Or create it inside pgAdmin or SQL Shell: `CREATE DATABASE dentai_dev;`)*

### Step 5.4: Apply Database Migrations (Alembic)

**Never create or modify database tables by hand in SQL!** Instead, we use **Alembic**, a migration tool that tracks schema changes as versioned, reversible Python files.

Run the migrations to bring your database schema to the latest version:

```powershell
uv run alembic upgrade head
```

Verify that your database is at the current head (`0003_sessions_inactivity`):

```powershell
uv run alembic current
```

### Step 5.5: Seed Baseline Clinic Data & Create Administrator Account

We provide a safe command-line tool in `app.cli` to populate initial clinic data and create an administrative account without hardcoding secrets:

```powershell
# Seed the initial organization, locations, clinical team, services, and FAQ items:
uv run python -m app.cli seed

# Create your personal local administrator account:
uv run python -m app.cli create-admin --email admin@marlowdental.com --password "YourStrongPasswordHere" --name "Clinic Director"
```

---

## 6. Frontend Setup (Next.js & Node.js)

Open a **second terminal** window and navigate to the `frontend/` directory:

```powershell
cd "E:\dental clinic project\frontend"

# Install all JavaScript / TypeScript dependencies:
npm install

# Copy the local environment configuration:
cp .env.example .env.local
```

Verify `frontend/.env.local` points to your local FastAPI backend:
```env
NEXT_PUBLIC_API_URL=http://localhost:8000
```

---

## 7. Running Both Services Locally

The web platform requires **two separate processes running simultaneously** in two terminal windows:

### Terminal 1: Backend API (FastAPI)

```powershell
cd "E:\dental clinic project\backend"
uv run uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

- **`uv run`**: Runs the command using the `.venv` virtual environment.
- **`uvicorn`**: High-performance ASGI web server for Python.
- **`app.main:app`**: Points to the FastAPI application instance in `app/main.py`.
- **`--reload`**: Automatically restarts the server whenever backend Python files are saved.
- **Backend URL**: [http://localhost:8000](http://localhost:8000)
- **Interactive Swagger API Docs**: [http://localhost:8000/docs](http://localhost:8000/docs)

### Terminal 2: Frontend Web App (Next.js)

```powershell
cd "E:\dental clinic project\frontend"
npm run dev
```

- **Frontend URL**: [http://localhost:3000](http://localhost:3000)

---

## 8. Authentication Architecture: Tokens, Cookies & DevTools

For developers new to modern web security, here is how authentication works in Marlow Dental:

### 1. The Access Token (Memory Only)
- **Lifetime**: 7 days (10,080 minutes).
- **Storage**: Kept exclusively in frontend JavaScript memory (`src/lib/api.ts`).
- **Why?**: Storing access tokens in `localStorage` or `sessionStorage` leaves them vulnerable to theft via Cross-Site Scripting (XSS) attacks. In-memory storage ensures malicious browser scripts cannot steal your token.
- **Session Validation**: The access token contains a server-generated `sid` (session ID) claim. On every protected request, FastAPI verifies against PostgreSQL that the session has not been revoked.

### 2. The Refresh Token (HttpOnly Cookie)
- **Lifetime**: 7 days.
- **Storage**: Stored in a browser cookie named `marlow_refresh_token`.
- **HttpOnly**: Frontend JavaScript **cannot** read, inspect, or modify this cookie. The browser automatically attaches it when making requests to `/api/v1/auth/refresh`.
- **Rotation Window (35 Minutes)**: When the frontend calls refresh, the server only issues a brand-new cookie if at least 35 minutes have passed since the token was issued. If under 35 minutes, it issues a fresh access token while reusing the existing cookie, eliminating database row churn.
- **Concurrency Grace Period (30 Seconds)**: If multiple browser tabs send refresh requests simultaneously, a 30-second grace period prevents legitimate requests from being rejected as replay attacks.

### 3. How to Verify Cookies in Chrome / Edge / Firefox DevTools
1. Open [http://localhost:3000/login](http://localhost:3000/login) in your browser.
2. Sign in with your admin credentials.
3. Open DevTools (`F12` or Right Click -> **Inspect**).
4. Navigate to the **Application** (or **Storage**) tab -> **Cookies** -> `http://localhost:3000` (or `http://localhost:8000`).
5. Notice the cookie named `marlow_refresh_token`:
   - The **HttpOnly** checkbox is checked (JavaScript cannot read it).
   - The **SameSite** column shows `Lax`.
6. Open the **Network** tab, filter by `Fetch/XHR`, and observe:
   - When an access token expires, the client calls `POST /api/v1/auth/refresh`.
   - In Request Headers, `Cookie: marlow_refresh_token=...` is automatically sent by the browser.
   - The response returns a fresh `access_token` which is stored in memory.

---

## 9. Admin CMS Walkthrough & Testing Changes

Once logged in at [http://localhost:3000/login](http://localhost:3000/login), the admin dashboard at `/admin` allows full management of practice content:

1. **Website Content (`/admin/website`)**:
   - Edit the homepage announcement headline, about copy, or contact details.
   - Click **Save Changes** and refresh [http://localhost:3000](http://localhost:3000) to see the new copy live immediately.
2. **Clinical Team Roster (`/admin/team`)**:
   - Add, edit, or toggle clinicians (Dentists, Orthodontists, Hygienists, Oral Surgeons).
   - Set one clinician as `Director`. The public site dynamically presents the Director in the leadership section without hardcoding clinician names.
3. **Locations (`/admin/locations`)**:
   - Manage practice locations. The public visit section (`Visit.tsx`) displays multi-location selector tabs with live addresses, hours, and phone numbers.
4. **Services (`/admin/services`)**:
   - Add or archive dental procedures. The public service catalog and booking wizard dynamically reflect active procedures.
5. **Account Security & Inactivity (`/admin/account`)**:
   - Enable or disable Inactivity Auto-Logout.
   - Adjust the inactivity timeout (15m, 30m, 60m, 120m) and warning window.
   - Test the feature: Stop typing or moving your mouse for the configured duration. An accessible countdown modal ("Stay Signed In") will appear. Clicking "Stay Signed In" resets your timer.

---

## 10. Automated Tests & Code Quality

### Backend Automated Test Suite
To execute all backend tests:

```powershell
cd "E:\dental clinic project\backend"
uv run pytest -v
```

**Result: 32 / 32 tests passing** (100% pass rate) covering:
- Database connectivity & degraded health handling
- Domain entity status transitions and unique constraint enforcement
- Appointment booking API contract, input validation, and zero-PHI logging
- 7-day token issuance and password verification
- 35-minute rotation window threshold logic
- 30-second concurrency grace period handling
- Server-side session revocation on logout
- Inactivity preference updates via `PATCH /auth/inactivity-settings`
- Admin team, services, and CMS section lifecycle & soft-deletion

### Frontend Production Build
To verify frontend TypeScript types, JSX compilation, and static prerendering:

```powershell
cd "E:\dental clinic project\frontend"
npm run build
```

**Result: Compiled successfully** with all 21 routes prerendered without errors.

---

## 11. Troubleshooting Common Issues

### 1. `npm install` fails
- **Cause**: Outdated Node.js version.
- **Fix**: Check `node --version`. Ensure you are using Node.js v20+ LTS.

### 2. `python` cannot import package / ModuleNotFoundError
- **Cause**: The command is running against your global Python rather than `.venv`.
- **Fix**: Run commands prefixed with `uv run` (e.g. `uv run python -m app.cli seed`) or activate the virtual environment first (`.\.venv\Scripts\Activate.ps1`).

### 3. `uvicorn` command not found
- **Cause**: Uvicorn is installed inside `.venv`, not globally.
- **Fix**: Run:
  ```powershell
  uv run uvicorn app.main:app --reload
  ```
  or run directly via:
  ```powershell
  .\.venv\Scripts\python.exe -m uvicorn app.main:app --reload
  ```

### 4. PostgreSQL connection fails (`ConnectionRefusedError` or password authentication failed)
- **Cause**: PostgreSQL service is stopped, port 5432 is blocked, or the password in `backend/.env` is incorrect.
- **Fix**:
  - In Windows PowerShell, check if PostgreSQL is running: `Get-Service *postgres*`.
  - Verify that database `dentai_dev` exists in pgAdmin or psql.
  - Check `backend/.env` to ensure `DATABASE_URL` matches your local credentials.

### 5. CORS error in browser console
- **Cause**: Frontend origin is not whitelisted by the backend.
- **Fix**: In `backend/.env`, ensure `ALLOWED_ORIGINS` includes `http://localhost:3000`.

### 6. Login Refresh Loop
- **Cause**: The browser is rejecting the refresh cookie or `NEXT_PUBLIC_API_URL` is misconfigured.
- **Fix**: Ensure `frontend/.env.local` has `NEXT_PUBLIC_API_URL=http://localhost:8000` and you are accessing the frontend via `http://localhost:3000`.

### 7. Alembic Migration Error (`Can't locate revision`)
- **Cause**: Inconsistent migration head or database out of sync.
- **Fix**: Run `uv run alembic current` to see the current revision, then `uv run alembic heads` to inspect the available targets. Do not drop database tables manually.

---

## 12. Development Workflow & Contribution Rules

When contributing code:
1. Pull the latest code:
   ```powershell
   git fetch origin
   git switch feat/complete-admin-auth-cms-system
   git pull origin feat/complete-admin-auth-cms-system
   ```
2. Make focused, incremental changes following KISS, DRY, and YAGNI.
3. Verify backend tests pass:
   ```powershell
   uv run pytest -v
   ```
4. Verify frontend builds cleanly:
   ```powershell
   npm run build
   ```
5. Inspect your git diff before committing:
   ```powershell
   git status
   git diff
   ```
6. Commit with conventional commit messages (e.g. `feat(auth): ...`, `feat(cms): ...`, `docs: ...`).
7. Open a Pull Request for code review. **Never enable auto-merge or merge without human review.**

---

## 13. License

Proprietary software. All rights reserved by Marlow Dental Medical Complex. Unauthorized copying, redistribution, or modification is strictly prohibited.
