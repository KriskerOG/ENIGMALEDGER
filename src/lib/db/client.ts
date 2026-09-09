import { Pool, type QueryResult, type QueryResultRow } from "pg";
import { env, hasDatabaseConfig } from "../env";

type GlobalWithPool = typeof globalThis & {
  __enigmaPgPool?: Pool;
};

export function getPool(): Pool | null {
  if (!hasDatabaseConfig()) {
    return null;
  }

  const globalForPool = globalThis as GlobalWithPool;

  if (!globalForPool.__enigmaPgPool) {
    globalForPool.__enigmaPgPool = new Pool({
      connectionString: env.DATABASE_URL,
      max: 10,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 5_000
    });
  }

  return globalForPool.__enigmaPgPool;
}

export async function dbQuery<T extends QueryResultRow = QueryResultRow>(
  text: string,
  values: unknown[] = []
): Promise<QueryResult<T>> {
  const pool = getPool();

  if (!pool) {
    throw new Error("DATABASE_URL is not configured.");
  }

  return pool.query<T>(text, values);
}
