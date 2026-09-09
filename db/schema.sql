CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'entity_type') THEN
    CREATE TYPE entity_type AS ENUM (
      'ship',
      'vehicle',
      'component',
      'weapon',
      'armor',
      'equipment',
      'commodity',
      'location',
      'shop',
      'manufacturer'
    );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'freshness_status') THEN
    CREATE TYPE freshness_status AS ENUM ('fresh', 'recent', 'stale', 'unknown');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS source_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_name text NOT NULL,
  source_url text,
  source_record_id text,
  game_version text,
  fetched_at timestamptz NOT NULL DEFAULT now(),
  source_updated_at timestamptz,
  freshness_status freshness_status NOT NULL DEFAULT 'unknown',
  raw_hash text,
  raw_payload jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (source_name, source_record_id)
);

CREATE TABLE IF NOT EXISTS manufacturers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  name text NOT NULL,
  name_zh text,
  description text,
  primary_source_record_id uuid REFERENCES source_records(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS entities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type entity_type NOT NULL,
  slug text NOT NULL UNIQUE,
  name text NOT NULL,
  name_zh text,
  description text,
  description_zh text,
  manufacturer_id uuid REFERENCES manufacturers(id) ON DELETE SET NULL,
  primary_source_record_id uuid REFERENCES source_records(id) ON DELETE SET NULL,
  stats jsonb NOT NULL DEFAULT '{}'::jsonb,
  search_text text GENERATED ALWAYS AS (
    lower(
      coalesce(name, '') || ' ' ||
      coalesce(name_zh, '') || ' ' ||
      coalesce(description, '') || ' ' ||
      coalesce(description_zh, '')
    )
  ) STORED,
  deleted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS aliases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id uuid NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
  language text NOT NULL,
  alias text NOT NULL,
  normalized_alias text NOT NULL,
  source text NOT NULL DEFAULT 'ENIGMA',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (entity_id, language, normalized_alias)
);

CREATE TABLE IF NOT EXISTS entity_tags (
  entity_id uuid NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
  tag text NOT NULL,
  PRIMARY KEY (entity_id, tag)
);

CREATE TABLE IF NOT EXISTS locations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id uuid NOT NULL UNIQUE REFERENCES entities(id) ON DELETE CASCADE,
  parent_location_id uuid REFERENCES locations(id) ON DELETE SET NULL,
  system text,
  planet text,
  moon text,
  station text,
  zone text,
  landing_zone text,
  coordinates jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS ships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id uuid NOT NULL UNIQUE REFERENCES entities(id) ON DELETE CASCADE,
  manufacturer_id uuid REFERENCES manufacturers(id) ON DELETE SET NULL,
  role text,
  size_class text,
  crew_min integer,
  crew_max integer,
  cargo_scu numeric,
  vehicle_inventory_scu numeric,
  claim_time text,
  expedite_time text,
  pledge_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS ship_components (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ship_id uuid NOT NULL REFERENCES ships(id) ON DELETE CASCADE,
  component_entity_id uuid REFERENCES entities(id) ON DELETE SET NULL,
  slot_type text NOT NULL,
  size text,
  quantity integer NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id uuid NOT NULL UNIQUE REFERENCES entities(id) ON DELETE CASCADE,
  category text,
  subcategory text,
  size text,
  grade text,
  class text,
  manufacturer_id uuid REFERENCES manufacturers(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS item_stats (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id uuid NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  stat_key text NOT NULL,
  stat_value text NOT NULL,
  unit text
);

CREATE TABLE IF NOT EXISTS commodities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id uuid NOT NULL UNIQUE REFERENCES entities(id) ON DELETE CASCADE,
  category text,
  is_buyable boolean NOT NULL DEFAULT false,
  is_sellable boolean NOT NULL DEFAULT false
);

CREATE TABLE IF NOT EXISTS terminals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id uuid REFERENCES locations(id) ON DELETE SET NULL,
  name text NOT NULL,
  type text,
  source_record_id uuid REFERENCES source_records(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS commodity_prices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  commodity_id uuid NOT NULL REFERENCES commodities(id) ON DELETE CASCADE,
  terminal_id uuid NOT NULL REFERENCES terminals(id) ON DELETE CASCADE,
  buy_price numeric,
  sell_price numeric,
  supply numeric,
  demand numeric,
  status text,
  reported_at timestamptz,
  source_record_id uuid REFERENCES source_records(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (commodity_id, terminal_id, source_record_id)
);

CREATE TABLE IF NOT EXISTS shop_inventory (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_location_id uuid REFERENCES locations(id) ON DELETE SET NULL,
  item_entity_id uuid NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
  price numeric,
  currency text NOT NULL DEFAULT 'UEC',
  availability text,
  reported_at timestamptz,
  source_record_id uuid REFERENCES source_records(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_entities_type ON entities(type);
CREATE INDEX IF NOT EXISTS idx_entities_search_trgm ON entities USING gin (search_text gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_aliases_normalized_trgm ON aliases USING gin (normalized_alias gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_source_records_source ON source_records(source_name, source_record_id);
CREATE INDEX IF NOT EXISTS idx_commodity_prices_lookup ON commodity_prices(commodity_id, terminal_id, reported_at DESC);
CREATE INDEX IF NOT EXISTS idx_shop_inventory_item ON shop_inventory(item_entity_id, reported_at DESC);
