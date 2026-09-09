import { getPool } from "./client";
import type { SearchRecord } from "../types";

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export async function upsertSearchRecord(record: SearchRecord): Promise<string> {
  const pool = getPool();

  if (!pool) {
    throw new Error("DATABASE_URL is required before syncing external data.");
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const sourceRecordId = record.source.sourceRecordId ?? record.id;
    const sourceResult = await client.query<{ id: string }>(
      `
        INSERT INTO source_records (
          source_name,
          source_url,
          source_record_id,
          game_version,
          fetched_at,
          source_updated_at,
          freshness_status
        )
        VALUES ($1, $2, $3, $4, COALESCE($5::timestamptz, now()), $6, $7)
        ON CONFLICT (source_name, source_record_id)
        DO UPDATE SET
          source_url = EXCLUDED.source_url,
          game_version = EXCLUDED.game_version,
          fetched_at = EXCLUDED.fetched_at,
          source_updated_at = EXCLUDED.source_updated_at,
          freshness_status = EXCLUDED.freshness_status
        RETURNING id;
      `,
      [
        record.source.sourceName,
        record.source.sourceUrl ?? null,
        sourceRecordId,
        record.source.gameVersion ?? null,
        record.source.fetchedAt ?? null,
        record.source.sourceUpdatedAt ?? null,
        record.source.freshness
      ]
    );

    let manufacturerId: string | null = null;

    if (record.manufacturer) {
      const manufacturerResult = await client.query<{ id: string }>(
        `
          INSERT INTO manufacturers (slug, name)
          VALUES ($1, $2)
          ON CONFLICT (slug)
          DO UPDATE SET name = EXCLUDED.name, updated_at = now()
          RETURNING id;
        `,
        [slugify(record.manufacturer), record.manufacturer]
      );

      manufacturerId = manufacturerResult.rows[0]?.id ?? null;
    }

    const entityResult = await client.query<{ id: string }>(
      `
        INSERT INTO entities (
          type,
          slug,
          name,
          name_zh,
          description,
          manufacturer_id,
          primary_source_record_id,
          stats
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb)
        ON CONFLICT (slug)
        DO UPDATE SET
          type = EXCLUDED.type,
          name = EXCLUDED.name,
          name_zh = EXCLUDED.name_zh,
          description = EXCLUDED.description,
          manufacturer_id = EXCLUDED.manufacturer_id,
          primary_source_record_id = EXCLUDED.primary_source_record_id,
          stats = EXCLUDED.stats,
          deleted_at = NULL,
          updated_at = now()
        RETURNING id;
      `,
      [
        record.type,
        record.slug,
        record.name,
        record.nameZh ?? null,
        record.summary,
        manufacturerId,
        sourceResult.rows[0]?.id,
        JSON.stringify(record.stats)
      ]
    );

    const entityId = entityResult.rows[0]?.id;
    if (!entityId) {
      throw new Error(`Failed to upsert entity: ${record.name}`);
    }

    await client.query("DELETE FROM entity_tags WHERE entity_id = $1", [entityId]);

    for (const tag of record.tags) {
      await client.query(
        `
          INSERT INTO entity_tags (entity_id, tag)
          VALUES ($1, $2)
          ON CONFLICT DO NOTHING;
        `,
        [entityId, tag]
      );
    }

    if (record.nameZh) {
      await client.query(
        `
          INSERT INTO aliases (entity_id, language, alias, normalized_alias, source)
          VALUES ($1, 'zh-CN', $2, lower($2), $3)
          ON CONFLICT (entity_id, language, normalized_alias)
          DO UPDATE SET alias = EXCLUDED.alias, source = EXCLUDED.source;
        `,
        [entityId, record.nameZh, record.source.sourceName]
      );
    }

    await client.query("COMMIT");
    return entityId;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
