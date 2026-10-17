# Marlow Dental — PostgreSQL Backup & Restore Runbook

> **Target Database:** PostgreSQL 15+ (`dentai_dev` in development, dedicated production DB in deployment)  
> **Backend Framework:** FastAPI / SQLAlchemy 2.0 Async / asyncpg  
> **Database Migrations:** Alembic

---

## 1. Overview & Operational Principles

This runbook defines the disaster recovery and backup lifecycle for Marlow Dental's PostgreSQL database.

All database backups must:
1. **Preserve Relational Integrity**: Use atomic, point-in-time consistent dumps (`pg_dump -Fc` custom archive format).
2. **Be Tested Regularly**: A backup is not verified until a successful restoration has been executed on a non-production staging instance.
3. **Adhere to Least Privilege & PHI Safety**: Backups contain Protected Health Information (PHI) including patient demographic records, appointments, clinical encounters, dental charts, medical alerts, and audit logs. Dumps must be encrypted in transit and at rest with strict access restrictions.
4. **Distinguish Database State from File Storage**: See [Section 5](#5-storage-boundaries--clinical-attachments-warning) for critical rules regarding `uploads/`.

---

## 2. Scriptable Timestamped Backup (`pg_dump`)

### 2.1 Configuration & Credentials
Never pass cleartext passwords in command arguments. Use standard PostgreSQL environment variables or a secure `~/.pgpass` (`%APPDATA%\postgresql\pgpass.conf` on Windows) file with `0600` permissions.

```bash
# Environment variables (Linux / macOS / CI)
export PGHOST="${PGHOST:-localhost}"
export PGPORT="${PGPORT:-5432}"
export PGUSER="${PGUSER:-user}"
export PGDATABASE="${PGDATABASE:-dentai_dev}"
export PGPASSWORD="${PGPASSWORD}" # Or use ~/.pgpass
```

On Windows PowerShell:
```powershell
$env:PGHOST = if ($env:PGHOST) { $env:PGHOST } else { "localhost" }
$env:PGPORT = if ($env:PGPORT) { $env:PGPORT } else { "5432" }
$env:PGUSER = if ($env:PGUSER) { $env:PGUSER } else { "user" }
$env:PGDATABASE = if ($env:PGDATABASE) { $env:PGDATABASE } else { "dentai_dev" }
```

### 2.2 Backup Command (Custom Archive Format)
Use PostgreSQL custom archive format (`-Fc`). It is compressed by default, enables selective restoration, supports parallel multi-core restore (`-j`), and preserves BLOBs and schema metadata.

#### Linux / Bash Script:
```bash
#!/usr/bin/env bash
set -euo pipefail

BACKUP_DIR="${BACKUP_DIR:-/var/backups/marlow-dental}"
TIMESTAMP=$(date -u +"%Y%m%d_%H%M%SZ")
BACKUP_FILE="${BACKUP_DIR}/marlow_dental_${PGDATABASE}_${TIMESTAMP}.dump"

mkdir -p "${BACKUP_DIR}"

echo "[$(date -u)] Starting database backup for '${PGDATABASE}'..."
pg_dump \
  --host="${PGHOST}" \
  --port="${PGPORT}" \
  --username="${PGUSER}" \
  --format=c \
  --blobs \
  --verbose \
  --file="${BACKUP_FILE}" \
  "${PGDATABASE}"

echo "[$(date -u)] Backup created successfully: ${BACKUP_FILE}"
ls -lh "${BACKUP_FILE}"
```

#### Windows PowerShell Script:
```powershell
$BackupDir = "C:\Backups\marlow-dental"
if (!(Test-Path -Path $BackupDir)) {
    New-Item -ItemType Directory -Path $BackupDir -Force | Out-Null
}

$Timestamp = (Get-Date).ToUniversalTime().ToString("yyyyMMdd_HHmmssZ")
$BackupFile = Join-Path $BackupDir "marlow_dental_${env:PGDATABASE}_${Timestamp}.dump"

Write-Host "Starting backup for $($env:PGDATABASE)..."
pg_dump `
  --host=$env:PGHOST `
  --port=$env:PGPORT `
  --username=$env:PGUSER `
  --format=c `
  --blobs `
  --verbose `
  --file=$BackupFile `
  $env:PGDATABASE

Write-Host "Backup created: $BackupFile"
Get-Item $BackupFile | Select-Object Name, Length, LastWriteTime
```

---

## 3. Retention & Rotation Policy (Illustrative Example)

To manage disk storage capacity while retaining operational recovery history (example rotation policy for clinic operations):

| Tier | Frequency | Retention Period | Target Storage |
|---|---|---|---|
| **Hourly / Transactional** | WAL Archiving / Point-In-Time (PITR) | 48 Hours | Encrypted Fast Cloud / NAS |
| **Daily Snapshots** | Daily at 02:00 UTC | 7 Days | Encrypted Local & Cloud Storage |
| **Weekly Snapshots** | Every Sunday at 03:00 UTC | 4 Weeks | Secondary Encrypted Object Storage |
| **Monthly Snapshots** | 1st of every calendar month | 12 Months (or statutory retention) | Cold / Immutable Encrypted Storage |

### Automated Rotation Example (Prune Daily Backups Older than 7 Days)

#### Bash Cleanup:
```bash
# Delete backups older than 7 days from the daily directory
find "${BACKUP_DIR}" -name "marlow_dental_*.dump" -type f -mtime +7 -exec rm -f {} +
```

#### PowerShell Cleanup:
```powershell
Get-ChildItem -Path $BackupDir -Filter "marlow_dental_*.dump" |
  Where-Object { $_.LastWriteTime -lt (Get-Date).AddDays(-7) } |
  Remove-Item -Force
```

---

## 4. Verified Restore Checklist (`pg_restore` & `psql`)

> **SAFETY WARNING:** Never restore directly into a live production database without taking a safety pre-flight snapshot first. Test restores must always be performed in an isolated staging or local database.

### Step 1: Pre-Flight Safety Checks
- [ ] **Stop application traffic**: Stop API services (`uvicorn`, systemd service, or container pods) to prevent ongoing transactional writes during restoration.
- [ ] **Confirm backup file integrity**:
  ```bash
  pg_restore --list marlow_dental_dentai_dev_20261012_000000Z.dump > /dev/null
  echo "Dump header and catalog verified."
  ```
- [ ] **Take a safety dump of the existing database** (even if corrupted or degraded) prior to applying any restore.

### Step 2: Prepare Target Database
Create a clean restore target database (e.g., `dentai_restore_test` or clean `dentai_dev`):

```bash
# Terminate existing connections if restoring in-place
psql -h "$PGHOST" -U "$PGUSER" -d postgres -c "
SELECT pg_terminate_backend(pid)
FROM pg_stat_activity
WHERE datname = 'dentai_dev' AND pid <> pg_backend_pid();"

# Drop and recreate clean target database
dropdb -h "$PGHOST" -U "$PGUSER" --if-exists dentai_dev
createdb -h "$PGHOST" -U "$PGUSER" dentai_dev
```

### Step 3: Execute Restoration (`pg_restore`)
Restore using `pg_restore` with parallel jobs where hardware permits (`-j 4`):

```bash
pg_restore \
  --host="$PGHOST" \
  --port="$PGPORT" \
  --username="$PGUSER" \
  --dbname=dentai_dev \
  --clean \
  --if-exists \
  --no-owner \
  --no-privileges \
  --verbose \
  marlow_dental_dentai_dev_20261012_000000Z.dump
```

*Note on non-critical warnings: Warnings about roles or extensions that already exist may appear with `--clean`; ensure table and data copy operations completed without fatal errors.*

### Step 4: Validate Migration State (Alembic)
Verify that the restored database schema accurately matches the current codebase migration head:

```bash
cd backend
# Check current revision in the restored database
uv run alembic current

# Verify if any migrations are pending
uv run alembic check
```

If the codebase has newer migrations than the snapshot, run:
```bash
uv run alembic upgrade head
```

### Step 5: Data Integrity & Smoke Test Verification
Execute smoke queries to verify critical entity counts and referential integrity:

```sql
-- Connect to the restored database
\c dentai_dev

-- 1. Verify schema tables exist
SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public';

-- 2. Verify staff accounts and roles
SELECT count(*) AS total_users,
       count(*) FILTER (WHERE role = 'admin') AS admins,
       count(*) FILTER (WHERE role = 'doctor') AS doctors,
       count(*) FILTER (WHERE role = 'receptionist') AS receptionists
FROM users;

-- 3. Verify clinical and booking records
SELECT count(*) FROM patients;
SELECT count(*) FROM bookings;
SELECT count(*) FROM clinical_encounters;
SELECT count(*) FROM clinical_notes;
SELECT count(*) FROM patient_dental_charts;
SELECT count(*) FROM patient_medical_alerts;

-- 4. Verify audit trail logs exist
SELECT count(*) FROM activity_logs;
```

### Step 6: Application Smoke Test & Service Restart
1. Start the backend service in staging environment:
   ```bash
   uv run uvicorn app.main:app --port 8000
   ```
2. Verify API health check:
   ```bash
   curl -i http://localhost:8000/health
   ```
3. Test staff login and verify authorization tokens are properly evaluated against the restored database session tables.
4. Open the frontend and test a read encounter operation, confirming that a corresponding row is recorded in `activity_logs`.

---

## 5. Storage Boundaries & Clinical Attachments Warning

> [!CAUTION]
> **CRITICAL ARCHITECTURAL NOTICE — LOCAL DISK `uploads/` IS NOT FOR CLINICAL ATTACHMENTS**
>
> 1. **Local Disk Scope**:
>    The local disk directory `uploads/` (`backend/uploads`) configured via `Settings.UPLOAD_DIR` is strictly used for **public, non-sensitive CMS website media** (such as clinic logos, doctor marketing photos, and hero banners).
>
> 2. **Excluded from Database Dumps**:
>    Files located in `uploads/` are stored on the server's local file system. **They are NOT included in PostgreSQL `pg_dump` backups**. Backing up the database does not back up files in `uploads/`.
>
> 3. **Clinical Attachments Prohibition**:
>    **Clinical attachments, diagnostic X-rays (DICOM), intraoral camera photographs, signed consent PDFs, and patient medical files MUST NEVER be saved to the local `uploads/` directory.**
>
> 4. **Required Clinical Storage Architecture**:
>    - Dedicated encrypted storage for private patient files.
>    - Server-side encryption at rest.
>    - Clinician-only authentication for retrieval.
>    - Audit logging on every download in the database activity table.

> [!IMPORTANT]
> **DISASTER RECOVERY REQUIREMENT: BACKUPS MUST INCLUDE `ATTACHMENT_DIR`**
>
> All private patient attachments (such as diagnostic X-rays, intraoral camera photos, signed patient consent forms, and specialist referrals) are stored on disk in the dedicated, non-public directory specified by `Settings.ATTACHMENT_DIR` (or environment variable `ATTACHMENT_DIR`).
>
> Because PostgreSQL `pg_dump` dumps only the relational metadata rows in `patient_attachments` and `patient_consents`, **disaster recovery routines, snapshot procedures, and backup schedules MUST explicitly back up and archive the entire `ATTACHMENT_DIR` alongside database dumps**. Failure to include `ATTACHMENT_DIR` in scheduled backups will result in orphaned database records without underlying encrypted attachment payloads upon restoration.

---

## 6. Audit Trail Immutability & Least Privilege Database Roles

> [!IMPORTANT]
> **APPLICATION DATABASE ROLE MUST NOT HAVE UPDATE OR DELETE PRIVILEGES ON `activity_logs`**
>
> In production environments:
> 1. The PostgreSQL user / role used by the FastAPI application service (e.g., `marlow_app_user`) must be granted only `SELECT` and `INSERT` permissions on the `activity_logs` table.
> 2. `UPDATE` and `DELETE` permissions must be explicitly revoked for the application role:
>    ```sql
>    -- Ensure append-only audit trail: revoke mutation and deletion privileges
>    REVOKE UPDATE, DELETE, TRUNCATE ON TABLE activity_logs FROM marlow_app_user;
>    GRANT SELECT, INSERT ON TABLE activity_logs TO marlow_app_user;
>    ```
> 3. This guarantees the tamper-evident, append-only integrity of the clinical and administrative audit trail even in the event of an application credential compromise or SQL injection vulnerability.
> 4. Neither the backend API nor the frontend administrative interface provides any mutation or deletion endpoints for audit logs.


