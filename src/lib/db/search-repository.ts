import { dbQuery, getPool } from "./client";
import type { EntityType, FreshnessStatus, SearchInput, SearchRecord } from "../types";
import type { QueryResultRow } from "pg";

interface SearchRow extends QueryResultRow {
  id: string;
  type: EntityType;
  slug: string;
  name: string;
  name_zh: string | null;
  manufacturer_name: string | null;
  description: string | null;
  tags: string[] | null;
  stats: Record<string, string | number | null> | null;
  source_name: string;
  source_url: string | null;
  source_record_id: string | null;
  game_version: string | null;
  fetched_at: Date | null;
  source_updated_at: Date | null;
  freshness_status: FreshnessStatus;
}

const MAX_LIMIT = 50;

export async function searchRecordsFromDb(input: SearchInput): Promise<SearchRecord[] | null> {
  if (!getPool()) {
    return null;
  }

  const values: unknown[] = [];
  const where: string[] = ["e.deleted_at IS NULL"];

  if (input.type && input.type !== "all") {
    values.push(input.type);
    where.push(`e.type = $${values.length}`);
  }

  if (input.freshness && input.freshness !== "all") {
    values.push(input.freshness);
    where.push(`sr.freshness_status = $${values.length}`);
  }

  if (input.query?.trim()) {
    values.push(`%${input.query.trim()}%`);
    where.push(`(
      e.search_text ILIKE $${values.length}
      OR EXISTS (
        SELECT 1 FROM aliases a
        WHERE a.entity_id = e.id
        AND a.normalized_alias ILIKE $${values.length}
      )
    )`);
  }

  values.push(Math.min(Math.max(input.limit ?? 25, 1), MAX_LIMIT));

  const sql = `
    SELECT
      e.id,
      e.type,
      e.slug,
      e.name,
      e.name_zh,
      m.name AS manufacturer_name,
      e.description,
      COALESCE(array_agg(DISTINCT et.tag) FILTER (WHERE et.tag IS NOT NULL), '{}') AS tags,
      e.stats,
      COALESCE(sr.source_name, 'ENIGMA') AS source_name,
      sr.source_url,
      sr.source_record_id,
      sr.game_version,
      sr.fetched_at,
      sr.source_updated_at,
      COALESCE(sr.freshness_status, 'unknown') AS freshness_status
    FROM entities e
    LEFT JOIN manufacturers m ON m.id = e.manufacturer_id
    LEFT JOIN entity_tags et ON et.entity_id = e.id
    LEFT JOIN source_records sr ON sr.id = e.primary_source_record_id
    WHERE ${where.join(" AND ")}
    GROUP BY e.id, m.name, sr.id
    ORDER BY e.name ASC
    LIMIT $${values.length};
  `;

  const result = await dbQuery<SearchRow>(sql, values);

  return result.rows.map((row) => {
    const stats = row.stats ?? {};
    const categoryLabel = typeof stats["Wiki Category"] === "string" ? stats["Wiki Category"] : undefined;

    return {
      id: row.id,
      type: row.type,
      slug: row.slug,
      name: row.name,
      nameZh: row.name_zh ?? undefined,
      manufacturer: row.manufacturer_name ?? undefined,
      categoryLabel,
      summary: row.description ?? "",
      tags: row.tags ?? [],
      stats,
      source: {
        sourceName: row.source_name,
        sourceUrl: row.source_url ?? undefined,
        sourceRecordId: row.source_record_id ?? undefined,
        gameVersion: row.game_version ?? undefined,
        fetchedAt: row.fetched_at?.toISOString(),
        sourceUpdatedAt: row.source_updated_at?.toISOString(),
        freshness: row.freshness_status
      }
    };
  });
}
