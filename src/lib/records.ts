import { mockRecords } from "./mock-data";
import type { SearchRecord } from "./types";

export function findRecordBySlug(slug: string, records: SearchRecord[] = mockRecords): SearchRecord | undefined {
  return records.find((record) => record.slug === slug);
}

export function listRecordSlugs(records: SearchRecord[] = mockRecords): string[] {
  return records.map((record) => record.slug);
}

