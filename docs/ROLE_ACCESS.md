# Marlow Dental - Role Access & Route Authorization Matrix

Backend-only role guard matrix (FastAPI 0.141.1).
Role allow-lists are read from the require_role() closure cells at audit time.

## Guard Label Definitions

| Guard | Meaning |
| :--- | :--- |
| Public (no guard) | no auth dependency at all |
| AUTH_ONLY | bare get_current_user, no role gate |
| STRICT_DOCTOR | require_doctor_strictly (doctor only) |
| DOCTOR_OR_ADMIN | require_doctor (doctor + admin) |
| ADMIN_ONLY | require_admin |
| RECEPTIONIST_OR_ADMIN | require_receptionist |
| ROLE_CHECKER[...] | require_role(...) closure with listed roles |
| ROLES(enum) | require_roles(...) with UserRole enum members |

## API Route Access Matrix

| Method | Path | Guard | Allowed (roles) |
| :--- | :--- | :--- | :--- |
| `GET` | `/admin/announcements` | ROLE_CHECKER[admin, platform owner, super admin] + GET_ANNOUNCEMENT_SERVICE | [admin, platform owner, super admin] |
| `POST` | `/admin/announcements` | ROLE_CHECKER[admin, platform owner, super admin] + GET_ANNOUNCEMENT_SERVICE | [admin, platform owner, super admin] |
| `DELETE` | `/admin/announcements/{announcement_id}` | ROLE_CHECKER[admin, platform owner, super admin] + GET_ANNOUNCEMENT_SERVICE | [admin, platform owner, super admin] |
| `PUT` | `/admin/announcements/{announcement_id}` | ROLE_CHECKER[admin, platform owner, super admin] + GET_ANNOUNCEMENT_SERVICE | [admin, platform owner, super admin] |
| `GET` | `/admin/audit` | ROLE_CHECKER[admin, platform owner, super admin] + GET_ACTIVITY_LOG_REPOSITORY | [admin, platform owner, super admin] |
| `GET` | `/admin/audit/export` | ROLE_CHECKER[admin, platform owner, super admin] + GET_ACTIVITY_LOG_REPOSITORY + AUTH_ONLY | [admin, platform owner, super admin] |
| `GET` | `/admin/booking/affected-bookings` | ROLE_CHECKER[admin, platform owner, super admin] + GET_BOOKING_SETTINGS_SERVICE | [admin, platform owner, super admin] |
| `GET` | `/admin/booking/closures` | ROLE_CHECKER[admin, platform owner, super admin] + GET_BOOKING_SETTINGS_SERVICE | [admin, platform owner, super admin] |
| `POST` | `/admin/booking/closures` | ROLE_CHECKER[admin, platform owner, super admin] + GET_BOOKING_SETTINGS_SERVICE | [admin, platform owner, super admin] |
| `DELETE` | `/admin/booking/closures/{closure_id}` | ROLE_CHECKER[admin, platform owner, super admin] + GET_BOOKING_SETTINGS_SERVICE | [admin, platform owner, super admin] |
| `PUT` | `/admin/booking/closures/{closure_id}` | ROLE_CHECKER[admin, platform owner, super admin] + GET_BOOKING_SETTINGS_SERVICE | [admin, platform owner, super admin] |
| `POST` | `/admin/booking/mode` | ROLE_CHECKER[admin, platform owner, super admin] + GET_BOOKING_SETTINGS_SERVICE | [admin, platform owner, super admin] |
| `GET` | `/admin/booking/provider-availability` | ROLE_CHECKER[admin, platform owner, super admin] + GET_BOOKING_SETTINGS_SERVICE | [admin, platform owner, super admin] |
| `POST` | `/admin/booking/provider-availability` | ROLE_CHECKER[admin, platform owner, super admin] + GET_BOOKING_SETTINGS_SERVICE | [admin, platform owner, super admin] |
| `DELETE` | `/admin/booking/provider-availability/{avail_id}` | ROLE_CHECKER[admin, platform owner, super admin] + GET_BOOKING_SETTINGS_SERVICE | [admin, platform owner, super admin] |
| `GET` | `/admin/booking/provider-time-off` | ROLE_CHECKER[admin, platform owner, super admin] + GET_BOOKING_SETTINGS_SERVICE | [admin, platform owner, super admin] |
| `POST` | `/admin/booking/provider-time-off` | ROLE_CHECKER[admin, platform owner, super admin] + GET_BOOKING_SETTINGS_SERVICE | [admin, platform owner, super admin] |
| `DELETE` | `/admin/booking/provider-time-off/{time_off_id}` | ROLE_CHECKER[admin, platform owner, super admin] + GET_BOOKING_SETTINGS_SERVICE | [admin, platform owner, super admin] |
| `PUT` | `/admin/booking/reminder-template` | ROLE_CHECKER[admin, platform owner, super admin] + GET_BOOKING_SETTINGS_SERVICE | [admin, platform owner, super admin] |
| `POST` | `/admin/booking/reschedule-tasks` | ROLE_CHECKER[admin, platform owner, super admin] + GET_BOOKING_SETTINGS_SERVICE | [admin, platform owner, super admin] |
| `PUT` | `/admin/booking/rules` | ROLE_CHECKER[admin, platform owner, super admin] + GET_BOOKING_SETTINGS_SERVICE | [admin, platform owner, super admin] |
| `GET` | `/admin/booking/settings` | ROLE_CHECKER[admin, platform owner, super admin] + GET_BOOKING_SETTINGS_SERVICE | [admin, platform owner, super admin] |
| `GET` | `/admin/booking/working-hours` | ROLE_CHECKER[admin, platform owner, super admin] + GET_BOOKING_SETTINGS_SERVICE | [admin, platform owner, super admin] |
| `PUT` | `/admin/booking/working-hours` | ROLE_CHECKER[admin, platform owner, super admin] + GET_BOOKING_SETTINGS_SERVICE | [admin, platform owner, super admin] |
| `GET` | `/admin/cms/{section}` | ROLE_CHECKER[admin, platform owner, super admin] + GET_CMS_SERVICE | [admin, platform owner, super admin] |
| `PUT` | `/admin/cms/{section}` | ROLE_CHECKER[admin, platform owner, super admin] + GET_CMS_SERVICE | [admin, platform owner, super admin] |
| `GET` | `/admin/faq` | ROLE_CHECKER[admin, platform owner, super admin] + GET_CMS_SERVICE | [admin, platform owner, super admin] |
| `POST` | `/admin/faq` | ROLE_CHECKER[admin, platform owner, super admin] + GET_CMS_SERVICE | [admin, platform owner, super admin] |
| `PATCH` | `/admin/faq/reorder` | ROLE_CHECKER[admin, platform owner, super admin] + GET_CMS_SERVICE | [admin, platform owner, super admin] |
| `PUT` | `/admin/faq/{faq_id}` | ROLE_CHECKER[admin, platform owner, super admin] + GET_CMS_SERVICE | [admin, platform owner, super admin] |
| `PATCH` | `/admin/faq/{faq_id}/status` | ROLE_CHECKER[admin, platform owner, super admin] + GET_CMS_SERVICE | [admin, platform owner, super admin] |
| `GET` | `/admin/locations` | ROLE_CHECKER[admin, platform owner, super admin] + GET_ORGANIZATION_SERVICE | [admin, platform owner, super admin] |
| `POST` | `/admin/locations` | ROLE_CHECKER[admin, platform owner, super admin] + GET_ORGANIZATION_SERVICE | [admin, platform owner, super admin] |
| `PUT` | `/admin/locations/{location_id}` | ROLE_CHECKER[admin, platform owner, super admin] + GET_ORGANIZATION_SERVICE | [admin, platform owner, super admin] |
| `PATCH` | `/admin/locations/{location_id}/status` | ROLE_CHECKER[admin, platform owner, super admin] + GET_ORGANIZATION_SERVICE | [admin, platform owner, super admin] |
| `POST` | `/admin/media/upload` | ROLE_CHECKER[admin, platform owner, super admin] + GET_STORAGE_SERVICE | [admin, platform owner, super admin] |
| `GET` | `/admin/messaging/logs` | ROLE_CHECKER[admin, platform owner, super admin] + GET_RECEPTION_SERVICE | [admin, platform owner, super admin] |
| `POST` | `/admin/messaging/run-scheduler` | ROLE_CHECKER[admin, platform owner, super admin] + GET_RECEPTION_SERVICE | [admin, platform owner, super admin] |
| `POST` | `/admin/messaging/send-test` | ROLE_CHECKER[admin, platform owner, super admin] + GET_RECEPTION_SERVICE | [admin, platform owner, super admin] |
| `GET` | `/admin/messaging/settings` | ROLE_CHECKER[admin, platform owner, super admin] + GET_RECEPTION_SERVICE | [admin, platform owner, super admin] |
| `PUT` | `/admin/messaging/settings` | ROLE_CHECKER[admin, platform owner, super admin] + GET_RECEPTION_SERVICE | [admin, platform owner, super admin] |
| `POST` | `/admin/messaging/test` | ROLE_CHECKER[admin, platform owner, super admin] + GET_RECEPTION_SERVICE | [admin, platform owner, super admin] |
| `POST` | `/admin/note-templates` | ROLE_CHECKER[admin, doctor] + AUTH_ONLY + GET_DB_SESSION | [admin, doctor] |
| `PUT` | `/admin/note-templates/{template_id}` | ROLE_CHECKER[admin, doctor] + AUTH_ONLY + GET_DB_SESSION | [admin, doctor] |
| `GET` | `/admin/organization` | ROLE_CHECKER[admin, platform owner, super admin] + GET_ORGANIZATION_SERVICE | [admin, platform owner, super admin] |
| `PUT` | `/admin/organization` | ROLE_CHECKER[admin, platform owner, super admin] + GET_ORGANIZATION_SERVICE | [admin, platform owner, super admin] |
| `GET` | `/admin/reports/appointments` | ROLE_CHECKER[admin, platform owner, super admin] + GET_DB_SESSION | [admin, platform owner, super admin] |
| `GET` | `/admin/reports/cancellations-no-shows` | ROLE_CHECKER[admin, platform owner, super admin] + GET_DB_SESSION | [admin, platform owner, super admin] |
| `GET` | `/admin/reports/export/appointments` | ROLE_CHECKER[admin, platform owner, super admin] + GET_DB_SESSION + GET_ACTIVITY_LOG_REPOSITORY + AUTH_ONLY | [admin, platform owner, super admin] |
| `GET` | `/admin/reports/export/cancellations-no-shows` | ROLE_CHECKER[admin, platform owner, super admin] + GET_DB_SESSION + GET_ACTIVITY_LOG_REPOSITORY + AUTH_ONLY | [admin, platform owner, super admin] |
| `GET` | `/admin/reports/export/operational-timing` | ROLE_CHECKER[admin, platform owner, super admin] + GET_DB_SESSION + GET_ACTIVITY_LOG_REPOSITORY + AUTH_ONLY | [admin, platform owner, super admin] |
| `GET` | `/admin/reports/export/recall-compliance` | ROLE_CHECKER[admin, platform owner, super admin] + GET_DB_SESSION + GET_ACTIVITY_LOG_REPOSITORY + AUTH_ONLY | [admin, platform owner, super admin] |
| `GET` | `/admin/reports/operational-timing` | ROLE_CHECKER[admin, platform owner, super admin] + GET_DB_SESSION | [admin, platform owner, super admin] |
| `GET` | `/admin/reports/recall-compliance` | ROLE_CHECKER[admin, platform owner, super admin] + GET_DB_SESSION | [admin, platform owner, super admin] |
| `GET` | `/admin/services` | ROLE_CHECKER[admin, platform owner, super admin] + GET_SERVICE_SERVICE | [admin, platform owner, super admin] |
| `POST` | `/admin/services` | ROLE_CHECKER[admin, platform owner, super admin] + GET_SERVICE_SERVICE | [admin, platform owner, super admin] |
| `PATCH` | `/admin/services/reorder` | ROLE_CHECKER[admin, platform owner, super admin] + GET_SERVICE_SERVICE | [admin, platform owner, super admin] |
| `GET` | `/admin/services/{service_id}` | ROLE_CHECKER[admin, platform owner, super admin] + GET_SERVICE_SERVICE | [admin, platform owner, super admin] |
| `PUT` | `/admin/services/{service_id}` | ROLE_CHECKER[admin, platform owner, super admin] + GET_SERVICE_SERVICE | [admin, platform owner, super admin] |
| `PATCH` | `/admin/services/{service_id}/status` | ROLE_CHECKER[admin, platform owner, super admin] + GET_SERVICE_SERVICE | [admin, platform owner, super admin] |
| `GET` | `/admin/team` | ROLE_CHECKER[admin, platform owner, super admin] + GET_TEAM_SERVICE | [admin, platform owner, super admin] |
| `POST` | `/admin/team` | ROLE_CHECKER[admin, platform owner, super admin] + GET_TEAM_SERVICE | [admin, platform owner, super admin] |
| `PATCH` | `/admin/team/reorder` | ROLE_CHECKER[admin, platform owner, super admin] + GET_TEAM_SERVICE | [admin, platform owner, super admin] |
| `GET` | `/admin/team/{member_id}` | ROLE_CHECKER[admin, platform owner, super admin] + GET_TEAM_SERVICE | [admin, platform owner, super admin] |
| `PUT` | `/admin/team/{member_id}` | ROLE_CHECKER[admin, platform owner, super admin] + GET_TEAM_SERVICE | [admin, platform owner, super admin] |
| `PATCH` | `/admin/team/{member_id}/status` | ROLE_CHECKER[admin, platform owner, super admin] + GET_TEAM_SERVICE | [admin, platform owner, super admin] |
| `GET` | `/admin/users` | ROLE_CHECKER[admin, platform owner, super admin] + GET_USER_REPOSITORY | [admin, platform owner, super admin] |
| `POST` | `/admin/users` | ROLE_CHECKER[admin, platform owner, super admin] + GET_USER_REPOSITORY + GET_ACTIVITY_LOG_REPOSITORY | [admin, platform owner, super admin] |
| `GET` | `/admin/users/{id}` | ROLE_CHECKER[admin, platform owner, super admin] + GET_USER_REPOSITORY | [admin, platform owner, super admin] |
| `PATCH` | `/admin/users/{id}` | ROLE_CHECKER[admin, platform owner, super admin] + GET_USER_REPOSITORY + GET_ACTIVITY_LOG_REPOSITORY | [admin, platform owner, super admin] |
| `POST` | `/admin/users/{id}/reset-password` | ROLE_CHECKER[admin, platform owner, super admin] + GET_USER_REPOSITORY + GET_SESSION_REPOSITORY + GET_REFRESH_TOKEN_REPOSITORY + GET_ACTIVITY_LOG_REPOSITORY | [admin, platform owner, super admin] |
| `PATCH` | `/admin/users/{id}/role` | ROLE_CHECKER[admin, platform owner, super admin] + GET_USER_REPOSITORY + GET_ACTIVITY_LOG_REPOSITORY | [admin, platform owner, super admin] |
| `PATCH` | `/admin/users/{id}/status` | ROLE_CHECKER[admin, platform owner, super admin] + GET_USER_REPOSITORY + GET_SESSION_REPOSITORY + GET_REFRESH_TOKEN_REPOSITORY + GET_ACTIVITY_LOG_REPOSITORY | [admin, platform owner, super admin] |
| `POST` | `/appointments` | GET_APPOINTMENT_SERVICE | (public - no auth) |
| `GET` | `/attachments/patient/{patient_id}` | ROLE_CHECKER[admin, doctor, receptionist] + AUTH_ONLY + GET_DB_SESSION | [admin, doctor, receptionist] |
| `POST` | `/attachments/upload` | ROLE_CHECKER[doctor, receptionist] + AUTH_ONLY + GET_DB_SESSION | [doctor, receptionist] |
| `GET` | `/attachments/{attachment_id}/download` | ROLE_CHECKER[admin, doctor, receptionist] + AUTH_ONLY + GET_DB_SESSION | [admin, doctor, receptionist] |
| `POST` | `/attachments/{attachment_id}/void` | ROLE_CHECKER[doctor] + AUTH_ONLY + GET_DB_SESSION | [doctor] |
| `POST` | `/auth/change-password` | AUTH_ONLY + GET_AUTH_SERVICE | [any authenticated user] |
| `PATCH` | `/auth/inactivity-settings` | AUTH_ONLY + GET_AUTH_SERVICE | [any authenticated user] |
| `POST` | `/auth/login` | GET_AUTH_SERVICE | (public - no auth) |
| `POST` | `/auth/logout` | GET_AUTH_SERVICE | (public - no auth) |
| `GET` | `/auth/me` | AUTH_ONLY | [any authenticated user] |
| `POST` | `/auth/refresh` | GET_AUTH_SERVICE | (public - no auth) |
| `GET` | `/clinical-note-templates` | ROLE_CHECKER[admin, doctor] + AUTH_ONLY + GET_DB_SESSION | [admin, doctor] |
| `POST` | `/clinical/alerts/{alert_id}/confirm` | ROLE_CHECKER[doctor] + GET_MEDICAL_ALERT_SERVICE | [doctor] |
| `POST` | `/clinical/alerts/{alert_id}/dismiss` | ROLE_CHECKER[doctor] + GET_MEDICAL_ALERT_SERVICE | [doctor] |
| `GET` | `/clinical/patients/{patient_id}/alerts` | ROLE_CHECKER[admin, doctor, super admin] + GET_MEDICAL_ALERT_SERVICE | [admin, doctor, super admin] |
| `POST` | `/clinical/patients/{patient_id}/alerts` | ROLE_CHECKER[doctor] + GET_MEDICAL_ALERT_SERVICE | [doctor] |
| `POST` | `/clinical/patients/{patient_id}/alerts/review` | ROLE_CHECKER[doctor] + GET_MEDICAL_ALERT_SERVICE | [doctor] |
| `PATCH` | `/clinical/patients/{patient_id}/medical-history-status` | ROLE_CHECKER[doctor] + GET_MEDICAL_ALERT_SERVICE | [doctor] |
| `POST` | `/consents` | ROLE_CHECKER[doctor] + AUTH_ONLY + GET_DB_SESSION | [doctor] |
| `GET` | `/consents/patient/{patient_id}` | ROLE_CHECKER[admin, doctor, receptionist] + AUTH_ONLY + GET_DB_SESSION | [admin, doctor, receptionist] |
| `POST` | `/consents/{consent_id}/void` | ROLE_CHECKER[doctor] + AUTH_ONLY + GET_DB_SESSION | [doctor] |
| `GET` | `/doctor/appointments/{id}` | ROLE_CHECKER[admin, doctor, super admin] + GET_DOCTOR_SERVICE + GET_VISIT_PAYMENT_REPOSITORY | [admin, doctor, super admin] |
| `POST` | `/doctor/appointments/{id}/finish` | ROLE_CHECKER[admin, doctor, super admin] + ROLE_CHECKER[doctor] + GET_DOCTOR_SERVICE + GET_ENCOUNTER_SERVICE + GET_RECEPTION_SERVICE | [doctor] |
| `PATCH` | `/doctor/appointments/{id}/notes` | ROLE_CHECKER[admin, doctor, super admin] + ROLE_CHECKER[doctor] + GET_DOCTOR_SERVICE | [doctor] |
| `POST` | `/doctor/appointments/{id}/start` | ROLE_CHECKER[admin, doctor, super admin] + ROLE_CHECKER[doctor] + GET_RECEPTION_SERVICE + GET_DOCTOR_SERVICE | [doctor] |
| `PATCH` | `/doctor/chart/findings/{finding_id}` | ROLE_CHECKER[admin, doctor, super admin] + ROLE_CHECKER[doctor] + GET_DENTAL_CHART_SERVICE | [doctor] |
| `POST` | `/doctor/chart/findings/{finding_id}/resolve` | ROLE_CHECKER[admin, doctor, super admin] + ROLE_CHECKER[doctor] + GET_DENTAL_CHART_SERVICE | [doctor] |
| `PATCH` | `/doctor/chart/procedures/{procedure_id}/status` | ROLE_CHECKER[admin, doctor, super admin] + ROLE_CHECKER[doctor] + GET_DENTAL_CHART_SERVICE | [doctor] |
| `POST` | `/doctor/clinical-notes/{note_id}/apply-template` | ROLE_CHECKER[doctor] + AUTH_ONLY + GET_DB_SESSION | [doctor] |
| `POST` | `/doctor/documents/prescriptions` | ROLE_CHECKER[doctor] + AUTH_ONLY + GET_DB_SESSION | [doctor] |
| `GET` | `/doctor/documents/prescriptions/encounter/{encounter_id}` | ROLE_CHECKER[admin, doctor] + AUTH_ONLY + GET_DB_SESSION | [admin, doctor] |
| `GET` | `/doctor/documents/prescriptions/{prescription_id}/print` | ROLE_CHECKER[admin, doctor] + AUTH_ONLY + GET_DB_SESSION + GET_ORGANIZATION_REPOSITORY | [admin, doctor] |
| `POST` | `/doctor/documents/prescriptions/{prescription_id}/sign` | ROLE_CHECKER[doctor] + AUTH_ONLY + GET_DB_SESSION | [doctor] |
| `POST` | `/doctor/documents/referrals` | ROLE_CHECKER[doctor] + AUTH_ONLY + GET_DB_SESSION | [doctor] |
| `GET` | `/doctor/documents/referrals/encounter/{encounter_id}` | ROLE_CHECKER[admin, doctor] + AUTH_ONLY + GET_DB_SESSION | [admin, doctor] |
| `GET` | `/doctor/documents/referrals/{referral_id}/print` | ROLE_CHECKER[admin, doctor] + AUTH_ONLY + GET_DB_SESSION + GET_ORGANIZATION_REPOSITORY | [admin, doctor] |
| `POST` | `/doctor/documents/referrals/{referral_id}/sign` | ROLE_CHECKER[doctor] + AUTH_ONLY + GET_DB_SESSION | [doctor] |
| `POST` | `/doctor/encounters` | ROLE_CHECKER[admin, doctor, super admin] + ROLE_CHECKER[doctor] + GET_ENCOUNTER_SERVICE | [doctor] |
| `GET` | `/doctor/encounters/by-booking/{booking_id}` | ROLE_CHECKER[admin, doctor, super admin] + GET_ENCOUNTER_SERVICE + GET_ACTIVITY_LOG_REPOSITORY | [admin, doctor, super admin] |
| `GET` | `/doctor/encounters/{id}` | ROLE_CHECKER[admin, doctor, super admin] + GET_ENCOUNTER_SERVICE + GET_ACTIVITY_LOG_REPOSITORY | [admin, doctor, super admin] |
| `GET` | `/doctor/encounters/{id}/chart` | ROLE_CHECKER[admin, doctor, super admin] + GET_DENTAL_CHART_SERVICE + GET_ACTIVITY_LOG_REPOSITORY | [admin, doctor, super admin] |
| `POST` | `/doctor/encounters/{id}/chart/findings` | ROLE_CHECKER[admin, doctor, super admin] + ROLE_CHECKER[doctor] + GET_DENTAL_CHART_SERVICE | [doctor] |
| `POST` | `/doctor/encounters/{id}/chart/procedures` | ROLE_CHECKER[admin, doctor, super admin] + ROLE_CHECKER[doctor] + GET_DENTAL_CHART_SERVICE | [doctor] |
| `GET` | `/doctor/encounters/{id}/note` | ROLE_CHECKER[admin, doctor, super admin] + GET_CLINICAL_NOTE_SERVICE + GET_ACTIVITY_LOG_REPOSITORY | [admin, doctor, super admin] |
| `POST` | `/doctor/encounters/{id}/note/amend` | ROLE_CHECKER[admin, doctor, super admin] + ROLE_CHECKER[doctor] + GET_CLINICAL_NOTE_SERVICE | [doctor] |
| `PUT` | `/doctor/encounters/{id}/note/draft` | ROLE_CHECKER[admin, doctor, super admin] + ROLE_CHECKER[doctor] + GET_CLINICAL_NOTE_SERVICE | [doctor] |
| `GET` | `/doctor/encounters/{id}/note/revisions` | ROLE_CHECKER[admin, doctor, super admin] + GET_CLINICAL_NOTE_SERVICE + GET_ACTIVITY_LOG_REPOSITORY | [admin, doctor, super admin] |
| `POST` | `/doctor/encounters/{id}/note/sign` | ROLE_CHECKER[admin, doctor, super admin] + ROLE_CHECKER[doctor] + GET_CLINICAL_NOTE_SERVICE | [doctor] |
| `PATCH` | `/doctor/encounters/{id}/status` | ROLE_CHECKER[admin, doctor, super admin] + ROLE_CHECKER[doctor] + GET_ENCOUNTER_SERVICE | [doctor] |
| `GET` | `/doctor/patients` | ROLE_CHECKER[admin, doctor, super admin] + GET_PATIENT_REPOSITORY | [admin, doctor, super admin] |
| `GET` | `/doctor/patients/{patient_id}` | ROLE_CHECKER[admin, doctor, super admin] + GET_PATIENT_REPOSITORY + GET_BOOKING_REPOSITORY + GET_ENCOUNTER_REPOSITORY | [admin, doctor, super admin] |
| `GET` | `/doctor/patients/{patient_id}/chart` | ROLE_CHECKER[admin, doctor, super admin] + GET_DENTAL_CHART_SERVICE + GET_ACTIVITY_LOG_REPOSITORY | [admin, doctor, super admin] |
| `GET` | `/doctor/patients/{patient_id}/chart/history` | ROLE_CHECKER[admin, doctor, super admin] + GET_DENTAL_CHART_SERVICE + GET_ACTIVITY_LOG_REPOSITORY | [admin, doctor, super admin] |
| `GET` | `/doctor/patients/{patient_id}/encounters` | ROLE_CHECKER[admin, doctor, super admin] + GET_ENCOUNTER_SERVICE + GET_ACTIVITY_LOG_REPOSITORY | [admin, doctor, super admin] |
| `GET` | `/doctor/schedule` | ROLE_CHECKER[admin, doctor, super admin] + GET_DOCTOR_SERVICE + GET_MEDICAL_ALERT_SERVICE + GET_VISIT_PAYMENT_REPOSITORY | [admin, doctor, super admin] |
| `GET` | `/doctor/tasks` | ROLE_CHECKER[admin, doctor] + AUTH_ONLY + GET_DB_SESSION | [admin, doctor] |
| `POST` | `/doctor/tasks` | ROLE_CHECKER[admin, doctor] + AUTH_ONLY + GET_DB_SESSION | [admin, doctor] |
| `POST` | `/doctor/tasks/{task_id}/done` | ROLE_CHECKER[admin, doctor] + AUTH_ONLY + GET_DB_SESSION | [admin, doctor] |
| `POST` | `/doctor/treatment-plans` | ROLE_CHECKER[doctor] + AUTH_ONLY + GET_DB_SESSION | [doctor] |
| `GET` | `/doctor/treatment-plans/patient/{patient_id}` | ROLE_CHECKER[admin, doctor] + AUTH_ONLY + GET_DB_SESSION | [admin, doctor] |
| `PATCH` | `/doctor/treatment-plans/{item_id}/status` | ROLE_CHECKER[doctor] + AUTH_ONLY + GET_DB_SESSION | [doctor] |
| `GET` | `/doctor/unsigned-notes` | ROLE_CHECKER[admin, doctor, super admin] + GET_ENCOUNTER_SERVICE | [admin, doctor, super admin] |
| `GET` | `/health` | Public (no guard) | (public - no auth) |
| `GET` | `/health` | Public (no guard) | (public - no auth) |
| `GET` | `/public/announcements` | GET_ANNOUNCEMENT_SERVICE | (public - no auth) |
| `GET` | `/public/availability` | GET_AVAILABILITY_SERVICE | (public - no auth) |
| `GET` | `/public/booking-schedule` | GET_BOOKING_SETTINGS_SERVICE | (public - no auth) |
| `GET` | `/public/booking-status` | GET_BOOKING_SETTINGS_SERVICE | (public - no auth) |
| `GET` | `/public/clinics` | GET_ORGANIZATION_SERVICE | (public - no auth) |
| `GET` | `/public/content` | GET_CMS_SERVICE | (public - no auth) |
| `GET` | `/public/faq` | GET_CMS_SERVICE | (public - no auth) |
| `GET` | `/public/locations` | GET_ORGANIZATION_SERVICE | (public - no auth) |
| `GET` | `/public/organization` | GET_ORGANIZATION_SERVICE | (public - no auth) |
| `GET` | `/public/services` | GET_SERVICE_SERVICE | (public - no auth) |
| `GET` | `/public/team` | GET_TEAM_SERVICE | (public - no auth) |
| `GET` | `/public/working-hours` | GET_BOOKING_SETTINGS_SERVICE | (public - no auth) |
| `GET` | `/reception/appointments` | ROLE_CHECKER[admin, clinic branch manager, receptionist, super admin] + GET_RECEPTION_SERVICE | [admin, clinic branch manager, receptionist, super admin] |
| `POST` | `/reception/appointments` | ROLE_CHECKER[admin, clinic branch manager, receptionist, super admin] + GET_RECEPTION_SERVICE | [admin, clinic branch manager, receptionist, super admin] |
| `GET` | `/reception/appointments/{id}/payments` | ROLE_CHECKER[admin, clinic branch manager, receptionist, super admin] + GET_RECEPTION_SERVICE | [admin, clinic branch manager, receptionist, super admin] |
| `POST` | `/reception/appointments/{id}/payments` | ROLE_CHECKER[admin, clinic branch manager, receptionist, super admin] + GET_RECEPTION_SERVICE | [admin, clinic branch manager, receptionist, super admin] |
| `POST` | `/reception/appointments/{id}/payments/{payment_id}/void` | ROLE_CHECKER[admin, clinic branch manager, receptionist, super admin] + GET_RECEPTION_SERVICE | [admin, clinic branch manager, receptionist, super admin] |
| `POST` | `/reception/appointments/{id}/remind` | ROLE_CHECKER[admin, clinic branch manager, receptionist, super admin] + GET_RECEPTION_SERVICE | [admin, clinic branch manager, receptionist, super admin] |
| `PATCH` | `/reception/appointments/{id}/reschedule` | ROLE_CHECKER[admin, clinic branch manager, receptionist, super admin] + GET_RECEPTION_SERVICE | [admin, clinic branch manager, receptionist, super admin] |
| `PATCH` | `/reception/appointments/{id}/status` | ROLE_CHECKER[admin, clinic branch manager, receptionist, super admin] + GET_RECEPTION_SERVICE | [admin, clinic branch manager, receptionist, super admin] |
| `GET` | `/reception/appointments/{id}/waitlist-offers` | ROLE_CHECKER[admin, clinic branch manager, receptionist, super admin] + GET_RECEPTION_SERVICE | [admin, clinic branch manager, receptionist, super admin] |
| `POST` | `/reception/appointments/{id}/waitlist-offers/create-task` | ROLE_CHECKER[admin, clinic branch manager, receptionist, super admin] + GET_RECEPTION_SERVICE | [admin, clinic branch manager, receptionist, super admin] |
| `GET` | `/reception/dashboard` | ROLE_CHECKER[admin, clinic branch manager, receptionist, super admin] + GET_RECEPTION_SERVICE | [admin, clinic branch manager, receptionist, super admin] |
| `POST` | `/reception/dashboard/snooze` | ROLE_CHECKER[admin, clinic branch manager, receptionist, super admin] + GET_RECEPTION_SERVICE | [admin, clinic branch manager, receptionist, super admin] |
| `GET` | `/reception/end-of-day/payments-summary` | ROLE_CHECKER[admin, clinic branch manager, receptionist, super admin] + GET_RECEPTION_SERVICE | [admin, clinic branch manager, receptionist, super admin] |
| `POST` | `/reception/end-of-day/resolve` | ROLE_CHECKER[admin, clinic branch manager, receptionist, super admin] + GET_RECEPTION_SERVICE | [admin, clinic branch manager, receptionist, super admin] |
| `GET` | `/reception/end-of-day/unresolved` | ROLE_CHECKER[admin, clinic branch manager, receptionist, super admin] + GET_RECEPTION_SERVICE | [admin, clinic branch manager, receptionist, super admin] |
| `GET` | `/reception/leads` | ROLE_CHECKER[admin, clinic branch manager, receptionist, super admin] + GET_RECEPTION_SERVICE | [admin, clinic branch manager, receptionist, super admin] |
| `POST` | `/reception/leads` | ROLE_CHECKER[admin, clinic branch manager, receptionist, super admin] + GET_RECEPTION_SERVICE | [admin, clinic branch manager, receptionist, super admin] |
| `PATCH` | `/reception/leads/{id}` | ROLE_CHECKER[admin, clinic branch manager, receptionist, super admin] + GET_RECEPTION_SERVICE | [admin, clinic branch manager, receptionist, super admin] |
| `POST` | `/reception/leads/{id}/convert` | ROLE_CHECKER[admin, clinic branch manager, receptionist, super admin] + GET_RECEPTION_SERVICE | [admin, clinic branch manager, receptionist, super admin] |
| `GET` | `/reception/messages` | ROLE_CHECKER[admin, clinic branch manager, receptionist, super admin] + GET_RECEPTION_SERVICE | [admin, clinic branch manager, receptionist, super admin] |
| `POST` | `/reception/messages` | ROLE_CHECKER[admin, clinic branch manager, receptionist, super admin] + GET_RECEPTION_SERVICE | [admin, clinic branch manager, receptionist, super admin] |
| `GET` | `/reception/patients` | ROLE_CHECKER[admin, clinic branch manager, receptionist, super admin] + GET_RECEPTION_SERVICE + GET_MEDICAL_ALERT_SERVICE | [admin, clinic branch manager, receptionist, super admin] |
| `POST` | `/reception/patients` | ROLE_CHECKER[admin, clinic branch manager, receptionist, super admin] + GET_RECEPTION_SERVICE | [admin, clinic branch manager, receptionist, super admin] |
| `GET` | `/reception/patients/{id}` | ROLE_CHECKER[admin, clinic branch manager, receptionist, super admin] + GET_RECEPTION_SERVICE + GET_MEDICAL_ALERT_SERVICE | [admin, clinic branch manager, receptionist, super admin] |
| `PATCH` | `/reception/patients/{id}` | ROLE_CHECKER[admin, clinic branch manager, receptionist, super admin] + GET_RECEPTION_SERVICE | [admin, clinic branch manager, receptionist, super admin] |
| `PATCH` | `/reception/patients/{id}/messaging-opt-out` | ROLE_CHECKER[admin, clinic branch manager, receptionist, super admin] + GET_RECEPTION_SERVICE | [admin, clinic branch manager, receptionist, super admin] |
| `POST` | `/reception/patients/{patient_id}/pending-alerts` | ROLE_CHECKER[admin, clinic branch manager, receptionist, super admin] + ROLE_CHECKER[clinic branch manager, receptionist] + GET_MEDICAL_ALERT_SERVICE | [clinic branch manager, receptionist] |
| `GET` | `/reception/recalls` | ROLE_CHECKER[admin, clinic branch manager, receptionist, super admin] + GET_RECEPTION_SERVICE | [admin, clinic branch manager, receptionist, super admin] |
| `POST` | `/reception/recalls/tasks` | ROLE_CHECKER[admin, clinic branch manager, receptionist, super admin] + GET_RECEPTION_SERVICE | [admin, clinic branch manager, receptionist, super admin] |
| `GET` | `/reception/reminders` | ROLE_CHECKER[admin, clinic branch manager, receptionist, super admin] + GET_RECEPTION_SERVICE | [admin, clinic branch manager, receptionist, super admin] |
| `GET` | `/reception/schedule` | ROLE_CHECKER[admin, clinic branch manager, receptionist, super admin] + GET_RECEPTION_SERVICE | [admin, clinic branch manager, receptionist, super admin] |
| `GET` | `/reception/tasks` | ROLE_CHECKER[admin, clinic branch manager, receptionist, super admin] + GET_RECEPTION_SERVICE | [admin, clinic branch manager, receptionist, super admin] |
| `POST` | `/reception/tasks` | ROLE_CHECKER[admin, clinic branch manager, receptionist, super admin] + GET_RECEPTION_SERVICE | [admin, clinic branch manager, receptionist, super admin] |
| `PATCH` | `/reception/tasks/{id}` | ROLE_CHECKER[admin, clinic branch manager, receptionist, super admin] + GET_RECEPTION_SERVICE | [admin, clinic branch manager, receptionist, super admin] |
| `GET` | `/reception/waitlist` | ROLE_CHECKER[admin, clinic branch manager, receptionist, super admin] + GET_RECEPTION_SERVICE | [admin, clinic branch manager, receptionist, super admin] |