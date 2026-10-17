## Fix 1 — /admin/reports crash
- File(s) changed: `frontend/src/app/admin/reports/page.tsx`, `frontend/src/lib/api.ts`
- Root cause: The page expected an appointments response containing `summary`, array-valued `byStatus`, and `dailyTimeline`, but the live API returned `totalAppointments`, object-valued `byStatus`, and `dailyCounts`. The view dereferenced `apptData.summary.total` before it could render the report.
- Diff summary: Normalized and validated the actual API payload into the page view model; added visible loading and empty states and gated all report panels while loading or errored.
- Audit result: **PASS**. `/admin/reports` returned `200`, matched `/report/i`, with zero network and console errors. Live UI showed “Total Booked” and “Volume by Appointment Status”; browser console was empty.

## Fix 2 — /admin/booking duplicate keys + landmarks
- File(s) changed: `frontend/src/app/admin/booking/page.tsx`
- Root cause: The working-hours API returned two distinct records for each weekday, but React keys used only `dayOfWeek`, creating duplicates. Visible labels used “Public Booking Status” and “Clinic Weekly Operating Hours,” not the audit’s expected terms.
- Diff summary: Keyed working-hours rows by stable record ID, keyed static day options by day name, and labeled the default-open sections “Booking Mode” and “Working Hours.”
- Audit result: **PASS**. `/admin/booking` returned `200`; working-hours, closure, and booking-mode landmarks were found; duplicate-key console errors fell from 28 to 0.

## Fix 3 — Reception patient detail 404s + billing
- File(s) changed: `frontend/src/lib/api.ts`, `frontend/e2e/frontend-accessibility-audit.spec.ts`
- Was the billing section missing entirely, or just mislabeled? **Missing entirely.** The receptionist profile contains no billing/payment section or payment component; I did not add placeholder UI.
- Diff summary: Changed attachment and consent GET URLs to `/api/v1/attachments/patient/{patient_id}` and `/api/v1/consents/patient/{patient_id}`. Direct authenticated checks returned `200` for both. The audit helper now waits for the first patient-detail link instead of assuming a `table tbody tr` exists. That earlier “patient row not visible” result was a test-selector/loading issue, not an application bug. No 404s or console errors remain on the detail route.
- Audit result: **FAIL** for the complete finding. The endpoint assertions pass, but the detail page still lacks `/billing|payment|ledger|balance/i`. RC12 remains a feature gap.

## Fix 4 — Public page 401 refresh noise
- File(s) changed: `frontend/src/components/providers/auth-provider.tsx`
- Diff summary: Added a non-secret localStorage session-presence hint, set after successful login and cleared on logout or failed restoration. Mount-time refresh is skipped when the hint is absent; authenticated restoration still uses the HttpOnly refresh cookie.
- Audit result: **PASS**. The six public routes made no `/auth/refresh` requests and had zero failed responses or console errors. Admin reload verification restored the admin navigation and received HTTP `200` from `/api/v1/auth/refresh`.

## Fix 5 — seed-demo idempotency
- File(s) changed: `backend/app/cli.py`
- Diff summary: Existing demo users retain password hashes when no password variable is set; provided variables update existing hashes; passwords are generated only for missing users. The Sarah seed recognizes `DOCTOR_SARAH_PASSWORD`, and retained accounts print an explicit message instead of a misleading generated credential.
- Test result (the 3-run verification above): **PASS** on the existing doctor account. Run 1 set `TestPass!123` and login succeeded; run 2 set `TestPass!456` and login succeeded; run 3 unset all seed password variables and `TestPass!456` still succeeded. Demo users were not deleted because workspace safety instructions prohibit destructive database operations. The supplied doctor password was restored afterward and all three audit personas authenticated.

## Final audit re-run
- Command: `npx playwright test e2e/frontend-accessibility-audit.spec.ts --reporter=list`
- Passing count / total: **4 / 5** (final exit code `1`). Full stdout: `frontend/audit-output.txt`.
- Remaining failure: `/reception/patients/29eeb1de-7e4e-40cf-b78f-4d6efe0fedf4` — expected landmark `/billing|payment|ledger|balance/i`; actual: no matching visible text. Status `200`, network errors `0`, console errors `0`.

## Remaining blockers
- RC12 billing/payment ledger is absent from the receptionist patient detail UI. The report explicitly claims this capability, but the profile has no billing section. This was not fabricated; it needs implementation as a real feature.
- The destructive “delete demo users” setup step was not performed. Password update/retention was verified against the pre-existing doctor account without deleting database rows.