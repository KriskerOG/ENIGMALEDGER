# API Contract

All public API responses are JSON and include security headers.

## `GET /api/health`

Returns service health and whether the database/rate-limit backends are configured.

## `GET /api/sources`

Returns data source catalog entries.

## `POST /api/kook/webhook`

Receives KOOK Webhook callbacks.

Required server environment:

- `KOOK_VERIFY_TOKEN`
- `KOOK_BOT_TOKEN`

Supported commands:

- `/help`
- `/search <query>`
- `/ship <query>`
- `/item <query>`
- `/price <commodity>`
- `/route <cargoScu> <budgetUec>`

Challenge requests return the challenge body to KOOK. Message events are parsed, answered with a short text response, and ignored when authored by a bot.

## `GET /api/search`

Query params:

- `q`: optional search text, max 80 characters
- `type`: `all`, `ship`, `vehicle`, `component`, `weapon`, `armor`, `equipment`, `commodity`, `location`, `shop`, or `manufacturer`
- `freshness`: `all`, `fresh`, `recent`, `stale`, or `unknown`
- `source`: `all`, `local`, `wiki`, or `database`
- `limit`: 1-50

Response:

```json
{
  "data": [],
  "meta": {
    "count": 0,
    "source": "local+wiki",
    "providers": [
      {
        "id": "local",
        "count": 0
      },
      {
        "id": "wiki",
        "count": 0
      }
    ]
  }
}
```

The search endpoint is a provider aggregator. It can search local seed data, the configured database, and live Star Citizen Wiki results without making any single source authoritative. It falls back to local seed data when `DATABASE_URL` is not configured.

## `GET /api/trade/routes`

Query params:

- `origin`: optional origin location
- `cargoScu`: cargo capacity, 1-10000
- `budgetUec`: available capital, 1-100000000
- `limit`: 1-25

Response:

```json
{
  "data": [],
  "meta": {
    "count": 0,
    "source": "mock"
  }
}
```

This route currently uses mock trade data. Production should calculate from normalized `commodity_prices`.
