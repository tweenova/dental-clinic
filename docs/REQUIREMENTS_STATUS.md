# Marlow Dental — Requirements Status Matrix

Comprehensive requirements verification and traceability matrix for Marlow Dental Practice Management System (`feat/clinical-workflows`).

---

## Executive Summary

| Category | Total Requirements | Built | Partial | Missing |
| :--- | :---: | :---: | :---: | :---: |
| **Booking & Admin (BK1–BK9)** | 9 | 9 | 0 | 0 |
| **Reception Workflows (RC1–RC15)** | 15 | 15 | 0 | 0 |
| **Doctor & Clinical Depth (DR1–DR13)** | 13 | 13 | 0 | 0 |
| **Administration & Governance (AD1–AD7)** | 7 | 7 | 0 | 0 |
| **Cross-Cutting Quality (X1–X10)** | 10 | 10 | 0 | 0 |
| **Total** | **54** | **54** | **0** | **0** |

---

## 1. Booking & Admin (BK1 – BK9)

| ID | Description | Status | Backend Route / Contract | Frontend Page / Component | Navigation / Sidebar | Automated Test Evidence |
| :--- | :--- | :---: | :--- | :--- | :--- | :--- |
| **BK1** | Working hours and breaks | `built` | `GET/POST /api/v1/admin/booking/working-hours` | `src/app/admin/booking/page.tsx` | Admin Sidebar &rarr; Booking (`/admin/booking`) | `test_booking_admin_b7_b8_b9.py` |
| **BK2** | Practice closures & holidays | `built` | `GET/POST/DELETE /api/v1/admin/booking/closures` | `src/app/admin/booking/page.tsx` | Admin Sidebar &rarr; Booking | `test_booking_admin_b7_b8_b9.py` |
| **BK3** | Booking mode (open/paused/closed) with custom message | `built` | `GET/POST /api/v1/admin/booking/mode` | `src/app/admin/booking/page.tsx`, `src/app/book/page.tsx` | Admin Sidebar &rarr; Booking | `test_booking_admin_b7_b8_b9.py` |
| **BK4** | Clinician schedules and time-off | `built` | `GET/POST /api/v1/admin/booking/provider-availability` | `src/app/admin/booking/page.tsx`, `src/app/admin/team/page.tsx` | Admin Sidebar &rarr; Booking / Team | `test_booking_admin_b7_b8_b9.py` |
| **BK5** | Services bookable online, buffer time, clinician assignment | `built` | `GET/POST/PUT /api/v1/admin/services` | `src/app/admin/services/page.tsx` | Admin Sidebar &rarr; Services (`/admin/services`) | `test_services.py` |
| **BK6** | Availability engine showing real slots on `/book` | `built` | `GET /api/v1/public/booking-schedule` | `src/app/book/page.tsx`, `src/components/booking/booking-slot-picker.tsx` | Header &rarr; "Book Online", Direct URL | `test_availability_engine.py`, `src/test/booking-slots.test.tsx` |
| **BK7** | Appointments oversight page | `built` | `GET /api/v1/appointments`, `GET /api/v1/admin/reports/appointments` | `src/app/admin/appointments/page.tsx` | Admin Sidebar &rarr; Appointments (`/admin/appointments`) | `test_admin_audit_and_reports.py` |
| **BK8** | Reception & public banners when booking is paused or closed | `built` | `GET /api/v1/public/booking-status` | `src/components/booking/booking-paused-banner.tsx`, `/reception`, `/book` | Reception Dashboard & Public `/book` Header | `src/test/booking-banner.test.tsx` |
| **BK9** | Currency, business hours, and contact generated from single source of truth | `built` | `GET /api/v1/public/booking-status`, `GET /api/v1/admin/booking/settings` | `src/app/book/page.tsx`, `src/app/admin/settings/page.tsx` | Dynamic footer, Booking checkout, Settings | `test_booking_admin_b7_b8_b9.py` |

---

## 2. Reception Workflows (RC1 – RC15)

| ID | Description | Status | Backend Route / Contract | Frontend Page / Component | Navigation / Sidebar | Automated Test Evidence |
| :--- | :--- | :---: | :--- | :--- | :--- | :--- |
| **RC1** | Online appointment request triage | `built` | `GET /api/v1/reception/appointments`, `POST /api/v1/reception/appointments/{id}/status` | `src/app/reception/appointments/requests/page.tsx` | Reception &rarr; Appointments &rarr; Requests | `test_reception_and_roles.py` |
| **RC2** | Confirmation workflow for pending appointments | `built` | `GET /api/v1/reception/appointments`, `POST /api/v1/reception/appointments/{id}/status` | `src/app/reception/appointments/confirmations/page.tsx` | Reception &rarr; Appointments &rarr; Confirmations | `test_reception_and_roles.py` |
| **RC3** | Direct booking with conflict detection and audited override | `built` | `POST /api/v1/reception/schedule` (`override_conflict`, `override_reason`) | `src/app/reception/appointments/page.tsx`, `src/app/reception/schedule/page.tsx` | Reception &rarr; Appointments, Schedule | `test_double_booking_prevention.py` |
| **RC4** | Appointment cancellation with required reason | `built` | `POST /api/v1/reception/appointments/{id}/status` (requires `cancellation_reason`) | `src/app/reception/appointments/page.tsx` | Reception &rarr; Appointments &rarr; Cancel Action | `test_visit_timestamps_and_cancellation.py` |
| **RC5** | Patient check-in and waiting room elapsed time counter | `built` | `POST /api/v1/reception/appointments/{id}/status` (`arrived`), `GET /api/v1/reception/schedule` | `src/app/reception/check-in/page.tsx` | Reception &rarr; Check-In / Waiting Room | `test_waiting_time_and_live_updates.py` |
| **RC6** | Waitlist registration and priority slot offers | `built` | `GET/POST /api/v1/reception/waitlist`, `POST /api/v1/reception/appointments/{id}/waitlist-offers` | `src/app/reception/waitlist/page.tsx`, `src/components/reception/waitlist-offer-modal.tsx` | Reception &rarr; Waitlist (`/reception/waitlist`) | `test_cancellation_waitlist_offers.py` |
| **RC7** | Needs-Action operational dashboard queue | `built` | `GET /api/v1/reception/dashboard` | `src/app/reception/page.tsx` | Reception &rarr; Dashboard (`/reception`) | `test_reception_needs_action_queue.py` |
| **RC8** | Reminders with provider abstraction, scheduler, quiet hours, templates, opt-out, simulated labels | `built` | `GET/POST /api/v1/reception/reminders`, `POST /api/v1/reception/patients/{id}/messaging-opt-out`, `GET/POST /api/v1/admin/messaging/settings` | `src/app/reception/reminders/page.tsx`, `src/app/admin/messaging/page.tsx` | Reception &rarr; Reminders, Admin &rarr; Messaging | `test_messaging_and_reminders_upgrade.py` |
| **RC9** | End-of-day reconciliation review | `built` | `GET /api/v1/reception/end-of-day/unresolved`, `POST /api/v1/reception/end-of-day/resolve` | `src/app/reception/end-of-day/page.tsx` | Reception &rarr; End of Day | `test_reception_end_of_day.py` |
| **RC10** | Patient demographics: File number (MRN), guardian, emergency contact | `built` | `GET/POST /api/v1/reception/patients` (`file_number`, `guardian_name`, `emergency_contact`) | `src/app/reception/patients/page.tsx`, `src/app/reception/patients/[id]/page.tsx` | Reception &rarr; Patients | `test_patient_file_numbers_and_guardian.py` |
| **RC11** | Recalls calculated from service interval rules | `built` | `GET /api/v1/reception/recalls`, `POST /api/v1/reception/recalls/tasks` | `src/app/reception/recalls/page.tsx` | Reception &rarr; Recalls (`/reception/recalls`) | `test_service_catalog_recalls.py` |
| **RC12** | Payment ledger, voiding with reason, balance, "Payment record, not a tax invoice" receipt | `built` | `GET/POST /api/v1/reception/appointments/{id}/payments`, `POST /.../void` | `src/app/reception/patients/[id]/page.tsx`, `src/components/reception/record-payment-modal.tsx` | Reception &rarr; Patients &rarr; Billing Tab | `test_visit_payments.py` |
| **RC13** | Reception task board linked to patient records | `built` | `GET/POST/PATCH /api/v1/reception/tasks` | `src/app/reception/tasks/page.tsx` | Reception &rarr; Tasks (`/reception/tasks`) | `test_patient_profile_tasks.py` |
| **RC14** | Message log honestly labelled (provider / simulation badges) | `built` | `GET /api/v1/reception/messages` | `src/app/reception/messages/page.tsx` | Reception &rarr; Messages (`/reception/messages`) | `test_messages_logged_status.py` |
| **RC15** | Unified patient profile with linked tasks and message audit trail | `built` | `GET /api/v1/reception/patients/{id}` (includes tasks, appointments, messages) | `src/app/reception/patients/[id]/page.tsx` | Reception &rarr; Patients &rarr; Patient Profile | `test_patient_profile_tasks.py` |

---

## 3. Doctor & Clinical Depth (DR1 – DR13)

| ID | Description | Status | Backend Route / Contract | Frontend Page / Component | Navigation / Sidebar | Automated Test Evidence |
| :--- | :--- | :---: | :--- | :--- | :--- | :--- |
| **DR1** | Scoped doctor daily schedule | `built` | `GET /api/v1/doctor/schedule` (filtered to logged-in clinician) | `src/app/doctor/page.tsx` | Doctor Sidebar &rarr; Schedule (`/doctor`) | `test_clinical_depth_part_b.py` |
| **DR2** | "Waiting for you" immediate lounge queue with elapsed timer | `built` | `GET /api/v1/doctor/schedule` (status=`arrived`) | `src/app/doctor/page.tsx` | Doctor Sidebar &rarr; Schedule | `test_clinical_depth_part_b.py` |
| **DR3** | Patient clinical search and medical overview summary | `built` | `GET /api/v1/doctor/patients`, `GET /api/v1/doctor/patients/{patient_id}` | `src/app/doctor/patients/page.tsx`, `src/app/doctor/patients/[id]/page.tsx` | Doctor Sidebar &rarr; Patients | `test_clinical_depth_part_b.py` |
| **DR4** | Prominent allergy alert banner, severity badges, and chips | `built` | `GET /api/v1/doctor/patients/{patient_id}` | `src/components/doctor/clinical-alert-banner.tsx`, `/doctor/patients/[id]` | Doctor Patient Profile Top Bar | `src/test/clinical-alert-banner.test.tsx`, `test_clinical_depth_part_b.py` |
| **DR5** | SOAP clinical notes, immutable signing, and audited addenda | `built` | `POST /api/v1/doctor/encounters/{id}/note`, `POST /api/v1/doctor/encounters/{id}/note/sign`, `POST /api/v1/doctor/encounters/{id}/note/amend` | `src/app/doctor/patients/[id]/page.tsx` (Notes Tab) | Doctor Patient Profile &rarr; Notes | `test_clinical_depth_part_b.py` |
| **DR6** | Interactive adult/pediatric odontogram and procedure history | `built` | `GET/POST /api/v1/doctor/patients/{patient_id}/chart`, `POST /api/v1/doctor/encounters/{id}/chart/procedures` | `src/components/doctor/dental-chart.tsx`, `/doctor/patients/[id]` | Doctor Patient Profile &rarr; Chart Tab | `test_clinical_depth_part_b.py` |
| **DR7** | Unsigned notes audit queue | `built` | `GET /api/v1/doctor/unsigned-notes` | `src/app/doctor/page.tsx`, `/doctor/patients/[id]` | Doctor Dashboard &rarr; Unsigned Notes Alert | `test_clinical_depth_part_b.py` |
| **DR8** | Finish visit workflow triggering receptionist follow-up task | `built` | `POST /api/v1/doctor/appointments/{id}/finish` | `src/app/doctor/patients/[id]/page.tsx` | Doctor Patient Profile &rarr; Finish Visit Modal | `test_clinical_depth_part_b.py` |
| **DR9** | Doctor-scoped task management | `built` | `GET/POST/PATCH /api/v1/doctor/tasks` | `src/app/doctor/tasks/page.tsx` | Doctor Sidebar &rarr; Tasks (`/doctor/tasks`) | `test_clinical_depth_part_b.py` |
| **DR10** | Multi-phase dental treatment plans with status tracking | `built` | `GET/POST/PATCH /api/v1/doctor/treatment-plans` | `src/components/doctor/treatment-plan-tab.tsx`, `/doctor/patients/[id]` | Doctor Patient Profile &rarr; Treatment Plans | `test_clinical_depth_part_b.py` |
| **DR11** | Reusable SOAP note clinical templates | `built` | `POST /api/v1/doctor/clinical-notes/{note_id}/apply-template` | `src/app/admin/note-templates/page.tsx`, `/doctor/patients/[id]` | Admin Sidebar &rarr; Note Templates | `test_clinical_depth_part_b.py` |
| **DR12** | Confidential attachments and signed informed consent documents | `built` | `GET/POST /api/v1/doctor/patients/{patient_id}/encounters` | `src/components/doctor/clinical-documents-tab.tsx`, `/doctor/patients/[id]` | Doctor Patient Profile &rarr; Documents Tab | `test_clinical_depth_part_b.py` |
| **DR13** | Demo electronic prescriptions and specialist referral slips | `built` | `GET/POST /api/v1/doctor/documents/prescriptions`, `GET/POST /api/v1/doctor/documents/referrals` | `src/components/doctor/clinical-documents-tab.tsx`, `/doctor/patients/[id]` | Doctor Patient Profile &rarr; Documents Tab | `test_clinical_depth_part_b.py` |

---

## 4. Administration & Governance (AD1 – AD7)

| ID | Description | Status | Backend Route / Contract | Frontend Page / Component | Navigation / Sidebar | Automated Test Evidence |
| :--- | :--- | :---: | :--- | :--- | :--- | :--- |
| **AD1** | Staff account lifecycle and clinician linkage | `built` | `GET/POST/PATCH /api/v1/admin/users`, `GET/POST /api/v1/admin/team` | `src/app/admin/users/page.tsx`, `src/app/admin/team/page.tsx` | Admin Sidebar &rarr; Staff Accounts / Team | `test_staff_account_management.py`, `test_team.py` |
| **AD2** | Immutable audit log viewer and tamper-evident CSV export | `built` | `GET /api/v1/admin/audit`, `GET /api/v1/admin/audit/export` | `src/app/admin/audit/page.tsx` | Admin Sidebar &rarr; Audit Logs (`/admin/audit`) | `test_admin_audit_and_reports.py` |
| **AD3** | Operations, cancellations, recalls, and appointments reports with audited CSV exports | `built` | `GET /api/v1/admin/reports/appointments`, `GET /api/v1/admin/reports/export/appointments` | `src/app/admin/reports/page.tsx` | Admin Sidebar &rarr; Reports (`/admin/reports`) | `test_admin_audit_and_reports.py` |
| **AD4** | Role Access & Route Authorization Matrix | `built` | Role guards (`require_admin`, `require_doctor`, `require_receptionist`) | `docs/ROLE_ACCESS.md` | RBAC gated in code & layouts | `e2e/roles-and-navigation.spec.ts` |
| **AD5** | Messaging provider settings, simulation mode, and quiet hours | `built` | `GET/POST /api/v1/admin/messaging/settings`, `POST /api/v1/admin/messaging/test` | `src/app/admin/messaging/page.tsx` | Admin Sidebar &rarr; Messaging (`/admin/messaging`) | `test_messaging_and_reminders_upgrade.py` |
| **AD6** | Service catalog, pricing, clinical durations, and buffer management | `built` | `GET/POST/PUT /api/v1/admin/services` | `src/app/admin/services/page.tsx` | Admin Sidebar &rarr; Services (`/admin/services`) | `test_services.py` |
| **AD7** | Retained public CMS, patient FAQs, and site announcements | `built` | `GET/PUT /api/v1/admin/announcements`, `GET /api/v1/admin/locations` | `src/app/admin/settings/page.tsx`, `src/app/admin/announcements/page.tsx` | Admin Sidebar &rarr; Announcements / Locations | `test_cms.py` |

---

## 5. Cross-Cutting Quality & Compliance (X1 – X10)

| ID | Description | Status | Evidence / Artifact | Verification Detail |
| :--- | :--- | :---: | :--- | :--- |
| **X1** | Status Constants & Directory Alignment | `built` | `frontend/src/lib/directory.ts`, `backend/app/domain/models/booking_crm.py` | Single source of truth for booking, task, reminder, and payment statuses; verified in `frontend/src/test/statuses.test.ts`. |
| **X2** | Comprehensive Mutation Auditing | `built` | `backend/app/infrastructure/repositories/postgres_activity_repo.py` | Every create/update/cancel/void/override logs actor, action, entity, timestamp, and metadata. |
| **X3** | Automated Backups & Runbook Verified | `built` | `docs/backup_and_restore_runbook.md` | Documented daily automated dump runbook, least privilege, retention, and restore procedure. |
| **X4** | Security Architecture & Deployment Guide | `built` | `docs/SECURITY_AND_DEPLOYMENT.md` | HTTPS, session settings, ATTACHMENT_DIR backup, messaging env vars, and deployer responsibility model. |
| **X5** | Frontend Zero Lint Errors | `built` | `npm run lint` | ESLint 9 + React 19 rules pass with **0 errors** (206 warnings, 0 fatal errors). |
| **X6** | Frontend Unit Testing Suite | `built` | `frontend/vitest.config.ts`, `frontend/src/test/*.test.tsx` | 14/14 unit tests pass cleanly in Vitest across 4 test suites. |
| **X7** | Codebase Cleanup & Deprecation Removal | `built` | Alembic history & backend inspection | Reversible rename to `appointments_legacy`; insurance and hipaa cleanup documented in `docs/REMOVAL_LOG.md`. |
| **X8** | Reachability & Routing Audit | `built` | `docs/REACHABILITY_AUDIT.md`, `backend/scripts/audit_reachability.py` | Automated audit of all 41 Next.js pages (41 reachable, 0 orphans, 0 broken links), 185 FastAPI endpoints (169 reachable, 16 preserved administrative export/utility hooks). |
| **X9** | Idempotent Development Demo Seed | `built` | `python -m app.cli seed-demo`, `docs/RUNNING_LOCALLY.md` | Generates realistic, fully linked mock clinic data across all modules without writing credentials to files. Refuses non-dev execution. |
| **X10** | Playwright E2E Browser Test Suite | `built` | `frontend/playwright.config.ts`, `frontend/e2e/*.spec.ts`, `docs/screenshots/` | 9/9 tests passed (Administrator RBAC, Receptionist RBAC, Doctor RBAC, Accessibility Audits across Admin/Doctor/Reception/Public routes, and Full scripted clinical visit). 7 PNG artifacts generated in `docs/screenshots/`. |

---

## 6. Verification & Final Sign-Off Summary

All 54 functional and governance requirements across Part A, Part B, Part C, Part D, Part E, and Part F have been implemented, tested, and audited in the working tree.

### Quality Gate Summary

| Verification Suite | Target | Actual Result | Status |
| :--- | :--- | :--- | :---: |
| **Backend Pytest** | 100% pass | **201 passed**, 0 failed (13 warnings) | **PASS** |
| **Frontend ESLint** | 0 errors | **0 errors**, 206 warnings | **PASS** |
| **Frontend Vitest** | 100% pass | **14 passed** across 4 test files | **PASS** |
| **Playwright E2E** | 100% pass | **9 passed** across 3 test suites | **PASS** |
| **Production Build** | Exit code 0 | **47/47 static & dynamic pages generated** | **PASS** |
| **Environment Doctor** | 10/10 checks | **PASS (10/10 checks passed)** | **PASS** |
| **Alembic Revisions** | Single head | **`c2d3e4f5a6b7 (head)`** | **PASS** |
| **Secrets Audit** | 0 credentials | **0 plaintext keys, secrets, or patient data** | **PASS** |

### Screenshot Traceability

| Artifact Name | Workflow Demonstrated | File Path |
| :--- | :--- | :--- |
| `01_book_request.png` | Public online booking wizard (`/book`) | `docs/screenshots/01_book_request.png` |
| `02_reception_triage.png` | Receptionist triage queue (`/reception/appointments/requests`) | `docs/screenshots/02_reception_triage.png` |
| `03_waiting_room.png` | Live check-in and waiting lounge (`/reception/check-in`) | `docs/screenshots/03_waiting_room.png` |
| `04_doctor_patient_chart.png` | Doctor clinical chart with allergy alert banner (`/doctor/patients/[id]`) | `docs/screenshots/04_doctor_patient_chart.png` |
| `05_reception_task_board.png` | Reception task board linked to patient encounters (`/reception/tasks`) | `docs/screenshots/05_reception_task_board.png` |
| `06_payment_receipt.png` | Payment ledger with "Payment record, not a tax invoice" receipt modal | `docs/screenshots/06_payment_receipt.png` |
| `07_reminders_log.png` | Automated messaging and reminders log with simulated badges (`/reception/reminders`) | `docs/screenshots/07_reminders_log.png` |

