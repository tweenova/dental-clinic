# Marlow Dental — Part E Cleanup & Removal Log

This log records all code, configuration, content, schema, and page removals performed as part of **Part E Cleanup** on branch `feat/clinical-workflows`.

---

## 1. Git Tag Baseline
- **Pre-Cleanup Tag**: `pre-cleanup` created at commit `d975a40` prior to any Part E deletions.
- **Rollback Path**: `git checkout pre-cleanup` preserves the exact pre-cleanup repository state.

---

## 2. Page & Routing Removals
- **`/hipaa` Route Removed**: Deleted `frontend/src/app/hipaa/` (`frontend/src/app/hipaa/page.tsx`).
- **Footer Navigation**: Removed the `/hipaa` link from `frontend/src/components/layout/footer.tsx` legal links row.
- **Sitemap XML**: Removed `/hipaa` entry from `frontend/src/app/sitemap.ts`.
- **Search Index**: Removed `leg-hipaa` entry from `frontend/src/lib/search-index.ts`.
- **Audit Reachability Script**: Removed `/hipaa` from public routing list in `backend/scripts/audit_reachability.py`.

---

## 3. Insurance Terminology & Fields Removed Everywhere
- **Public Services Page**:
  - Removed "upfront insurance verification" from `frontend/src/components/sections/services.tsx`.
  - Removed `service.insuranceNote` rendering blocks from service cards.
- **Clinical Commitments**: Removed "estimated insurance benefits" from `frontend/src/components/sections/commitments.tsx`.
- **Search Dialog**: Removed "insurance" suggestions and placeholder keywords from `frontend/src/components/ui/search-dialog.tsx`.
- **Reception Task Board**:
  - Replaced "insurance verification" with "appointment confirmations" in `frontend/src/app/reception/tasks/page.tsx`.
  - Replaced `placeholder="e.g. Call patient to verify secondary insurance"` with `placeholder="e.g. Call patient regarding appointment confirmation"`.
- **Admin Services Management**:
  - Removed `Insurance Copay Note` form field (`TextField id="service-ins"`) from `frontend/src/app/admin/services/page.tsx`.
  - Cleared insurance copay defaults in new service creation modal.
- **Admin Website CMS**: Removed `insurance` FAQ category option from `frontend/src/app/admin/website/page.tsx`.
- **Terms of Service**: Removed CDT procedural codes, copayments, coinsurance, and carrier adjudication clauses from `frontend/src/app/terms/page.tsx`.
- **Privacy Policy**: Removed insurance policy transmitting and claim submission clauses from `frontend/src/app/privacy/page.tsx`.
- **Root Layout Schema**: Removed `CareCredit, Dental PPO Insurance` from `paymentAccepted` JSON-LD in `frontend/src/app/layout.tsx`.

---

## 4. US-Specific & Chicago / Illinois Content Removed
- **Geographic Content Replaced**:
  - Replaced "Lincoln Park, Chicago" and "for Chicago" across `frontend/src/app/layout.tsx`, `frontend/src/app/manifest.ts`, `frontend/src/app/opengraph-image.tsx`, `frontend/src/components/sections/hero.tsx`, and `frontend/src/app/accessibility/page.tsx`.
  - Replaced "911" emergency dialing with local emergency medical services in `frontend/src/app/terms/page.tsx`.
  - Replaced "America/Chicago" timezone references with clinic timezone in `frontend/src/lib/utils.ts`.
- **Hardcoded "$" Removed**:
  - Replaced hardcoded "$75" and "$500" in `frontend/src/app/terms/page.tsx` with neutral fee descriptions.
  - Replaced hardcoded "$$" and "USD" from JSON-LD schema in `frontend/src/app/layout.tsx`.
  - Neutral currency formatter (`formatPriceWithCurrency`) dynamically uses admin-configured currency symbol (defaulting to PKR / Rs).
- **Licensure & State Defaults**:
  - Removed hardcoded "Illinois" and "IL" license state defaults from `frontend/src/app/admin/team/page.tsx` and `frontend/src/components/layout/footer.tsx`.
  - Replaced hardcoded "Chicago, IL 60614" defaults in `frontend/src/app/admin/locations/page.tsx` and `frontend/src/components/providers/public-content-provider.tsx` with clean neutral placeholders.

---

## 5. Admin-Editable Practice Profile with Neutral Placeholders
All core clinic identity attributes are verified to be fully admin-editable via `/admin/settings` (CMS) and `/admin/locations`:
- **Practice Name**: Sourced from `content.general.practiceName` with neutral fallback `"Marlow Dental"`.
- **Address & Branch**: Sourced from `locations` table and `content.general.address` with neutral fallback `"Clinic Address"`.
- **Phone**: Sourced from `primaryLocation.phone` and `content.general.phone` with neutral fallback `"Clinic Phone"`.
- **Operating Hours**: Sourced from `booking_business_hours` table and `locations.hours_info`.
- **Clinical Director & Licensure**: Sourced from `team_members` table (`displayName`, `licenseNumber`).

---

## 6. Database Schema Transition (Table Renamed, Dropped Nothing)
- **Alembic Migration**: `backend/alembic/versions/c2d3e4f5a6b7_rename_appointments_to_legacy.py`
  - Renamed `appointments` &rarr; `appointments_legacy`.
  - Reversible: `downgrade()` renames `appointments_legacy` &rarr; `appointments`.
  - Preserved all historical rows, indexes, and foreign keys. Dropped nothing else.
