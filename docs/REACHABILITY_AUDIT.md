# Marlow Dental - Backend Route Reachability Audit

Automated audit of every FastAPI route under _IncludedRouter (FastAPI 0.141.1, app.openapi() + dependant.dependencies).
Role allow-lists are extracted from the require_role() closure cells, so the guard column shows the real permitted roles.

## Audit Summary & Counts

| Metric | Count |
| :--- | :---: |
| **Total routes** | 184 |
| **READ routes** | 83 |
| **WRITE routes** | 101 |
| **Public routes (no auth dependency)** | 18 |
| **Authenticated but no role gate** | 3 |

## Public / Unauthenticated Routes (review each: must be intentional)

| Method | Path | Kind | Note |
| :--- | :--- | :--- | :--- |
| `POST` | `/appointments` | WRITE | public booking form (rate-limited via slowapi) |
| `POST` | `/auth/login` | WRITE | login/register flow |
| `POST` | `/auth/logout` | WRITE | login/register flow |
| `POST` | `/auth/refresh` | WRITE | login/register flow |
| `GET` | `/health` | READ | liveness/readiness probe |
| `GET` | `/health` | READ | liveness/readiness probe |
| `GET` | `/public/announcements` | READ | public website content |
| `GET` | `/public/availability` | READ | public website content |
| `GET` | `/public/booking-schedule` | READ | public website content |
| `GET` | `/public/booking-status` | READ | public website content |
| `GET` | `/public/clinics` | READ | public website content |
| `GET` | `/public/content` | READ | public website content |
| `GET` | `/public/faq` | READ | public website content |
| `GET` | `/public/locations` | READ | public website content |
| `GET` | `/public/organization` | READ | public website content |
| `GET` | `/public/services` | READ | public website content |
| `GET` | `/public/team` | READ | public website content |
| `GET` | `/public/working-hours` | READ | public website content |

## Authenticated Routes Without Role Gate (any logged-in user)

| Method | Path | Kind |
| :--- | :--- | :--- |
| `POST` | `/auth/change-password` | WRITE |
| `PATCH` | `/auth/inactivity-settings` | WRITE |
| `GET` | `/auth/me` | READ |

## Backend OpenAPI Routes & Role Guards

| Method | Path | Guard | Kind | Allowed roles |
| :--- | :--- | :--- | :--- | :--- |
| `GET` | `/admin/announcements` | ROLE_CHECKER[admin, platform owner, super admin] + GET_ANNOUNCEMENT_SERVICE | READ | admin, platform owner, super admin |
| `POST` | `/admin/announcements` | ROLE_CHECKER[admin, platform owner, super admin] + GET_ANNOUNCEMENT_SERVICE | WRITE | admin, platform owner, super admin |
| `DELETE` | `/admin/announcements/{announcement_id}` | ROLE_CHECKER[admin, platform owner, super admin] + GET_ANNOUNCEMENT_SERVICE | WRITE | admin, platform owner, super admin |
| `PUT` | `/admin/announcements/{announcement_id}` | ROLE_CHECKER[admin, platform owner, super admin] + GET_ANNOUNCEMENT_SERVICE | WRITE | admin, platform owner, super admin |
| `GET` | `/admin/audit` | ROLE_CHECKER[admin, platform owner, super admin] + GET_ACTIVITY_LOG_REPOSITORY | READ | admin, platform owner, super admin |
| `GET` | `/admin/audit/export` | ROLE_CHECKER[admin, platform owner, super admin] + GET_ACTIVITY_LOG_REPOSITORY + AUTH_ONLY | READ | admin, platform owner, super admin |
| `GET` | `/admin/booking/affected-bookings` | ROLE_CHECKER[admin, platform owner, super admin] + GET_BOOKING_SETTINGS_SERVICE | READ | admin, platform owner, super admin |
| `GET` | `/admin/booking/closures` | ROLE_CHECKER[admin, platform owner, super admin] + GET_BOOKING_SETTINGS_SERVICE | READ | admin, platform owner, super admin |
| `POST` | `/admin/booking/closures` | ROLE_CHECKER[admin, platform owner, super admin] + GET_BOOKING_SETTINGS_SERVICE | WRITE | admin, platform owner, super admin |
| `DELETE` | `/admin/booking/closures/{closure_id}` | ROLE_CHECKER[admin, platform owner, super admin] + GET_BOOKING_SETTINGS_SERVICE | WRITE | admin, platform owner, super admin |
| `PUT` | `/admin/booking/closures/{closure_id}` | ROLE_CHECKER[admin, platform owner, super admin] + GET_BOOKING_SETTINGS_SERVICE | WRITE | admin, platform owner, super admin |
| `POST` | `/admin/booking/mode` | ROLE_CHECKER[admin, platform owner, super admin] + GET_BOOKING_SETTINGS_SERVICE | WRITE | admin, platform owner, super admin |
| `GET` | `/admin/booking/provider-availability` | ROLE_CHECKER[admin, platform owner, super admin] + GET_BOOKING_SETTINGS_SERVICE | READ | admin, platform owner, super admin |
| `POST` | `/admin/booking/provider-availability` | ROLE_CHECKER[admin, platform owner, super admin] + GET_BOOKING_SETTINGS_SERVICE | WRITE | admin, platform owner, super admin |
| `DELETE` | `/admin/booking/provider-availability/{avail_id}` | ROLE_CHECKER[admin, platform owner, super admin] + GET_BOOKING_SETTINGS_SERVICE | WRITE | admin, platform owner, super admin |
| `GET` | `/admin/booking/provider-time-off` | ROLE_CHECKER[admin, platform owner, super admin] + GET_BOOKING_SETTINGS_SERVICE | READ | admin, platform owner, super admin |
| `POST` | `/admin/booking/provider-time-off` | ROLE_CHECKER[admin, platform owner, super admin] + GET_BOOKING_SETTINGS_SERVICE | WRITE | admin, platform owner, super admin |
| `DELETE` | `/admin/booking/provider-time-off/{time_off_id}` | ROLE_CHECKER[admin, platform owner, super admin] + GET_BOOKING_SETTINGS_SERVICE | WRITE | admin, platform owner, super admin |
| `PUT` | `/admin/booking/reminder-template` | ROLE_CHECKER[admin, platform owner, super admin] + GET_BOOKING_SETTINGS_SERVICE | WRITE | admin, platform owner, super admin |
| `POST` | `/admin/booking/reschedule-tasks` | ROLE_CHECKER[admin, platform owner, super admin] + GET_BOOKING_SETTINGS_SERVICE | WRITE | admin, platform owner, super admin |
| `PUT` | `/admin/booking/rules` | ROLE_CHECKER[admin, platform owner, super admin] + GET_BOOKING_SETTINGS_SERVICE | WRITE | admin, platform owner, super admin |
| `GET` | `/admin/booking/settings` | ROLE_CHECKER[admin, platform owner, super admin] + GET_BOOKING_SETTINGS_SERVICE | READ | admin, platform owner, super admin |
| `GET` | `/admin/booking/working-hours` | ROLE_CHECKER[admin, platform owner, super admin] + GET_BOOKING_SETTINGS_SERVICE | READ | admin, platform owner, super admin |
| `PUT` | `/admin/booking/working-hours` | ROLE_CHECKER[admin, platform owner, super admin] + GET_BOOKING_SETTINGS_SERVICE | WRITE | admin, platform owner, super admin |
| `GET` | `/admin/cms/{section}` | ROLE_CHECKER[admin, platform owner, super admin] + GET_CMS_SERVICE | READ | admin, platform owner, super admin |
| `PUT` | `/admin/cms/{section}` | ROLE_CHECKER[admin, platform owner, super admin] + GET_CMS_SERVICE | WRITE | admin, platform owner, super admin |
| `GET` | `/admin/faq` | ROLE_CHECKER[admin, platform owner, super admin] + GET_CMS_SERVICE | READ | admin, platform owner, super admin |
| `POST` | `/admin/faq` | ROLE_CHECKER[admin, platform owner, super admin] + GET_CMS_SERVICE | WRITE | admin, platform owner, super admin |
| `PATCH` | `/admin/faq/reorder` | ROLE_CHECKER[admin, platform owner, super admin] + GET_CMS_SERVICE | WRITE | admin, platform owner, super admin |
| `PUT` | `/admin/faq/{faq_id}` | ROLE_CHECKER[admin, platform owner, super admin] + GET_CMS_SERVICE | WRITE | admin, platform owner, super admin |
| `PATCH` | `/admin/faq/{faq_id}/status` | ROLE_CHECKER[admin, platform owner, super admin] + GET_CMS_SERVICE | WRITE | admin, platform owner, super admin |
| `GET` | `/admin/locations` | ROLE_CHECKER[admin, platform owner, super admin] + GET_ORGANIZATION_SERVICE | READ | admin, platform owner, super admin |
| `POST` | `/admin/locations` | ROLE_CHECKER[admin, platform owner, super admin] + GET_ORGANIZATION_SERVICE | WRITE | admin, platform owner, super admin |
| `PUT` | `/admin/locations/{location_id}` | ROLE_CHECKER[admin, platform owner, super admin] + GET_ORGANIZATION_SERVICE | WRITE | admin, platform owner, super admin |
| `PATCH` | `/admin/locations/{location_id}/status` | ROLE_CHECKER[admin, platform owner, super admin] + GET_ORGANIZATION_SERVICE | WRITE | admin, platform owner, super admin |
| `POST` | `/admin/media/upload` | ROLE_CHECKER[admin, platform owner, super admin] + GET_STORAGE_SERVICE | WRITE | admin, platform owner, super admin |
| `GET` | `/admin/messaging/logs` | ROLE_CHECKER[admin, platform owner, super admin] + GET_RECEPTION_SERVICE | READ | admin, platform owner, super admin |
| `POST` | `/admin/messaging/run-scheduler` | ROLE_CHECKER[admin, platform owner, super admin] + GET_RECEPTION_SERVICE | WRITE | admin, platform owner, super admin |
| `POST` | `/admin/messaging/send-test` | ROLE_CHECKER[admin, platform owner, super admin] + GET_RECEPTION_SERVICE | WRITE | admin, platform owner, super admin |
| `GET` | `/admin/messaging/settings` | ROLE_CHECKER[admin, platform owner, super admin] + GET_RECEPTION_SERVICE | READ | admin, platform owner, super admin |
| `PUT` | `/admin/messaging/settings` | ROLE_CHECKER[admin, platform owner, super admin] + GET_RECEPTION_SERVICE | WRITE | admin, platform owner, super admin |
| `POST` | `/admin/messaging/test` | ROLE_CHECKER[admin, platform owner, super admin] + GET_RECEPTION_SERVICE | WRITE | admin, platform owner, super admin |
| `POST` | `/admin/note-templates` | ROLE_CHECKER[admin, doctor] + AUTH_ONLY + GET_DB_SESSION | WRITE | admin, doctor |
| `PUT` | `/admin/note-templates/{template_id}` | ROLE_CHECKER[admin, doctor] + AUTH_ONLY + GET_DB_SESSION | WRITE | admin, doctor |
| `GET` | `/admin/organization` | ROLE_CHECKER[admin, platform owner, super admin] + GET_ORGANIZATION_SERVICE | READ | admin, platform owner, super admin |
| `PUT` | `/admin/organization` | ROLE_CHECKER[admin, platform owner, super admin] + GET_ORGANIZATION_SERVICE | WRITE | admin, platform owner, super admin |
| `GET` | `/admin/reports/appointments` | ROLE_CHECKER[admin, platform owner, super admin] + GET_DB_SESSION | READ | admin, platform owner, super admin |
| `GET` | `/admin/reports/cancellations-no-shows` | ROLE_CHECKER[admin, platform owner, super admin] + GET_DB_SESSION | READ | admin, platform owner, super admin |
| `GET` | `/admin/reports/export/appointments` | ROLE_CHECKER[admin, platform owner, super admin] + GET_DB_SESSION + GET_ACTIVITY_LOG_REPOSITORY + AUTH_ONLY | READ | admin, platform owner, super admin |
| `GET` | `/admin/reports/export/cancellations-no-shows` | ROLE_CHECKER[admin, platform owner, super admin] + GET_DB_SESSION + GET_ACTIVITY_LOG_REPOSITORY + AUTH_ONLY | READ | admin, platform owner, super admin |
| `GET` | `/admin/reports/export/operational-timing` | ROLE_CHECKER[admin, platform owner, super admin] + GET_DB_SESSION + GET_ACTIVITY_LOG_REPOSITORY + AUTH_ONLY | READ | admin, platform owner, super admin |
| `GET` | `/admin/reports/export/recall-compliance` | ROLE_CHECKER[admin, platform owner, super admin] + GET_DB_SESSION + GET_ACTIVITY_LOG_REPOSITORY + AUTH_ONLY | READ | admin, platform owner, super admin |
| `GET` | `/admin/reports/operational-timing` | ROLE_CHECKER[admin, platform owner, super admin] + GET_DB_SESSION | READ | admin, platform owner, super admin |
| `GET` | `/admin/reports/recall-compliance` | ROLE_CHECKER[admin, platform owner, super admin] + GET_DB_SESSION | READ | admin, platform owner, super admin |
| `GET` | `/admin/services` | ROLE_CHECKER[admin, platform owner, super admin] + GET_SERVICE_SERVICE | READ | admin, platform owner, super admin |
| `POST` | `/admin/services` | ROLE_CHECKER[admin, platform owner, super admin] + GET_SERVICE_SERVICE | WRITE | admin, platform owner, super admin |
| `PATCH` | `/admin/services/reorder` | ROLE_CHECKER[admin, platform owner, super admin] + GET_SERVICE_SERVICE | WRITE | admin, platform owner, super admin |
| `GET` | `/admin/services/{service_id}` | ROLE_CHECKER[admin, platform owner, super admin] + GET_SERVICE_SERVICE | READ | admin, platform owner, super admin |
| `PUT` | `/admin/services/{service_id}` | ROLE_CHECKER[admin, platform owner, super admin] + GET_SERVICE_SERVICE | WRITE | admin, platform owner, super admin |
| `PATCH` | `/admin/services/{service_id}/status` | ROLE_CHECKER[admin, platform owner, super admin] + GET_SERVICE_SERVICE | WRITE | admin, platform owner, super admin |
| `GET` | `/admin/team` | ROLE_CHECKER[admin, platform owner, super admin] + GET_TEAM_SERVICE | READ | admin, platform owner, super admin |
| `POST` | `/admin/team` | ROLE_CHECKER[admin, platform owner, super admin] + GET_TEAM_SERVICE | WRITE | admin, platform owner, super admin |
| `PATCH` | `/admin/team/reorder` | ROLE_CHECKER[admin, platform owner, super admin] + GET_TEAM_SERVICE | WRITE | admin, platform owner, super admin |
| `GET` | `/admin/team/{member_id}` | ROLE_CHECKER[admin, platform owner, super admin] + GET_TEAM_SERVICE | READ | admin, platform owner, super admin |
| `PUT` | `/admin/team/{member_id}` | ROLE_CHECKER[admin, platform owner, super admin] + GET_TEAM_SERVICE | WRITE | admin, platform owner, super admin |
| `PATCH` | `/admin/team/{member_id}/status` | ROLE_CHECKER[admin, platform owner, super admin] + GET_TEAM_SERVICE | WRITE | admin, platform owner, super admin |
| `GET` | `/admin/users` | ROLE_CHECKER[admin, platform owner, super admin] + GET_USER_REPOSITORY | READ | admin, platform owner, super admin |
| `POST` | `/admin/users` | ROLE_CHECKER[admin, platform owner, super admin] + GET_USER_REPOSITORY + GET_ACTIVITY_LOG_REPOSITORY | WRITE | admin, platform owner, super admin |
| `GET` | `/admin/users/{id}` | ROLE_CHECKER[admin, platform owner, super admin] + GET_USER_REPOSITORY | READ | admin, platform owner, super admin |
| `PATCH` | `/admin/users/{id}` | ROLE_CHECKER[admin, platform owner, super admin] + GET_USER_REPOSITORY + GET_ACTIVITY_LOG_REPOSITORY | WRITE | admin, platform owner, super admin |
| `POST` | `/admin/users/{id}/reset-password` | ROLE_CHECKER[admin, platform owner, super admin] + GET_USER_REPOSITORY + GET_SESSION_REPOSITORY + GET_REFRESH_TOKEN_REPOSITORY + GET_ACTIVITY_LOG_REPOSITORY | WRITE | admin, platform owner, super admin |
| `PATCH` | `/admin/users/{id}/role` | ROLE_CHECKER[admin, platform owner, super admin] + GET_USER_REPOSITORY + GET_ACTIVITY_LOG_REPOSITORY | WRITE | admin, platform owner, super admin |
| `PATCH` | `/admin/users/{id}/status` | ROLE_CHECKER[admin, platform owner, super admin] + GET_USER_REPOSITORY + GET_SESSION_REPOSITORY + GET_REFRESH_TOKEN_REPOSITORY + GET_ACTIVITY_LOG_REPOSITORY | WRITE | admin, platform owner, super admin |
| `POST` | `/appointments` | GET_APPOINTMENT_SERVICE | WRITE | (public) |
| `GET` | `/attachments/patient/{patient_id}` | ROLE_CHECKER[admin, doctor, receptionist] + AUTH_ONLY + GET_DB_SESSION | READ | admin, doctor, receptionist |
| `POST` | `/attachments/upload` | ROLE_CHECKER[doctor, receptionist] + AUTH_ONLY + GET_DB_SESSION | WRITE | doctor, receptionist |
| `GET` | `/attachments/{attachment_id}/download` | ROLE_CHECKER[admin, doctor, receptionist] + AUTH_ONLY + GET_DB_SESSION | READ | admin, doctor, receptionist |
| `POST` | `/attachments/{attachment_id}/void` | ROLE_CHECKER[doctor] + AUTH_ONLY + GET_DB_SESSION | WRITE | doctor |
| `POST` | `/auth/change-password` | AUTH_ONLY + GET_AUTH_SERVICE | WRITE | any authenticated user |
| `PATCH` | `/auth/inactivity-settings` | AUTH_ONLY + GET_AUTH_SERVICE | WRITE | any authenticated user |
| `POST` | `/auth/login` | GET_AUTH_SERVICE | WRITE | (public) |
| `POST` | `/auth/logout` | GET_AUTH_SERVICE | WRITE | (public) |
| `GET` | `/auth/me` | AUTH_ONLY | READ | any authenticated user |
| `POST` | `/auth/refresh` | GET_AUTH_SERVICE | WRITE | (public) |
| `GET` | `/clinical-note-templates` | ROLE_CHECKER[admin, doctor] + AUTH_ONLY + GET_DB_SESSION | READ | admin, doctor |
| `POST` | `/clinical/alerts/{alert_id}/confirm` | ROLE_CHECKER[doctor] + GET_MEDICAL_ALERT_SERVICE | WRITE | doctor |
| `POST` | `/clinical/alerts/{alert_id}/dismiss` | ROLE_CHECKER[doctor] + GET_MEDICAL_ALERT_SERVICE | WRITE | doctor |
| `GET` | `/clinical/patients/{patient_id}/alerts` | ROLE_CHECKER[admin, doctor, super admin] + GET_MEDICAL_ALERT_SERVICE | READ | admin, doctor, super admin |
| `POST` | `/clinical/patients/{patient_id}/alerts` | ROLE_CHECKER[doctor] + GET_MEDICAL_ALERT_SERVICE | WRITE | doctor |
| `POST` | `/clinical/patients/{patient_id}/alerts/review` | ROLE_CHECKER[doctor] + GET_MEDICAL_ALERT_SERVICE | WRITE | doctor |
| `PATCH` | `/clinical/patients/{patient_id}/medical-history-status` | ROLE_CHECKER[doctor] + GET_MEDICAL_ALERT_SERVICE | WRITE | doctor |
| `POST` | `/consents` | ROLE_CHECKER[doctor] + AUTH_ONLY + GET_DB_SESSION | WRITE | doctor |
| `GET` | `/consents/patient/{patient_id}` | ROLE_CHECKER[admin, doctor, receptionist] + AUTH_ONLY + GET_DB_SESSION | READ | admin, doctor, receptionist |
| `POST` | `/consents/{consent_id}/void` | ROLE_CHECKER[doctor] + AUTH_ONLY + GET_DB_SESSION | WRITE | doctor |
| `GET` | `/doctor/appointments/{id}` | ROLE_CHECKER[admin, doctor, super admin] + GET_DOCTOR_SERVICE + GET_VISIT_PAYMENT_REPOSITORY | READ | admin, doctor, super admin |
| `POST` | `/doctor/appointments/{id}/finish` | ROLE_CHECKER[admin, doctor, super admin] + ROLE_CHECKER[doctor] + GET_DOCTOR_SERVICE + GET_ENCOUNTER_SERVICE + GET_RECEPTION_SERVICE | WRITE | doctor |
| `PATCH` | `/doctor/appointments/{id}/notes` | ROLE_CHECKER[admin, doctor, super admin] + ROLE_CHECKER[doctor] + GET_DOCTOR_SERVICE | WRITE | doctor |
| `POST` | `/doctor/appointments/{id}/start` | ROLE_CHECKER[admin, doctor, super admin] + ROLE_CHECKER[doctor] + GET_RECEPTION_SERVICE + GET_DOCTOR_SERVICE | WRITE | doctor |
| `PATCH` | `/doctor/chart/findings/{finding_id}` | ROLE_CHECKER[admin, doctor, super admin] + ROLE_CHECKER[doctor] + GET_DENTAL_CHART_SERVICE | WRITE | doctor |
| `POST` | `/doctor/chart/findings/{finding_id}/resolve` | ROLE_CHECKER[admin, doctor, super admin] + ROLE_CHECKER[doctor] + GET_DENTAL_CHART_SERVICE | WRITE | doctor |
| `PATCH` | `/doctor/chart/procedures/{procedure_id}/status` | ROLE_CHECKER[admin, doctor, super admin] + ROLE_CHECKER[doctor] + GET_DENTAL_CHART_SERVICE | WRITE | doctor |
| `POST` | `/doctor/clinical-notes/{note_id}/apply-template` | ROLE_CHECKER[doctor] + AUTH_ONLY + GET_DB_SESSION | WRITE | doctor |
| `POST` | `/doctor/documents/prescriptions` | ROLE_CHECKER[doctor] + AUTH_ONLY + GET_DB_SESSION | WRITE | doctor |
| `GET` | `/doctor/documents/prescriptions/encounter/{encounter_id}` | ROLE_CHECKER[admin, doctor] + AUTH_ONLY + GET_DB_SESSION | READ | admin, doctor |
| `GET` | `/doctor/documents/prescriptions/{prescription_id}/print` | ROLE_CHECKER[admin, doctor] + AUTH_ONLY + GET_DB_SESSION + GET_ORGANIZATION_REPOSITORY | READ | admin, doctor |
| `POST` | `/doctor/documents/prescriptions/{prescription_id}/sign` | ROLE_CHECKER[doctor] + AUTH_ONLY + GET_DB_SESSION | WRITE | doctor |
| `POST` | `/doctor/documents/referrals` | ROLE_CHECKER[doctor] + AUTH_ONLY + GET_DB_SESSION | WRITE | doctor |
| `GET` | `/doctor/documents/referrals/encounter/{encounter_id}` | ROLE_CHECKER[admin, doctor] + AUTH_ONLY + GET_DB_SESSION | READ | admin, doctor |
| `GET` | `/doctor/documents/referrals/{referral_id}/print` | ROLE_CHECKER[admin, doctor] + AUTH_ONLY + GET_DB_SESSION + GET_ORGANIZATION_REPOSITORY | READ | admin, doctor |
| `POST` | `/doctor/documents/referrals/{referral_id}/sign` | ROLE_CHECKER[doctor] + AUTH_ONLY + GET_DB_SESSION | WRITE | doctor |
| `POST` | `/doctor/encounters` | ROLE_CHECKER[admin, doctor, super admin] + ROLE_CHECKER[doctor] + GET_ENCOUNTER_SERVICE | WRITE | doctor |
| `GET` | `/doctor/encounters/by-booking/{booking_id}` | ROLE_CHECKER[admin, doctor, super admin] + GET_ENCOUNTER_SERVICE + GET_ACTIVITY_LOG_REPOSITORY | READ | admin, doctor, super admin |
| `GET` | `/doctor/encounters/{id}` | ROLE_CHECKER[admin, doctor, super admin] + GET_ENCOUNTER_SERVICE + GET_ACTIVITY_LOG_REPOSITORY | READ | admin, doctor, super admin |
| `GET` | `/doctor/encounters/{id}/chart` | ROLE_CHECKER[admin, doctor, super admin] + GET_DENTAL_CHART_SERVICE + GET_ACTIVITY_LOG_REPOSITORY | READ | admin, doctor, super admin |
| `POST` | `/doctor/encounters/{id}/chart/findings` | ROLE_CHECKER[admin, doctor, super admin] + ROLE_CHECKER[doctor] + GET_DENTAL_CHART_SERVICE | WRITE | doctor |
| `POST` | `/doctor/encounters/{id}/chart/procedures` | ROLE_CHECKER[admin, doctor, super admin] + ROLE_CHECKER[doctor] + GET_DENTAL_CHART_SERVICE | WRITE | doctor |
| `GET` | `/doctor/encounters/{id}/note` | ROLE_CHECKER[admin, doctor, super admin] + GET_CLINICAL_NOTE_SERVICE + GET_ACTIVITY_LOG_REPOSITORY | READ | admin, doctor, super admin |
| `POST` | `/doctor/encounters/{id}/note/amend` | ROLE_CHECKER[admin, doctor, super admin] + ROLE_CHECKER[doctor] + GET_CLINICAL_NOTE_SERVICE | WRITE | doctor |
| `PUT` | `/doctor/encounters/{id}/note/draft` | ROLE_CHECKER[admin, doctor, super admin] + ROLE_CHECKER[doctor] + GET_CLINICAL_NOTE_SERVICE | WRITE | doctor |
| `GET` | `/doctor/encounters/{id}/note/revisions` | ROLE_CHECKER[admin, doctor, super admin] + GET_CLINICAL_NOTE_SERVICE + GET_ACTIVITY_LOG_REPOSITORY | READ | admin, doctor, super admin |
| `POST` | `/doctor/encounters/{id}/note/sign` | ROLE_CHECKER[admin, doctor, super admin] + ROLE_CHECKER[doctor] + GET_CLINICAL_NOTE_SERVICE | WRITE | doctor |
| `PATCH` | `/doctor/encounters/{id}/status` | ROLE_CHECKER[admin, doctor, super admin] + ROLE_CHECKER[doctor] + GET_ENCOUNTER_SERVICE | WRITE | doctor |
| `GET` | `/doctor/patients` | ROLE_CHECKER[admin, doctor, super admin] + GET_PATIENT_REPOSITORY | READ | admin, doctor, super admin |
| `GET` | `/doctor/patients/{patient_id}` | ROLE_CHECKER[admin, doctor, super admin] + GET_PATIENT_REPOSITORY + GET_BOOKING_REPOSITORY + GET_ENCOUNTER_REPOSITORY | READ | admin, doctor, super admin |
| `GET` | `/doctor/patients/{patient_id}/chart` | ROLE_CHECKER[admin, doctor, super admin] + GET_DENTAL_CHART_SERVICE + GET_ACTIVITY_LOG_REPOSITORY | READ | admin, doctor, super admin |
| `GET` | `/doctor/patients/{patient_id}/chart/history` | ROLE_CHECKER[admin, doctor, super admin] + GET_DENTAL_CHART_SERVICE + GET_ACTIVITY_LOG_REPOSITORY | READ | admin, doctor, super admin |
| `GET` | `/doctor/patients/{patient_id}/encounters` | ROLE_CHECKER[admin, doctor, super admin] + GET_ENCOUNTER_SERVICE + GET_ACTIVITY_LOG_REPOSITORY | READ | admin, doctor, super admin |
| `GET` | `/doctor/schedule` | ROLE_CHECKER[admin, doctor, super admin] + GET_DOCTOR_SERVICE + GET_MEDICAL_ALERT_SERVICE + GET_VISIT_PAYMENT_REPOSITORY | READ | admin, doctor, super admin |
| `GET` | `/doctor/tasks` | ROLE_CHECKER[admin, doctor] + AUTH_ONLY + GET_DB_SESSION | READ | admin, doctor |
| `POST` | `/doctor/tasks` | ROLE_CHECKER[admin, doctor] + AUTH_ONLY + GET_DB_SESSION | WRITE | admin, doctor |
| `POST` | `/doctor/tasks/{task_id}/done` | ROLE_CHECKER[admin, doctor] + AUTH_ONLY + GET_DB_SESSION | WRITE | admin, doctor |
| `POST` | `/doctor/treatment-plans` | ROLE_CHECKER[doctor] + AUTH_ONLY + GET_DB_SESSION | WRITE | doctor |
| `GET` | `/doctor/treatment-plans/patient/{patient_id}` | ROLE_CHECKER[admin, doctor] + AUTH_ONLY + GET_DB_SESSION | READ | admin, doctor |
| `PATCH` | `/doctor/treatment-plans/{item_id}/status` | ROLE_CHECKER[doctor] + AUTH_ONLY + GET_DB_SESSION | WRITE | doctor |
| `GET` | `/doctor/unsigned-notes` | ROLE_CHECKER[admin, doctor, super admin] + GET_ENCOUNTER_SERVICE | READ | admin, doctor, super admin |
| `GET` | `/health` | Public (no guard) | READ | (public) |
| `GET` | `/health` | Public (no guard) | READ | (public) |
| `GET` | `/public/announcements` | GET_ANNOUNCEMENT_SERVICE | READ | (public) |
| `GET` | `/public/availability` | GET_AVAILABILITY_SERVICE | READ | (public) |
| `GET` | `/public/booking-schedule` | GET_BOOKING_SETTINGS_SERVICE | READ | (public) |
| `GET` | `/public/booking-status` | GET_BOOKING_SETTINGS_SERVICE | READ | (public) |
| `GET` | `/public/clinics` | GET_ORGANIZATION_SERVICE | READ | (public) |
| `GET` | `/public/content` | GET_CMS_SERVICE | READ | (public) |
| `GET` | `/public/faq` | GET_CMS_SERVICE | READ | (public) |
| `GET` | `/public/locations` | GET_ORGANIZATION_SERVICE | READ | (public) |
| `GET` | `/public/organization` | GET_ORGANIZATION_SERVICE | READ | (public) |
| `GET` | `/public/services` | GET_SERVICE_SERVICE | READ | (public) |
| `GET` | `/public/team` | GET_TEAM_SERVICE | READ | (public) |
| `GET` | `/public/working-hours` | GET_BOOKING_SETTINGS_SERVICE | READ | (public) |
| `GET` | `/reception/appointments` | ROLE_CHECKER[admin, clinic branch manager, receptionist, super admin] + GET_RECEPTION_SERVICE | READ | admin, clinic branch manager, receptionist, super admin |
| `POST` | `/reception/appointments` | ROLE_CHECKER[admin, clinic branch manager, receptionist, super admin] + GET_RECEPTION_SERVICE | WRITE | admin, clinic branch manager, receptionist, super admin |
| `GET` | `/reception/appointments/{id}/payments` | ROLE_CHECKER[admin, clinic branch manager, receptionist, super admin] + GET_RECEPTION_SERVICE | READ | admin, clinic branch manager, receptionist, super admin |
| `POST` | `/reception/appointments/{id}/payments` | ROLE_CHECKER[admin, clinic branch manager, receptionist, super admin] + GET_RECEPTION_SERVICE | WRITE | admin, clinic branch manager, receptionist, super admin |
| `POST` | `/reception/appointments/{id}/payments/{payment_id}/void` | ROLE_CHECKER[admin, clinic branch manager, receptionist, super admin] + GET_RECEPTION_SERVICE | WRITE | admin, clinic branch manager, receptionist, super admin |
| `POST` | `/reception/appointments/{id}/remind` | ROLE_CHECKER[admin, clinic branch manager, receptionist, super admin] + GET_RECEPTION_SERVICE | WRITE | admin, clinic branch manager, receptionist, super admin |
| `PATCH` | `/reception/appointments/{id}/reschedule` | ROLE_CHECKER[admin, clinic branch manager, receptionist, super admin] + GET_RECEPTION_SERVICE | WRITE | admin, clinic branch manager, receptionist, super admin |
| `PATCH` | `/reception/appointments/{id}/status` | ROLE_CHECKER[admin, clinic branch manager, receptionist, super admin] + GET_RECEPTION_SERVICE | WRITE | admin, clinic branch manager, receptionist, super admin |
| `GET` | `/reception/appointments/{id}/waitlist-offers` | ROLE_CHECKER[admin, clinic branch manager, receptionist, super admin] + GET_RECEPTION_SERVICE | READ | admin, clinic branch manager, receptionist, super admin |
| `POST` | `/reception/appointments/{id}/waitlist-offers/create-task` | ROLE_CHECKER[admin, clinic branch manager, receptionist, super admin] + GET_RECEPTION_SERVICE | WRITE | admin, clinic branch manager, receptionist, super admin |
| `GET` | `/reception/dashboard` | ROLE_CHECKER[admin, clinic branch manager, receptionist, super admin] + GET_RECEPTION_SERVICE | READ | admin, clinic branch manager, receptionist, super admin |
| `POST` | `/reception/dashboard/snooze` | ROLE_CHECKER[admin, clinic branch manager, receptionist, super admin] + GET_RECEPTION_SERVICE | WRITE | admin, clinic branch manager, receptionist, super admin |
| `GET` | `/reception/end-of-day/payments-summary` | ROLE_CHECKER[admin, clinic branch manager, receptionist, super admin] + GET_RECEPTION_SERVICE | READ | admin, clinic branch manager, receptionist, super admin |
| `POST` | `/reception/end-of-day/resolve` | ROLE_CHECKER[admin, clinic branch manager, receptionist, super admin] + GET_RECEPTION_SERVICE | WRITE | admin, clinic branch manager, receptionist, super admin |
| `GET` | `/reception/end-of-day/unresolved` | ROLE_CHECKER[admin, clinic branch manager, receptionist, super admin] + GET_RECEPTION_SERVICE | READ | admin, clinic branch manager, receptionist, super admin |
| `GET` | `/reception/leads` | ROLE_CHECKER[admin, clinic branch manager, receptionist, super admin] + GET_RECEPTION_SERVICE | READ | admin, clinic branch manager, receptionist, super admin |
| `POST` | `/reception/leads` | ROLE_CHECKER[admin, clinic branch manager, receptionist, super admin] + GET_RECEPTION_SERVICE | WRITE | admin, clinic branch manager, receptionist, super admin |
| `PATCH` | `/reception/leads/{id}` | ROLE_CHECKER[admin, clinic branch manager, receptionist, super admin] + GET_RECEPTION_SERVICE | WRITE | admin, clinic branch manager, receptionist, super admin |
| `POST` | `/reception/leads/{id}/convert` | ROLE_CHECKER[admin, clinic branch manager, receptionist, super admin] + GET_RECEPTION_SERVICE | WRITE | admin, clinic branch manager, receptionist, super admin |
| `GET` | `/reception/messages` | ROLE_CHECKER[admin, clinic branch manager, receptionist, super admin] + GET_RECEPTION_SERVICE | READ | admin, clinic branch manager, receptionist, super admin |
| `POST` | `/reception/messages` | ROLE_CHECKER[admin, clinic branch manager, receptionist, super admin] + GET_RECEPTION_SERVICE | WRITE | admin, clinic branch manager, receptionist, super admin |
| `GET` | `/reception/patients` | ROLE_CHECKER[admin, clinic branch manager, receptionist, super admin] + GET_RECEPTION_SERVICE + GET_MEDICAL_ALERT_SERVICE | READ | admin, clinic branch manager, receptionist, super admin |
| `POST` | `/reception/patients` | ROLE_CHECKER[admin, clinic branch manager, receptionist, super admin] + GET_RECEPTION_SERVICE | WRITE | admin, clinic branch manager, receptionist, super admin |
| `GET` | `/reception/patients/{id}` | ROLE_CHECKER[admin, clinic branch manager, receptionist, super admin] + GET_RECEPTION_SERVICE + GET_MEDICAL_ALERT_SERVICE | READ | admin, clinic branch manager, receptionist, super admin |
| `PATCH` | `/reception/patients/{id}` | ROLE_CHECKER[admin, clinic branch manager, receptionist, super admin] + GET_RECEPTION_SERVICE | WRITE | admin, clinic branch manager, receptionist, super admin |
| `PATCH` | `/reception/patients/{id}/messaging-opt-out` | ROLE_CHECKER[admin, clinic branch manager, receptionist, super admin] + GET_RECEPTION_SERVICE | WRITE | admin, clinic branch manager, receptionist, super admin |
| `POST` | `/reception/patients/{patient_id}/pending-alerts` | ROLE_CHECKER[admin, clinic branch manager, receptionist, super admin] + ROLE_CHECKER[clinic branch manager, receptionist] + GET_MEDICAL_ALERT_SERVICE | WRITE | clinic branch manager, receptionist |
| `GET` | `/reception/recalls` | ROLE_CHECKER[admin, clinic branch manager, receptionist, super admin] + GET_RECEPTION_SERVICE | READ | admin, clinic branch manager, receptionist, super admin |
| `POST` | `/reception/recalls/tasks` | ROLE_CHECKER[admin, clinic branch manager, receptionist, super admin] + GET_RECEPTION_SERVICE | WRITE | admin, clinic branch manager, receptionist, super admin |
| `GET` | `/reception/reminders` | ROLE_CHECKER[admin, clinic branch manager, receptionist, super admin] + GET_RECEPTION_SERVICE | READ | admin, clinic branch manager, receptionist, super admin |
| `GET` | `/reception/schedule` | ROLE_CHECKER[admin, clinic branch manager, receptionist, super admin] + GET_RECEPTION_SERVICE | READ | admin, clinic branch manager, receptionist, super admin |
| `GET` | `/reception/tasks` | ROLE_CHECKER[admin, clinic branch manager, receptionist, super admin] + GET_RECEPTION_SERVICE | READ | admin, clinic branch manager, receptionist, super admin |
| `POST` | `/reception/tasks` | ROLE_CHECKER[admin, clinic branch manager, receptionist, super admin] + GET_RECEPTION_SERVICE | WRITE | admin, clinic branch manager, receptionist, super admin |
| `PATCH` | `/reception/tasks/{id}` | ROLE_CHECKER[admin, clinic branch manager, receptionist, super admin] + GET_RECEPTION_SERVICE | WRITE | admin, clinic branch manager, receptionist, super admin |
| `GET` | `/reception/waitlist` | ROLE_CHECKER[admin, clinic branch manager, receptionist, super admin] + GET_RECEPTION_SERVICE | READ | admin, clinic branch manager, receptionist, super admin |