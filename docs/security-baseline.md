# Security Baseline

No public website can guarantee protection against every attack. The goal is layered defense, limited data exposure, abuse resistance, observability, and recovery.

## Edge Layer

Use Cloudflare or an equivalent edge provider in front of the site:

- DNS through Cloudflare
- CDN caching for public pages and static assets
- Managed WAF rules
- DDoS protection
- Bot fight/bot management where available
- Rate limiting rules for login, search, sync-trigger, and write endpoints
- Turnstile/CAPTCHA only on suspicious or abusive flows

Do not expose the origin server IP. If using a VPS, restrict inbound traffic to Cloudflare IP ranges where practical.

## Application Security

Required controls:

- Parameterized database queries through an ORM or query builder
- Server-side authorization on every protected endpoint
- Input validation with schemas
- Output escaping and no unsafe HTML rendering
- Secure cookies: `HttpOnly`, `Secure`, `SameSite=Lax` or stricter
- CSRF protection for cookie-authenticated write actions
- Password hashing with Argon2id or bcrypt if password login is used
- MFA for admin accounts
- Strong admin audit logging
- No secrets committed to the repository
- Strict environment separation for development, staging, and production

## API Abuse Controls

Public APIs should enforce:

- IP-based and account-based rate limits
- Pagination limits
- Maximum query length
- Request body size limits
- Timeout limits for expensive operations
- Cached search responses for popular queries
- Separate admin-only endpoints for data sync operations

Search should never fan out directly to multiple third-party APIs per user request. Query local data first.

## Account Data Minimization

MVP should not require registration. When accounts are added, collect only:

- Username
- Email
- Password or OAuth identity
- Optional Star Citizen handle
- Optional language preference

Avoid collecting real names, phone numbers, addresses, birth dates, government IDs, RSI credentials, or payment information unless a future business requirement clearly justifies it.

## File Uploads

Avoid public uploads in MVP.

If uploads are added later:

- Restrict file types and size
- Store files outside the application server filesystem
- Rename files to generated IDs
- Scan files before public access
- Never execute uploaded files
- Serve uploads from a separate asset domain

## Logging And Monitoring

Log:

- Authentication events
- Admin actions
- Failed authorization checks
- Rate-limit hits
- Sync job failures
- External API errors
- Unexpected server errors

Do not log passwords, tokens, full cookies, payment data, or sensitive personal information.

## Backup And Recovery

Minimum production backup policy:

- Daily PostgreSQL backups
- Restore test at least monthly
- Separate backup retention from hosting provider account
- Versioned deployment rollback
- Incident runbook for account compromise and data corruption

## Security Headers

Set at minimum:

- `Strict-Transport-Security`
- `Content-Security-Policy`
- `X-Content-Type-Options: nosniff`
- `Referrer-Policy`
- `Permissions-Policy`
- `X-Frame-Options` or CSP `frame-ancestors`

## Threat Model For MVP

Most likely threats:

- Search endpoint scraping
- Login brute force after accounts launch
- SQL injection through filters
- XSS through user-submitted aliases or reports
- API key leakage
- Third-party API outage
- Origin IP exposure
- Admin account compromise

Design the MVP around these risks before adding social features.

