# Media storage (supplier images / audio / video / documents)

`busolya-api` stores uploaded supplier media in the `supplier_media` table
(Postgres in production, JSONL locally) and keeps the bytes in a backing store.
The backing store is chosen at boot time from environment variables — the
endpoints, the `supplier_media` schema, and the `storage_path` / `storage_url`
semantics are identical in every mode.

This document describes the two **durable** options and the default
(ephemeral) behaviour. Pick **one** durable option and set its env vars.

> Default caveat: with **none** of the media env vars set, behaviour is
> unchanged — files are written to the ephemeral local disk and are **still
> lost on every Render redeploy/restart**. At least one durable option must be
> configured for media to survive.

## Shared env vars

| Var | Default | Purpose |
|---|---|---|
| `MEDIA_STORAGE_PATH` | `<repo>/uploads` | Disk root for Option A. Set to a persistent-disk mount path (e.g. `/var/data/media`). |
| `MEDIA_BASE_URL` | `/media` | Path prefix the disk files are served at, or the host-based absolute URL stored when it is absolute. |
| `MEDIA_MAX_MB` | `50` | Max upload size in MB. |

## Option A — Render persistent disk (same-origin, simplest)

Keep the existing disk code path and serve `/media` via `express.static`; just
make the disk survive redeploys.

1. Upgrade the `busolya-api` service off the **free** plan — Render disks
   require a paid plan.
2. Attach a **persistent disk** to `busolya-api` and mount it, e.g. at
   `/var/data/media`.
3. Set env vars (Render dashboard or blueprint, then Sync):
   - `MEDIA_STORAGE_PATH=/var/data/media`
   - `MEDIA_BASE_URL=/media` (default)
4. `npm install` already includes the existing deps; no new dependency is
   needed for this option.

Files are written to `<MEDIA_STORAGE_PATH>/<supplier_id>/<file>` and served at
`/media/<supplier_id>/<file>`. `storage_url` stored in `supplier_media` is the
host-based absolute URL.

## Option B — S3-compatible object store (free-tier friendly)

Switch uploads to an object store (e.g. Cloudflare R2, AWS S3, or MinIO) via
`@aws-sdk/client-s3`. The SDK is **lazy-required** only when object-store mode
is enabled, so a default/local boot never loads it.

Object-store mode is enabled when **all three** of these are set:
`MEDIA_S3_BUCKET`, `MEDIA_S3_ACCESS_KEY_ID`, `MEDIA_S3_SECRET_ACCESS_KEY`.

| Var | Required | Purpose |
|---|---|---|
| `MEDIA_S3_BUCKET` | yes | Bucket/container name. |
| `MEDIA_S3_ACCESS_KEY_ID` | yes (secret, `sync: false`) | Access key. |
| `MEDIA_S3_SECRET_ACCESS_KEY` | yes (secret, `sync: false`) | Secret key. |
| `MEDIA_S3_REGION` | no (default `auto`) | Region. Use `auto` for R2. |
| `MEDIA_S3_ENDPOINT` | no | S3 API endpoint. Set for R2/MinIO; enables path-style addressing. |
| `MEDIA_S3_PUBLIC_BASE_URL` | no (falls back to `MEDIA_BASE_URL`) | Public CDN/bucket URL the frontend loads media from. Set this to the R2 public bucket URL. |

Setup (Cloudflare R2 example):

1. Create an R2 bucket and an API token (access key id + secret).
2. Find the bucket's S3 API endpoint (`https://<account>.r2.cloudflarestorage.com`).
3. Enable public access (R2 public development URL or a custom domain) and copy
   that URL for `MEDIA_S3_PUBLIC_BASE_URL`.
4. Set the env vars in the Render dashboard (secrets get `sync: false`):
   - `MEDIA_S3_BUCKET=<bucket>`
   - `MEDIA_S3_REGION=auto`
   - `MEDIA_S3_ENDPOINT=https://<account>.r2.cloudflarestorage.com`
   - `MEDIA_S3_ACCESS_KEY_ID=<key>` (secret)
   - `MEDIA_S3_SECRET_ACCESS_KEY=<secret>` (secret)
   - `MEDIA_S3_PUBLIC_BASE_URL=https://pub-<id>.r2.dev` (or your custom domain)
5. `npm install` pulls in the pinned `@aws-sdk/client-s3@3.658.1` dependency.

On upload the buffer is sent with `PutObjectCommand` and the row stores
`storage_path = <supplier_id>/<file>` and
`storage_url = MEDIA_S3_PUBLIC_BASE_URL + '/' + key`. On delete, a
best-effort `DeleteObjectCommand` removes the object. The frontend loads media
directly from `storage_url`, so it never hits `/media` in this mode (the
`/media` static mount harmlessly 404s).

## Graceful fallback for missing files

If a backing file is gone (ephemeral disk wiped on redeploy, an object deleted,
or a misconfigured CDN), the request returns 404 — disk mode via the
`/media` static mount, object-store mode via the CDN URL. The frontend renders
a placeholder on a load error instead of a broken image (see the FEAT-002/003
`BusolyaMedia` helper). No server crash, no broken-image icons for end users.

## render.yaml

The media env vars are declared under the `busolya-api` service (additive —
existing services and keys are unchanged). After editing `render.yaml`, **Sync
the blueprint** in the Render dashboard (Settings > Blueprint > Sync) so the
service picks up the new keys, then fill in the secret values you kept
`sync: false`.

## Image resizing (sharp)

On every image upload (`mime_type` starting with `image/`), the server uses `sharp@0.33.5` to:

1. **Web variant** — resize to max 1920 px wide (never upscales), convert to WebP quality 82. This becomes `storage_url` in `supplier_media`.
2. **Thumbnail variant** — resize to max 400 px wide, WebP quality 75. Stored alongside the web variant with a `_thumb.webp` suffix; URL recorded in `thumb_url` in `supplier_media`.

`sharp` is lazy-required; if it is absent or fails to load, uploads continue without resizing (original file stored).

### thumb_url column

The `thumb_url` text column is added to `supplier_media` automatically at server boot via an idempotent `ALTER TABLE ... ADD COLUMN IF NOT EXISTS`. No manual migration is needed. Existing rows will have `thumb_url = NULL`; the frontend falls back to `storage_url` in that case.

### Video / audio / PDF uploads

Non-image uploads are stored as-is — no `sharp` processing, no `ffmpeg` dependency.

### Error handling

If `sharp` fails for any reason (corrupt image, unsupported format), the upload completes with the original unresized file and the error is logged to the server console. The upload is never rejected due to a resize failure.

## Free-tier spin-down and DNS_PROBE_FINISHED_NXDOMAIN

The `busolya-api` service runs on Render's **free** web-service plan. Render spins the service down after ~15 minutes of inactivity. When it spins down, some client DNS resolvers briefly fail to resolve the `.onrender.com` hostname — browsers report this as `DNS_PROBE_FINISHED_NXDOMAIN` rather than a timeout, which affects some devices but not others depending on their DNS cache state.

### Keepalive workaround (current)

A self-ping `setInterval` in `start()` (every 14 minutes) keeps the service warm by calling `GET http://localhost:{PORT}/api/health` from within the process. This is enabled in production via `KEEP_ALIVE=true` in `render.yaml`. To disable it, set `KEEP_ALIVE=false` or remove the key.

This workaround is not a fix — it reduces spin-down frequency but does not eliminate it. Render may still spin the service down if the self-ping alone is considered insufficient traffic.

### Proper long-term fix

Upgrade `busolya-api` to a **paid Render plan** (Starter or above). Paid plans have no idle timeout and no spin-down, so the service stays running continuously and the hostname always resolves. After upgrading:

1. Change `plan: free` to `plan: starter` (or higher) in `render.yaml` under `busolya-api`.
2. Remove or set `KEEP_ALIVE=false` — the self-ping is no longer needed.
3. Sync the blueprint in the Render dashboard.

### Other connectivity checks

- **Bind address**: `app.listen(PORT)` in `server/index.js` omits the host argument, so Node defaults to `0.0.0.0` — all network interfaces. No change needed.
- **CORS**: All three production `.onrender.com` origins are explicitly listed in `CORS_ORIGINS`. Mobile browsers on any network hitting these origins will get the correct `Access-Control-Allow-Origin` header.
- **No hardcoded hostnames**: Neither `server/.env` nor `.env` contain `MEDIA_BASE_URL`, `HOST`, or any production hostname. All URL construction is request-relative at runtime.
