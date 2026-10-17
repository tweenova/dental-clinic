# Marlow Dental — Security and Deployment Guide

This document summarizes the core security configurations, session parameters, and operational backup procedures implemented in the Marlow Dental application.

---

## 1. Transport Security (HTTPS)

Production deployments must terminate web traffic over HTTPS:
- **TLS Configuration**: The reverse proxy (e.g. Nginx, Caddy) must terminate TLS using valid certificates.
- **Secure Cookies**: Production authentication cookies must have the `Secure`, `HttpOnly`, and `SameSite=Lax` attributes enabled.
- **Security Headers**: Ingress proxies should transmit standard defense headers:
  - `X-Frame-Options: DENY`
  - `X-Content-Type-Options: nosniff`
  - `Referrer-Policy: strict-origin-when-cross-origin`

---

## 2. Session Settings & Workstation Auto-Lock

Authentication sessions are governed by JSON Web Tokens (JWT) and inactivity timers:
- **Access Tokens**: JWTs governed by `ACCESS_TOKEN_EXPIRE_MINUTES` in `config.py` (default: 7 days / 10,080 minutes) stored in memory and authorization headers.
- **Refresh Tokens**: Governed by `REFRESH_TOKEN_EXPIRE_DAYS` (7 days) with single-use rotation window governed by `REFRESH_TOKEN_ROTATE_AFTER_MINUTES` (35 minutes) stored in HTTP-only cookies (`marlow_refresh_token`).
- **Inactivity Timeout**: Configurable workstation inactivity auto-lock (default: 15 minutes), customizable via `/admin/account` or `/reception/account`.
- **Password Hashes**: User passwords are encrypted using `bcrypt.hashpw` with a random salt generated via `bcrypt.gensalt()` in `app/core/security.py`. Password resets force `requires_password_change` on first login.

---

## 3. Storage & Operational Backups

### 3.1 Confidential Attachment Directory (`ATTACHMENT_DIR`)
- Patient clinical files, signed informed consents, and radiography are stored outside the public document root in the directory pointed to by `ATTACHMENT_DIR` (default: `backend/storage/attachments/`).
- Files are accessed only through authenticated role-guarded endpoints (`/api/v1/patient-attachments/{id}/download`).
- **Backup Requirement**: The database backup alone is insufficient to restore clinical records. Scheduled automated backups must include both the PostgreSQL database dump and the physical filesystem contents of `ATTACHMENT_DIR`.

### 3.2 Messaging & External Service Configuration
When real SMS or messaging integrations are enabled, external provider settings must be configured via environment variables rather than hardcoded in the codebase:
- `TWILIO_ACCOUNT_SID`
- `TWILIO_AUTH_TOKEN`
- `TWILIO_FROM_NUMBER`
- `WHATSAPP_API_TOKEN`
- `WHATSAPP_PHONE_NUMBER_ID`
- `SENDGRID_API_KEY`
- `SENDGRID_FROM_EMAIL`

These environment variables should be stored securely in the host deployment environment (e.g. systemd environment files or secret managers) and backed up alongside deployment runbooks.

---

## 4. Deployer Responsibilities

Encryption at rest, physical and cloud infrastructure hosting, and applicable regulatory or legal review are the responsibility of the organization deploying and operating the software.
