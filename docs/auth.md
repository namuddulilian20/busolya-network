# Authentication and account administration

This page describes how people sign in to the Busolya sites and how the API
manages accounts. It replaces the old shared-password-only admin gate.

## Who signs in where

| Role | Public sites | `/admin` backend |
|---|---|---|
| customer, member, supplier (exhibitor) | phone verification (OTP or last 5 digits) | no |
| employee | phone verification on the sites; password on `/admin` | yes, with password |
| admin | phone verification on the sites; password on `/admin` | yes, with password |
| superuser | same as admin | yes, with password |

The three static sites (`bae`, `baf`, `mutindo`) share the same API.

## Public sign-in (passwordless)

1. `POST /api/auth/challenge` `{ login_id }` — returns the masked phone
   (e.g. `+2567••••••78`) and a `method`.
2. `POST /api/auth/login` `{ login_id, otp }` or `{ login_id, last5 }`.

- If `SMS_PROVIDER_URL` is set, the challenge issues a 6-digit code valid for
  `OTP_TTL_MINUTES` (default 10). The code is stored as a PBKDF2 hash bound to
  the account phone, with a maximum of 5 attempts.
- If no SMS provider is configured, or the code expires, the last 5 digits of
  the account phone still work. This is the fallback and keeps existing users
  signed in without any change.
- Suspended accounts (`is_active = false`) are refused at both steps.

### Optional SMS provider

Set `SMS_PROVIDER_URL` to an HTTP endpoint that accepts:

```json
{ "to": "+2567...", "message": "Your Busolya verification code is 123456. ..." }
```

The endpoint must return any 2xx. `SMS_API_KEY`, when set, is sent as a Bearer
token. Nothing is sent unless the variable is configured.

## Administrator sign-in

`/admin/login` accepts either:

- a participant account with role `admin` or `employee`: phone (or email) and
  the account password;
- the shared `ADMIN_PASSWORD` with the phone field left blank (break-glass
  fallback).

Passwords are hashed with PBKDF2-SHA512, 100,000 iterations, per-password salt.
Legacy SHA-256 hashes are accepted once and re-hashed on the next successful
sign-in.

## Users & roles in `/admin`

- `/admin/users` — list, filter by role, search by name/phone/email/org.
- `/admin/users/new` — create an account. Administrator/staff roles require a
  password; public roles do not (they use phone verification).
- `/admin/users/:id` — edit profile, change role, reset password, suspend or
  reactivate.

Role changes, password resets and suspensions are superuser-only. The
superuser is marked with a crown and cannot be demoted or suspended.

The three site admin dashboards also have a **Users** tab backed by
`GET /api/admin/users`, with per-row role change and password reset.

## Superuser

The account whose phone matches `SUPERUSER_PHONE` (default `+256780698353`) is
promoted to `is_superuser = true` and role `admin` on every boot. The same
promotion happens when that phone registers. No route compares a phone number
against a literal any more; permission checks read the database flag.

## Environment variables

| Variable | Purpose |
|---|---|
| `ADMIN_PASSWORD` | break-glass shared password for `/admin` |
| `SUPERUSER_PHONE` | phone number promoted to superuser |
| `SMS_PROVIDER_URL` | optional OTP SMS endpoint |
| `SMS_API_KEY` | optional Bearer token for that endpoint |
| `OTP_TTL_MINUTES` | OTP lifetime, default 10 |

## Database changes

`server/schema.sql` adds, idempotently:

- `participants.is_superuser boolean not null default false`
- `participants.is_active boolean not null default true`
- `participants.otp_hash`, `otp_expires_at`, `otp_attempts`, `otp_issued_at`
- an index on `is_superuser`
