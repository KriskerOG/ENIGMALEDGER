# Data Model

This is the initial normalized model. It is intentionally broad enough to support "query everything" without overfitting to a single data source.

## Core Tables

### source_records

Tracks where data came from.

- `id`
- `source_name`
- `source_url`
- `source_record_id`
- `game_version`
- `fetched_at`
- `source_updated_at`
- `freshness_status`
- `raw_hash`

### entities

Universal searchable entity table.

- `id`
- `type`
- `slug`
- `name`
- `name_zh`
- `description`
- `description_zh`
- `manufacturer_id`
- `primary_source_record_id`
- `created_at`
- `updated_at`

Entity types:

- `ship`
- `vehicle`
- `component`
- `weapon`
- `armor`
- `equipment`
- `commodity`
- `location`
- `shop`
- `manufacturer`

### aliases

Search names and translations.

- `id`
- `entity_id`
- `language`
- `alias`
- `normalized_alias`
- `source`

### manufacturers

- `id`
- `slug`
- `name`
- `name_zh`
- `description`
- `primary_source_record_id`

### locations

- `id`
- `entity_id`
- `parent_location_id`
- `system`
- `planet`
- `moon`
- `station`
- `zone`
- `landing_zone`
- `coordinates`

## Ship Tables

### ships

- `id`
- `entity_id`
- `manufacturer_id`
- `role`
- `size_class`
- `crew_min`
- `crew_max`
- `cargo_scu`
- `vehicle_inventory_scu`
- `claim_time`
- `expedite_time`
- `pledge_url`

### ship_components

- `id`
- `ship_id`
- `component_entity_id`
- `slot_type`
- `size`
- `quantity`

## Item Tables

### items

- `id`
- `entity_id`
- `category`
- `subcategory`
- `size`
- `grade`
- `class`
- `manufacturer_id`

### item_stats

- `id`
- `item_id`
- `stat_key`
- `stat_value`
- `unit`

## Commerce Tables

### commodities

- `id`
- `entity_id`
- `category`
- `is_buyable`
- `is_sellable`

### terminals

- `id`
- `location_id`
- `name`
- `type`
- `source_record_id`

### commodity_prices

- `id`
- `commodity_id`
- `terminal_id`
- `buy_price`
- `sell_price`
- `supply`
- `demand`
- `status`
- `reported_at`
- `source_record_id`

### shop_inventory

- `id`
- `shop_location_id`
- `item_entity_id`
- `price`
- `currency`
- `availability`
- `reported_at`
- `source_record_id`

## User Tables For Later

Do not add these until public MVP works.

### users

- `id`
- `username`
- `email`
- `password_hash`
- `star_citizen_handle`
- `language`
- `role`
- `created_at`
- `updated_at`

### favorites

- `id`
- `user_id`
- `entity_id`
- `created_at`

### user_reports

- `id`
- `user_id`
- `entity_id`
- `report_type`
- `payload`
- `status`
- `reviewed_by`
- `created_at`
- `reviewed_at`

