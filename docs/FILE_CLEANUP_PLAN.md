# Marlow Dental — Comprehensive File Cleanup Plan (Part H)

This document catalogs all root markdown files, audit reports, agent directories, scratch scripts, temporary artifacts, and the complete database migration inventory.

> [!IMPORTANT]
> **Safety Rule**: In strict compliance with project safety rules, **no files have been deleted yet**. No files will be deleted until this cleanup plan is reviewed and confirmed.

---

## 1. Classification Table: Root Files, Scratch Files, Reports, and Artifacts

| Category | File / Path | Purpose & Context | Classification | Rationale |
| :--- | :--- | :--- | :---: | :--- |
| **User Rules & Config** | `AGENTS.md` | Core project rules, git safety, database invariants | **KEEP** | Mandatory project governing document. |
| **Repository Root** | `README.md` | System overview, stack architecture, clinical modules | **KEEP** | Primary project documentation. |
| **Release Audit** | `FINAL_RELEASE_AUDIT_REPORT.md` | Root release audit summary report | **KEEP** | Milestone documentation artifact. |
| **Git Config** | `.gitignore` | Standard git ignores for Node, Python, caches | **KEEP** | Critical repository infrastructure. |
| **Agent Customizations**| `.agents/` | Agent skills, rules, and configuration hooks | **KEEP** | Antigravity agent configuration root. |
| **Documentation Root** | `docs/FINISH_CHECKLIST.md` | Step-by-step verification checklist | **KEEP** | Live finish tracker. |
| **Documentation Root** | `docs/HARDCODED_AUDIT.md` | Part G hardcoded audit report (0 MUST FIX) | **KEEP** | Verifiable Part G proof artifact. |
| **Documentation Root** | `docs/REACHABILITY_AUDIT.md`| Zero orphan endpoint and reachability audit | **KEEP** | Core contract & reachability record. |
| **Documentation Root** | `docs/REQUIREMENTS_STATUS.md`| Complete system requirements matrix | **KEEP** | Source of truth for requirements compliance. |
| **Documentation Root** | `docs/ROLE_ACCESS.md` | 7-role access matrix across all routes | **KEEP** | Security & RBAC reference. |
| **Documentation Root** | `docs/RUNNING_LOCALLY.md` | Clean-machine startup runbook | **KEEP** | Local developer guide. |
| **Documentation Root** | `docs/SECURITY_AND_DEPLOYMENT.md`| Security posture, deployment guidelines | **KEEP** | Production operational runbook. |
| **Documentation Root** | `docs/backup_and_restore_runbook.md`| PostgreSQL disaster recovery runbook | **KEEP** | Critical disaster recovery runbook. |
| **Documentation Root** | `docs/PR_DESCRIPTION.md` | Comprehensive PR description & changelog | **KEEP** | Release summary document. |
| **Audit Docx** | `docs/Marlow_Research_and_Audit_Report.docx`| Research report document | **ASK OWNER** | Binary Word document from owner/audit. |
| **Accessibility Report**| `frontend/frontend-accessibility-audit-report.md`| Accessibility audit results across 28 routes | **KEEP** | WCAG 2.1 AA audit record. |
| **Screenshots** | `docs/screenshots/*.png` | Playwright automated visual verification captures | **KEEP** | Visual proof of clinical & reception journeys. |
| **Backup Dumps** | `docs/REACHABILITY_AUDIT.md.bak1` | Backup snapshot during batch edit | **REMOVE** | Redundant backup file. |
| **Backup Dumps** | `docs/ROLE_ACCESS.md.bak1` | Backup snapshot during batch edit | **REMOVE** | Redundant backup file. |
| **Root Scratch Output** | `pytest_out.txt` | Temporary captured pytest stdout dump | **REMOVE** | Temporary output dump. |
| **Root Scratch Output** | `ra_before_out.txt` | Temporary captured reachability audit stdout dump | **REMOVE** | Temporary output dump. |
| **Root Scratch Output** | `dev.log` | Temporary dev server stdout capture | **REMOVE** | Disposable log file. |
| **Frontend Scratch Output**| `frontend/audit-output.txt`| Temporary raw console log from audit | **REMOVE** | Disposable log file. |
| **Seed JS Scratch** | `seed.js` | One-off Node seed test script | **REMOVE** | Superset provided by `python -m app.cli seed-demo`. |
| **Backend Scratch Script**| `backend/_attr.py` | One-off attribute inspection scratch script | **REMOVE** | Temporary inspection script. |
| **Backend Scratch Script**| `backend/_collect.py` | Pytest collector helper script | **REMOVE** | Temporary inspection script. |
| **Backend Scratch Script**| `backend/_count.py` | AST counter helper script | **REMOVE** | Temporary inspection script. |
| **Backend Scratch Script**| `backend/_deep.py` | Temporary AST reachability analysis script | **REMOVE** | Temporary inspection script. |
| **Backend Scratch Script**| `backend/_edit_docs.py` | Temporary batch-edit script for docs | **REMOVE** | Temporary editing script. |
| **Backend Scratch Script**| `backend/_edit_doctor.py` | Temporary AST rewrite script for doctor endpoints | **REMOVE** | Temporary editing script. |
| **Backend Scratch Script**| `backend/_fix_audit.py` | Temporary audit fix script | **REMOVE** | Temporary editing script. |
| **Backend Scratch Script**| `backend/_fix_doctor.py` | Temporary doctor route repair script | **REMOVE** | Temporary editing script. |
| **Backend Scratch Script**| `backend/_fix_doctor2.py` | Temporary doctor route repair script (v2) | **REMOVE** | Temporary editing script. |
| **Backend Scratch Script**| `backend/_list2.py` | Temporary route listing scratch script | **REMOVE** | Temporary inspection script. |
| **Backend Scratch Script**| `backend/_list_guards.py` | Temporary dependency guard checker | **REMOVE** | Temporary inspection script. |
| **Backend Scratch Script**| `backend/_openapi_dump.py`| Temporary OpenAPI JSON dumper | **REMOVE** | Temporary inspection script. |
| **Backend Scratch Script**| `backend/_orig.py` | Temporary backup snippet | **REMOVE** | Temporary inspection script. |
| **Backend Scratch Script**| `backend/_report_doctor.py`| Temporary diagnostic report script | **REMOVE** | Temporary inspection script. |

---

## 2. Complete Alembic Migration Inventory (28 Migrations Total)

The previous claim that only 3 migrations exist was factually incorrect. While 3 migrations were added in a recent phase, the repository contains a continuous chain of **28 migrations** in `backend/alembic/versions`:

| # | Revision ID / Name | Description |
| :-: | :--- | :--- |
| 1 | `0001_initial_appointments.py` | Initial appointments, bookings, and users schema |
| 2 | `0002_admin_auth_and_clinic_cms.py` | CMS pages, services, team members, announcements |
| 3 | `0003_sessions_inactivity.py` | User sessions and inactivity timeout tracking |
| 4 | `a1b2c3d4e5f6_add_booking_lifecycle_timestamps_and_cancellation.py` | Booking lifecycle status timestamps and cancellation reasons |
| 5 | `a2b3c4d5e6f7_appointment_reminders_and_template.py` | Appointment reminders and reminder templates |
| 6 | `a3b4c5d6e7f8_waiting_threshold_setting.py` | Waiting room threshold settings in clinic configuration |
| 7 | `a4c78e1b9f22_add_clinical_notes_table.py` | Structured clinical notes table (SOAP notes) |
| 8 | `a5b6c7d8e9f0_patient_file_number_and_guardian.py` | Patient sequential file numbers (`MD-`) and guardian fields |
| 9 | `a6b7c8d9e0f1_service_recall_interval_days.py` | Preventive recall intervals on clinical services |
| 10 | `a8b9c0d1e2f3_visit_payments.py` | Front desk visit payments and daily cash reconciliation |
| 11 | `b1c2d3e4f5a6_clinical_depth_part_b.py` | Encounters, vitals, prescriptions, referrals |
| 12 | `b2c3d4e5f6a7_patient_medical_alerts_and_history_status.py` | Medical & allergy alerts and history review status |
| 13 | `b5d89f2e7a33_add_unique_current_clinical_note_index.py` | Unique constraint on active clinical note per encounter |
| 14 | `b8c9d0e1f2a3_visit_payment_voiding_and_balance.py` | Visit payment voiding audit trail and balance tracking |
| 15 | `c2d3e4f5a6b7_rename_appointments_to_legacy.py` | Schema normalization renaming appointments to legacy |
| 16 | `c3d4e5f6a7b8_add_requires_password_change_to_users.py` | Forced password change flag on user accounts |
| 17 | `c8f31d20ab47_add_dental_chart_tables.py` | Odontogram dental chart conditions and procedures |
| 18 | `c9d0e1f2a3b4_messaging_provider_quiet_hours_and_patient_opt_out.py` | Quiet hours window, SMS/WhatsApp delivery status, opt-out |
| 19 | `d1f1356f1a35_organization_scaling_erd.py` | Multi-facility organization scaling ERD |
| 20 | `d7e8f9a0b1c2_booking_closures_pause_and_currency.py` | Clinic holiday closures, booking pause toggle, currency config |
| 21 | `d9e01f23a456_normalize_booking_and_task_statuses.py` | Normalization of booking and task status enums |
| 22 | `e0f1a2b3c4d5_reminders_scheduler_channels_and_constraints.py` | Multi-channel automated reminders and Urdu templates |
| 23 | `e1f2a3b4c5d6_link_tasks_and_messages_to_patients.py` | Foreign key linking tasks and messages to patients |
| 24 | `e2a48b9c1d01_add_user_team_member_link.py` | Foreign key link between user accounts and clinical staff |
| 25 | `e8f9a0b1c2d3_provider_availability_and_booking_rules.py` | Clinician shifts, operating hours, and booking capacity rules |
| 26 | `f2a3b4c5d6e7_migrate_messages_sent_to_logged.py` | Data migration standardizing message status values |
| 27 | `f3b59c2e4a11_add_clinical_encounters_table.py` | Clinical encounters table for visit tracking |
| 28 | `f9a0b1c2d3e4_remove_unused_slots_table.py` | Cleanup of legacy unused slots table |

Head revision: `c2d3e4f5a6b7 (head)`

---

## 3. Execution Plan

When authorized by the user:
1. Delete only the 19 identified temporary files (14 `backend/_*.py` scratch scripts, 2 `.bak1` files, 3 root `.txt`/`.log` dumps).
2. Do not touch any permanent documentation, source files, or tests.
3. Run `git status` to verify repository cleanliness.
