# ENIGMA Verse Index

ENIGMA Verse Index is a Star Citizen community intelligence and lookup site for ships, vehicles, components, items, commodities, locations, manufacturers, trade terminals, and trade routes.

This project should be built as an unofficial fan/community tool. It must not imply endorsement by Cloud Imperium Games, Roberts Space Industries, or Star Citizen.

## Product Positioning

ENIGMA is not just a wiki mirror and not just a trade calculator. The target product is a practical "query everything" station for Star Citizen players:

- Search ships, vehicles, weapons, armor, components, locations, commodities, manufacturers, shops, and trade terminals.
- Compare ships and components.
- Find where an item can be bought or sold.
- View trade prices, supply, demand, profit routes, and data freshness.
- Save user favorites and personal watchlists after account support is added.
- Display source, game version, and last updated time for every externally sourced record.

## First Version

The first version should be public-read only and should not require account registration.

Recommended MVP:

- Global search
- Ship and vehicle database
- Component and item database
- Location and shop lookup
- Commodity price lookup
- Simple route/profit calculator
- Data-source attribution and freshness labels
- Admin-only data sync health page

Accounts should come later, after the public lookup experience is stable.

## Current Repository State

This workspace now contains two layers:

- `index.html`, `styles.css`, and `app.js`: a dependency-free static prototype.
- `src/`, `package.json`, `next.config.mjs`, and `db/schema.sql`: the production-direction Next.js application scaffold.

Develop new product features in `src/`. Keep the static prototype as a quick visual reference until the Next.js app fully replaces it.

## Local Development

Install dependencies after Node.js 20.9+ is available:

```powershell
pnpm install
pnpm run dev
```

The app can run in mock mode without PostgreSQL. To use the database-backed search path, copy `.env.example` to `.env.local`, set `DATABASE_URL`, and apply:

```powershell
psql $env:DATABASE_URL -f db/schema.sql
```

After `pnpm run build`, a static preview helper can serve the generated page and proxy API requests:

```powershell
$env:API_ORIGIN="http://127.0.0.1:3001"
$env:PORT="3002"
node tools/preview-built-site.mjs
```

## Cloudflare Deployment

The repository includes `wrangler.toml` for Cloudflare Workers with static assets. Cloudflare should build the Next.js static output and then deploy `dist/server/index.js` with `dist/client` as the asset directory.

Use these commands in Cloudflare Workers Git deployments:

```text
Build command: pnpm run build
Deploy command: npx wrangler deploy
Non-production deploy command: npx wrangler versions upload
```

Keep Cloudflare Access disabled for the public site, otherwise visitors will be asked to sign in.

Localization terms are seeded from the public ParaTranz project 8340 glossary:

```text
pnpm run sync:localization
```

The production Worker also has a daily Cron trigger that refreshes the public ParaTranz glossary into its runtime cache. If the remote glossary is unavailable, search falls back to the bundled snapshot generated at build time.

Cargo-capable ship options are seeded from StarCitizen.tools Ship cargo stats, including concept and in-production ships that may be missing from the vehicles API:

```text
pnpm run sync:cargo-ships
```

## Suggested Stack

- Frontend: Next.js + TypeScript
- API: Next.js Route Handlers or a separate Node.js API
- Database: PostgreSQL
- Cache/rate limit store: Redis-compatible service or Cloudflare KV/Durable Objects
- Search: PostgreSQL trigram search for MVP, Meilisearch or Typesense later
- Hosting: Cloudflare Pages/Workers, Vercel, Railway, Render, or a VPS behind Cloudflare
- Edge protection: Cloudflare DNS, CDN, WAF, DDoS protection, bot controls, and rate limiting

## Key Principle

Do not query community APIs directly from the browser for high-traffic pages. Sync external data into our own database, normalize it, attach source metadata, then serve users from our own API.

```text
External data sources
  -> scheduled sync jobs
  -> validation and normalization
  -> PostgreSQL
  -> app API
  -> web UI
```

## Documentation

- [MVP Scope](docs/mvp-scope.md)
- [Data Sources](docs/data-sources.md)
- [Security Baseline](docs/security-baseline.md)
- [Data Model](docs/data-model.md)
- [API Contract](docs/api-contract.md)
- [KOOK Bot](docs/kook-bot.md)
- [Deployment](docs/deployment.md)
