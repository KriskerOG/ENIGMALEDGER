# Deployment

## Local Development

Prerequisites:

- Node.js 20.9 or newer
- PostgreSQL 15 or newer
- A domain managed through Cloudflare or another edge provider for production

Commands:

```powershell
npm install
npm run dev
```

The static prototype can still be opened directly with `index.html`. The Next.js app lives under `src/` and is the path for production.

## Environment

Create `.env.local` from `.env.example`.

Minimum for mock-mode development:

```text
NEXT_PUBLIC_SITE_NAME="ENIGMA Verse Index"
```

Minimum for database-backed development:

```text
DATABASE_URL="postgres://user:password@localhost:5432/enigma"
```

UEX sync requires:

```text
UEX_API_TOKEN="..."
UEX_CLIENT_VERSION="enigma-verse-index/0.1.0"
```

Production rate limiting should use:

```text
UPSTASH_REDIS_REST_URL="..."
UPSTASH_REDIS_REST_TOKEN="..."
```

KOOK bot webhook integration requires:

```text
KOOK_BOT_TOKEN="..."
KOOK_VERIFY_TOKEN="..."
KOOK_ENCRYPT_KEY=""
```

## Database

Apply the schema:

```powershell
psql $env:DATABASE_URL -f db/schema.sql
```

The app currently falls back to mock data when `DATABASE_URL` is not configured.

## Production Hosting

Recommended first production path:

1. Cloudflare DNS
2. Vercel or Cloudflare Pages/Workers for the app
3. Managed PostgreSQL
4. Upstash Redis for distributed rate limiting
5. Cloudflare WAF and rate limiting rules

## Cloudflare Baseline

Enable:

- Proxy/CDN on the public hostname
- Managed WAF rules
- HTTP DDoS protection
- Bot protection
- Rate limit for `/api/search`
- Rate limit for `/api/trade/routes`
- Stronger challenge rules for admin and sync endpoints

Do not expose the origin IP. If using a VPS, restrict inbound traffic to Cloudflare source ranges.

## Release Checklist

- `npm run typecheck`
- `npm run build`
- Confirm `/api/health`
- Confirm `/api/kook/webhook` challenge succeeds if KOOK bot is enabled
- Confirm security headers
- Confirm data source attribution is visible
- Confirm footer says the site is unofficial
- Confirm no secrets are committed
- Confirm backups are enabled for PostgreSQL
