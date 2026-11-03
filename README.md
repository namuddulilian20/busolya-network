# Busolya network — websites

Three static sites, one repo, no build step. Plain HTML + Tailwind (Play CDN) + vanilla JS.

| Folder | Site | Service name | Default URL |
|---|---|---|---|
| `sites/baf` | Busolya Agro Farmers Ltd | `busolya-agro-farmers` | https://busolya-agro-farmers.onrender.com |
| `sites/bae` | Bataka Agro Expo | `bataka-agro-expo` | https://bataka-agro-expo.onrender.com |
| `sites/mutindo` | Abataka Mutindo SACCO (hub) | `abataka-mutindo-sacco` | https://abataka-mutindo-sacco.onrender.com |

## Local preview

```powershell
python -m http.server 8765 --directory sites
```

Then open http://localhost:8765/baf/, http://localhost:8765/bae/ and http://localhost:8765/mutindo/.
`assets/network.js` detects localhost and uses relative paths, so the three sites link to each other locally too.

## Deploy on Render (CI/CD)

1. Push this repo to GitHub.
2. In Render: **New → Blueprint**, pick the repo. Render reads `render.yaml` and creates the three static services.
3. From then on, every push to the default branch redeploys automatically. No build command, no environment variables, no secrets.

Custom domains (e.g. `busolyaagrofarmers.co.ug`) are added per service in Render → Settings → Custom Domains, then the DNS records Render shows are added at the registrar.

The three default URLs are wired in `sites/*/assets/network.js`. If a service is renamed or a custom domain is added, update that one file in all three copies.

## What works today

- Cross-site links in both directions (Agro Farmers ↔ Expo ↔ SACCO hub).
- Directory with live search and sector filter, built from the exhibitor register.
- Expo questionnaire with three capture routes (QR, printed objective form, marshal), credit/guarantor fields, per-device storage and CSV export.
- Printable visitor form (Print / Save as PDF).
- Contact and supplier registration with validation and print.

## What is still a placeholder

- Expo venue and gate times; official phone, email and office address for each organisation.
- Clan register is a working list, marked as pending verification.
- Entries save in the visitor's own browser until the shared backend exists. The backend specification is in `docs/biz-facilitation-blueprint.md`.
