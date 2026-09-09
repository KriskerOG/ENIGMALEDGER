# MVP Scope

## Goal

Build a fast Star Citizen lookup site that answers the player's most common question:

> Where is this thing, what does it do, what does it cost, and how fresh is the data?

## First-Screen Experience

The first screen should be the actual search product, not a marketing landing page.

Recommended layout:

- Top navigation with ENIGMA branding, global search, data freshness indicator, and language switch.
- Search-first interface with filters for ships, components, items, commodities, locations, shops, and routes.
- Dense result list designed for scanning.
- Clear source and update time on each result.

## Public Pages

### Global Search

Search across:

- Ships and vehicles
- Ship components
- FPS weapons
- Armor and equipment
- Commodities
- Locations
- Shops and terminals
- Manufacturers

Useful filters:

- Category
- Game version
- Manufacturer
- Location
- Buyable/sellable
- Has price data
- Last updated

### Ship / Vehicle Detail

Fields:

- Name
- Manufacturer
- Role
- Crew
- Cargo capacity
- Size class
- Speed and quantum data when available
- Component slots
- Buy/rent locations when available
- Related official/community links
- Source and freshness metadata

### Item / Component Detail

Fields:

- Name
- Type
- Size
- Grade/class when available
- Manufacturer
- Stats
- Compatible ships or slots when known
- Buy locations
- Price history if available later

### Commodity Detail

Fields:

- Commodity name
- Buy locations
- Sell locations
- Latest known prices
- Supply/demand status if available
- Last reported time
- Source confidence

### Trade Route Tool

MVP inputs:

- Start location
- Ship cargo capacity
- Budget
- Risk preference

MVP output:

- Commodity
- Buy terminal
- Sell terminal
- Estimated profit
- Route distance or travel complexity when available
- Data age warning

## Later Features

Add these only after MVP data quality is acceptable:

- User accounts
- Favorites and watchlists
- User-submitted price reports
- Reputation for reporters
- Discord login
- ENIGMA organization member profile
- Fleet logistics planner
- Party cargo split calculator
- Route safety reports
- Admin moderation console

## Out of Scope for MVP

- RSI account login
- Reading user hangars
- Real-money trading
- Grey-market listings
- Public comments
- Player-to-player escrow
- Private messaging
- Automatic scraping of pages that forbid it

