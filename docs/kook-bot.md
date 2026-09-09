# KOOK Bot

The KOOK bot is a thin ENIGMA Verse Index entry point for voice/community servers. It should not own the data model, sync jobs, or external source integrations.

## Recommended Mode

Use KOOK Webhook mode for the first version.

Reasons:

- The public website already provides HTTPS endpoints.
- Webhook mode scales better than a long-running WebSocket process on serverless or edge-style deployments.
- The bot can share the same validation, logging, and rate-limiting patterns as the website API.

Use WebSocket only if you later run a dedicated VPS or container worker that can maintain a long-lived connection.

KOOK official docs:

- API reference: https://developer.kookapp.cn/doc/reference
- Webhook mode: https://developer.kookapp.cn/doc/webhook
- WebSocket mode: https://developer.kookapp.cn/doc/websocket
- Message API: https://developer.kookapp.cn/doc/http/message

## Current Endpoint

```text
POST /api/kook/webhook
```

Recommended callback URL:

```text
https://your-domain.example/api/kook/webhook?compress=0
```

`compress=0` keeps the MVP callback simpler. The code still attempts to parse compressed payloads, but production should start with the simplest verifiable mode.

## Environment

Required:

```text
KOOK_BOT_TOKEN="..."
KOOK_VERIFY_TOKEN="..."
```

Optional if encrypted callbacks are enabled:

```text
KOOK_ENCRYPT_KEY="..."
```

Do not expose the bot token to the browser. It must only live in server-side environment variables.

## Commands

Supported command examples:

```text
/help
/search C2
/ship C2
/item XL-1
/price Gold
/route 696 750000
```

The bot sends short summaries back to KOOK and should later include detail-page links to the public website.

## Security Notes

- Verify `KOOK_VERIFY_TOKEN` on every callback.
- Ignore bot-authored messages to avoid loops.
- Keep request body limits.
- Sanitize outgoing message text to reduce accidental mention injection.
- Never call Star Citizen Wiki, UEX, or SC Trade Tools directly from the bot command handler.
- Add stronger rate limiting once the bot is invited to large servers.

## Production Flow

```text
KOOK command
  -> /api/kook/webhook
  -> command parser
  -> ENIGMA search/trade service
  -> KOOK message/create API
```

## Later Improvements

- Link every bot result to a public detail page.
- Add `/where <item>` after shop inventory sync exists.
- Add `/compare <shipA> <shipB>`.
- Add admin-only `/sync status`.
- Add per-server command prefixes.
- Add structured command registration if KOOK expands slash-command tooling.

