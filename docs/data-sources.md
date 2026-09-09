# Data Sources

Star Citizen data changes frequently. The site should treat every external record as versioned, sourced, and potentially stale. Star Citizen Wiki is an available live lookup provider, not the only source of truth for the index.

## Source Priority

| Data Type | Primary Source | Secondary Source | Notes |
| --- | --- | --- | --- |
| Ships and vehicles | Aggregated index | Star Citizen Wiki API / scunpacked | Use source links and game version labels. |
| Components and items | Aggregated index | Star Citizen Wiki API / scunpacked | Normalize names, sizes, grades, and item categories. |
| Locations | Aggregated index | Star Citizen Wiki API / RSI links / community data | Store hierarchy: system, planet, moon, station, zone, shop. |
| Commodities | UEX Corp API | SC Trade Tools API | Always show update time and source. |
| Trade terminals | UEX Corp API | SC Trade Tools API | Terminal names and availability can drift between patches. |
| Trade routes | Own calculator using cached prices | UEX/SC Trade Tools route data | Prefer explainable route calculation from cached data. |
| Official news | RSI links | Star Citizen Wiki API if available | Link to official content instead of duplicating aggressively. |

## Useful Links

- Star Citizen Wiki API documentation: https://docs.star-citizen.wiki/
- Star Citizen Wiki API: https://api.star-citizen.wiki/
- UEX Corp API documentation: https://uexcorp.space/api/documentation/
- SC Trade Tools API documentation: https://sc-trade.tools/swagger-ui.html
- RSI fan content guidance: https://support.robertsspaceindustries.com/hc/en-us/articles/360006895793-Star-Citizen-Fankit-and-Fandom-FAQ

## Ingestion Rules

Each sync job should:

- Pull data from one source.
- Validate required fields.
- Normalize names and categories.
- Save the raw source payload for debugging when license/terms allow it.
- Upsert normalized records.
- Attach source name, source URL, source record ID, game version, fetched time, and reported update time.
- Mark old records as stale instead of deleting immediately.

Live lookups should be optional per provider. If one provider is slow or unavailable, the public index should still return local or database results and report the failed provider in response metadata.

## Data Freshness Labels

Use player-facing labels:

- Fresh: updated within 24 hours
- Recent: updated within 7 days
- Stale: older than 7 days
- Unknown: no reliable source timestamp

Trade data should show stronger warnings than static ship/item data because commodity prices and availability change more often.

## Attribution

Every detail page should include a compact source block:

- Source name
- Source link
- Game version if known
- Last fetched time
- Last source update time if provided

Do not present community data as official RSI/CIG truth.

## Legal And Brand Notes

Use ENIGMA branding as the primary identity. Avoid domains and product names that imply official Star Citizen ownership.

The site footer should state:

> ENIGMA Verse Index is an unofficial Star Citizen community tool and is not affiliated with Cloud Imperium Games, Roberts Space Industries, or Star Citizen.
