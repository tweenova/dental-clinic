# PR Description: feat/clinical-workflows — Marlow Dental Practice Management Platform

## 1. Problem & Context Summary

Prior to this branch, Marlow Dental operated primarily as a marketing brochure and basic appointment-request booking tool. Clinical records, front-desk triage, patient payment ledgering, doctor odontogram charting, and recall compliance were either unrepresented or managed through fragmented, untracked workflows.

This Pull Request delivers a comprehensive, enterprise-grade clinical practice management platform on branch `feat/clinical-workflows`. It establishes contract-first, role-separated workspaces for **Administrators**, **Receptionists**, and **Clinicians (Doctors)**, backed by FastAPI, PostgreSQL (SQLAlchemy async + Alembic), Next.js 16 (React 19), and audited operational data pipelines.

---

## 2. Summary of Implementation & Features

### Part A: Reception Workflows & Communications (RC1 – RC15)
- **Request Triage & Confirmations (RC1, RC2)**: Online booking triage pipeline with accept/reject endpoints and pending confirmation queues.
- **Direct Scheduling & Conflict Prevention (RC3)**: Real-time schedule conflict engine preventing overlapping clinician bookings, with audited receptionist overrides.
- **Audited Cancellations (RC4)**: Mandatory cancellation reason requirement on all cancellations and no-shows, logged with actor attribution.
- **Waiting Lounge & Live Timers (RC5)**: Real-time patient check-in (`arrived`) with waiting lounge elapsed minutes counter.
- **Priority Waitlist Offers (RC6)**: Priority waitlist registration with automated slot offers and expiration handling.
- **Needs-Action Operational Queue (RC7)**: Prioritized front-desk dashboard queue aggregating unconfirmed bookings, triage requests, and pending tasks.
- **Honest Reminders Engine (RC8, RC14, AD5)**: Provider abstraction (`TwilioSmsProvider`, `WhatsAppCloudProvider`, `SimulatedProvider`) with automatic 24h & 2h reminders, Karachi timezone quiet hours (09:00–20:00) with automatic shifting, advisory locking (`pg_try_advisory_xact_lock`), and explicit "Simulated, not delivered" UI badges.
- **End-of-Day Reconciliation (RC9)**: Comprehensive daily audit reviewing resolved visits, unresolved bookings, and collected revenue.
- **Patient Demographics (RC10)**: Extended medical record number (File Number / MRN), legal guardian for minors, and emergency contact details.
- **Preventative Recalls (RC11)**: Recall intervals calculated dynamically from service definitions (e.g., 6-month hygiene).
- **Payment Ledger & Receipts (RC12)**: Patient balance ledger, payment recording, audited voiding with mandatory reason, and printable receipt displaying *"Payment record, not a tax invoice"*.
- **Task Board & Unified Profiles (RC13, RC15)**: Multi-priority task management linked directly to patient profiles with complete operational audit trails.

### Part B: Doctor Workspace & Clinical Depth (DR1 – DR13)
- **Clinician Daily Schedule (DR1, DR2)**: Doctor-scoped calendar view with immediate "Waiting for you" lounge queue displaying elapsed waiting times.
- **Clinical Search & Alerts (DR3, DR4)**: Patient search by name, MRN, phone, or email; prominent clinical alert banner highlighting allergies and medical risks with severity badges.
- **SOAP Notes & Signing (DR5, DR7)**: Structured SOAP notes (Subjective, Objective, Assessment, Plan) with cryptographic signing, immutable locking, append-only timestamped addenda, and unsigned note queue.
- **Interactive Dental Odontogram (DR6)**: Adult (32 teeth) and pediatric (20 primary teeth) chart with surface-level restoration mapping, conditions (decay, crown, missing, implant), and completed procedure history.
- **Finish Visit Hand-Off (DR8)**: One-click visit completion triggering automatic receptionist follow-up task generation.
- **Doctor Task Management (DR9)**: Clinical task board scoped to logged-in clinicians with active/completed filtering.
- **Multi-Phase Treatment Plans (DR10)**: Phase-based treatment plans with tooth-level procedure bundling, cost estimates, and acceptance status tracking.
- **SOAP Note Templates (DR11)**: Reusable administrative clinical note templates with one-click insertion into active drafts.
- **Confidential Documents & Consent (DR12)**: Secure patient attachment storage with magic-byte MIME validation, SHA-256 integrity verification, and signed informed consent slips.
- **Prescriptions & Referral Slips (DR13)**: Demonstration e-prescriptions (with medication, dosage, instructions, refills) and specialist referral slips with full print/view modals.

### Part C & E: Administration, Governance, & Neutralization (AD1 – AD7, BK1 – BK9)
- **Staff Lifecycle & Clinician Linkage (AD1)**: Full user management, role assignments (Admin, Receptionist, Doctor), and 1-to-1 linkage between user accounts and clinical provider profiles.
- **Immutable Audit Log & CSV Export (AD2)**: Centralized audit viewer capturing every system mutation with actor ID, IP address, timestamp, entity diffs, and tamper-evident CSV download.
- **Operations & Financial Reporting (AD3)**: Dedicated administrative reports for cancellations, appointments, recalls, and revenue with audited CSV exports.
- **Role-Based Access Control (AD4)**: Enforced via code decorators (`require_admin`, `require_doctor`, `require_receptionist`) and documented in `docs/ROLE_ACCESS.md`.
- **Messaging Settings & Test Endpoint (AD5)**: Configurable provider modes, quiet hours window, and test message dispatch endpoint (`POST /api/v1/admin/messaging/test`).
- **Service Catalog & Booking Rules (BK1–BK9, AD6)**: Working hours, practice holiday closures, open/paused/closed booking modes with custom notices, buffer times, and single-source-of-truth contact/currency constants.
- **Part E Neutralization**: Complete removal of HIPAA branding, US/Chicago localized strings, and hardcoded currency symbols; clinic profile settings (name, address, phone, license, doctor) are fully admin-editable. Reversible schema rename of `appointments` to `appointments_legacy`.

---

## 3. Database Migration History

The database schema is managed through Alembic and currently points to a single clean head:

| Revision | Description | Operations |
| :--- | :--- | :--- |
| **`e0f1a2b3c4d5`** | Reminders, Channels, & Constraints | Added `reception_reminders` fields, `cancellation_reason`, `patients` demographics, `patient_payments` table, and partial unique constraint `uq_messages_booking_reminder_type`. |
| **`b1c2d3e4f5a6`** | Clinical Depth Schema | Added `clinical_alerts`, `dental_chart_findings`, `dental_chart_procedures`, `clinical_treatment_plans`, `clinical_treatment_plan_items`, `clinical_note_templates`, `patient_attachments`, `clinical_prescriptions`, and `clinical_referrals`. |
| **`c2d3e4f5a6b7 (head)`** | Rename Appointments to Legacy | Reversible migration renaming `appointments` to `appointments_legacy` with reversible foreign key constraints. Tested both upgrade and downgrade. |

Current Alembic Head:
```text
c2d3e4f5a6b7 (head)
```

---

## 4. Configuration Flags & Environment Defaults

All environment configuration is managed via `backend/app/core/config.py` and validated at startup:

| Variable | Default Value | Description |
| :--- | :--- | :--- |
| `ENVIRONMENT` | `development` | Runtime environment (`development`, `test`, `production`). Refuses destructive seeds in production. |
| `SCHEDULER_ENABLED` | `False` | Feature flag controlling the background reminder dispatcher loop. |
| `SCHEDULER_INTERVAL_SECONDS` | `60` | Dispatch loop polling interval in seconds. |
| `CLINICAL_DOCUMENTS_ENABLED` | `False` | Feature flag controlling clinical document attachments and upload endpoints. |
| `ATTACHMENT_DIR` | `backend/storage/attachments` | Local disk storage directory for uploaded clinical attachments and consent slips. |
| `ATTACHMENT_MAX_SIZE_BYTES` | `15728640` (15 MB) | Maximum permitted file size for uploaded attachments. |
| `LOGIN_RATE_LIMIT` | `60/minute` | Rate limit threshold for user login attempts. |
| `REFRESH_RATE_LIMIT` | `300/minute` | Rate limit threshold for token refresh requests. |
| `TWILIO_ACCOUNT_SID` | `None` (empty) | Twilio API credential; if unset, SMS provider operates in simulated mode. |
| `WHATSAPP_TOKEN` | `None` (empty) | Meta WhatsApp Cloud API token; if unset, WhatsApp provider operates in simulated mode. |

---

## 5. Known Limitations

1. **Messaging Providers**: Real external delivery requires setting valid credentials (`TWILIO_ACCOUNT_SID`, `WHATSAPP_TOKEN`). When unconfigured, messages are stored with honest `simulated` delivery tags and displayed with "Simulated, not delivered" badges.
2. **Background Dispatch**: The reminder runner loop only executes automatically when `SCHEDULER_ENABLED=true` is set. In environments without background threads, reminders can be triggered on-demand via `python -m app.cli send-reminders`.
3. **Attachments Storage**: Attachments are stored locally within `ATTACHMENT_DIR`. In high-availability multi-instance deployments, deployers must provide shared network storage (e.g. NFS / volume mount) or object storage.
4. **Deployer Responsibilities**: In accordance with `docs/SECURITY_AND_DEPLOYMENT.md`, database encryption at rest, HTTPS/TLS reverse-proxy termination, backup rotation, and jurisdictional legal reviews are the responsibility of the system deployer.

---

## 6. Verification & Quality Gates

All verification suites have been executed against active code with 100% pass rates:

| Verification Suite | Target | Actual Result | Status |
| :--- | :--- | :--- | :---: |
| **Backend Tests** | `pytest -q` | **201 passed**, 0 failed, 13 warnings in 111s | **PASS** |
| **Frontend Lint** | `npm run lint` | **0 errors**, 206 warnings (React Compiler memoization) | **PASS** |
| **Frontend Unit Tests** | `npm test` | **14 passed** across 4 test suites in 4.4s | **PASS** |
| **Playwright E2E Tests** | `npx playwright test` | **4 passed** (roles navigation + full scripted visit) in 48s | **PASS** |
| **Production Build** | `npm run build` | **47/47 static and dynamic pages generated** (Exit code 0) | **PASS** |
| **Alembic Revisions** | `alembic heads` | Single head: **`c2d3e4f5a6b7 (head)`** | **PASS** |
| **Secrets Scan** | Working tree diff + history | **0 plaintext keys, credentials, or real patient data** | **PASS** |
| **Requirements Validation**| `verify_requirements.py` | **54/54 requirements verified** (BK1-9, RC1-15, DR1-13, AD1-7, X1-10) | **PASS** |

---

## 7. Demo Personas & Credential Management

No passwords are hardcoded in the codebase, specifications, documentation, or tests. When running the idempotent demo seed CLI (`python -m app.cli seed-demo`), credentials are read from environment variables or securely generated and printed once:

```bash
# Seed demo accounts and data
python -m app.cli seed-demo
```

Configurable persona environment variables:
- `ADMIN_PASSWORD` (or `DEMO_ADMIN_PASSWORD`): Password for `admin@marlowdental.com` (Administrator)
- `RECEPTIONIST_PASSWORD` (or `DEMO_RECEPTIONIST_PASSWORD`): Password for `receptionist@marlowdental.com` (Receptionist)
- `DOCTOR_PASSWORD` (or `DEMO_DOCTOR_PASSWORD`): Password for `doctor@marlowdental.com` (Lead Clinician)
- `DOCTOR_SARAH_PASSWORD`: Password for `dr.sarah@marlowdental.com` (Associate Clinician)

---

## 8. Instructions for Repository Owner to Push and Open PR

> [!IMPORTANT]
> In strict compliance with `AGENTS.md` Git Safety Rules, AI agents **NEVER** run `git push`, `git push --force`, or `gh pr create`.
> The repository owner should run the following commands to stage modified files explicitly, commit, push, and open the pull request:

```bash
# 1. Review modified and untracked files
git status

# 2. Stage implementation and documentation files explicitly (do NOT use git add .)
git add docs/
git add backend/alembic/versions/
git add backend/app/
git add backend/scripts/
git add backend/tests/
git add frontend/src/
git add frontend/e2e/
git add frontend/eslint.config.mjs
git add frontend/tsconfig.json

# 3. Create a clean verification commit
git commit -m "feat(clinical-workflows): complete Marlow Dental clinical platform, doctor workspace, reachability audit, demo seed, and E2E test suite"

# 4. Push branch to origin or upstream (tweenova/dental-clinic)
git push origin feat/clinical-workflows

# 5. Open Pull Request to upstream
gh pr create --repo tweenova/dental-clinic \
  --base main \
  --head feat/clinical-workflows \
  --title "feat: complete clinical workflows, reception upgrades, doctor workspace, and E2E test suite" \
  --body-file docs/PR_DESCRIPTION.md
```
