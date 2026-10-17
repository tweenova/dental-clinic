# Marlow Dental — Hardcoded Data Audit (Part G)

Automated scan of `frontend/src` for hardcoded business facts (clinic details, hours, clinicians, prices, mock data).

## Summary

| Category | Count |
| :--- | :---: |
| **MUST FIX (Unresolved hardcoded business data)** | **0** |
| **ALLOWED (Form placeholders, examples, UI text)** | **15** |
| **ASK OWNER (Policy text, legal terms)** | **0** |
| **Total Findings** | **15** |

---

## 1. MUST FIX Findings

> [!NOTE]
> **Zero MUST FIX items found.** All business records, clinic profile facts, clinicians, services, hours, and pricing are delivered dynamically from backend API endpoints.

---

## 2. ALLOWED Findings (Form Placeholders & Generic Labels)

| File | Line | Type | Matched | Snippet | Reason |
| :--- | :---: | :--- | :--- | :--- | :--- |
| `frontend/src/app/book/page.tsx` | 679 | Email Address | `jane@example.com` | `placeholder="jane@example.com"` | Form input placeholder or generic UI element |
| `frontend/src/app/login/page.tsx` | 150 | Email Address | `admin@marlowdental.com` | `placeholder="admin@marlowdental.com"` | Form input placeholder or generic UI element |
| `frontend/src/app/reception/leads/page.tsx` | 326 | Email Address | `prospect@example.com` | `placeholder="prospect@example.com"` | Form input placeholder or generic UI element |
| `frontend/src/app/reception/messages/page.tsx` | 282 | Email Address | `patient@example.com` | `placeholder={channel === "email" ? "patient@example.com" : "+1-555-0199"}` | Form input placeholder or generic UI element |
| `frontend/src/app/reception/patients/page.tsx` | 424 | Phone Number | `+92 300 1234567` | `placeholder="e.g. +92 300 1234567"` | Form input placeholder or generic UI element |
| `frontend/src/app/reception/patients/page.tsx` | 436 | Email Address | `patient@example.com` | `placeholder="patient@example.com"` | Form input placeholder or generic UI element |
| `frontend/src/app/admin/locations/page.tsx` | 459 | Email Address | `care@marlowdental.com` | `placeholder="e.g. care@marlowdental.com"` | Form input placeholder or generic UI element |
| `frontend/src/app/admin/locations/page.tsx` | 479 | Hours / Schedule | `8:00 AM – 6:00 PM` | `placeholder="Mon – Thu: 8:00 AM – 6:00 PM&#10;Fri: 8:00 AM – 2:00 PM&#10;Sat–Sun: Closed"` | Form input placeholder or generic UI element |
| `frontend/src/app/admin/locations/page.tsx` | 479 | Hours / Schedule | `8:00 AM – 2:00 PM` | `placeholder="Mon – Thu: 8:00 AM – 6:00 PM&#10;Fri: 8:00 AM – 2:00 PM&#10;Sat–Sun: Closed"` | Form input placeholder or generic UI element |
| `frontend/src/app/admin/messaging/page.tsx` | 509 | Phone Number | `+92 300 1234567` | `placeholder="+92 300 1234567"` | Form input placeholder or generic UI element |
| `frontend/src/app/admin/services/page.tsx` | 437 | Price / Currency | `Rs 1` | `placeholder="from Rs 1,500"` | Form input placeholder or generic UI element |
| `frontend/src/app/admin/team/page.tsx` | 404 | Clinician Name | `Dr. Full Name` | `label="Display Name (e.g. Dr. Full Name, BDS)"` | Form input placeholder or generic UI element |
| `frontend/src/app/admin/team/page.tsx` | 407 | Clinician Name | `Dr. Attending Clinician` | `placeholder="e.g. Dr. Attending Clinician, BDS"` | Form input placeholder or generic UI element |
| `frontend/src/app/admin/users/page.tsx` | 445 | Email Address | `robert.vance@marlowdental.com` | `placeholder="e.g. robert.vance@marlowdental.com"` | Form input placeholder or generic UI element |
| `frontend/src/app/admin/website/page.tsx` | 279 | Email Address | `care@marlowdental.com` | `placeholder="care@marlowdental.com"` | Form input placeholder or generic UI element |

---

## 3. Data Source Traceability Matrix (Page by Page)

| Route | Elements Rendered | Source Endpoint | Status |
| :--- | :--- | :--- | :---: |
| `/` (Home) | Clinic profile, locations, doctors, services, FAQs | `GET /api/v1/public/content`, `team`, `services`, `locations` | `live` |
| `/book` | Dynamic services, slots, clinicians, locations | `GET /api/v1/public/booking-schedule`, `booking-status` | `live` |
| `/login` | Authentication, redirect role mapping | `POST /api/v1/auth/login`, `GET /api/v1/auth/me` | `live` |
| `/admin/*` | Users, CMS, audit logs, appointments, booking settings | `GET/POST/PUT /api/v1/admin/*` | `live` |
| `/doctor/*` | Clinician daily schedule, odontogram, SOAP notes, tasks | `GET/POST /api/v1/doctor/*` | `live` |
| `/reception/*` | Needs-action queue, check-in, ledger, waitlist, recalls | `GET/POST /api/v1/reception/*` | `live` |
