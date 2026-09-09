import { NextResponse } from "next/server";
import { getPool } from "@/lib/db/client";
import { env, hasDatabaseConfig, hasUpstashConfig } from "@/lib/env";
import { withSecurityHeaders } from "@/lib/security/headers";

export const runtime = "nodejs";

export async function GET() {
  const pool = getPool();
  let database = hasDatabaseConfig() ? "configured" : "not_configured";

  if (pool) {
    try {
      await pool.query("SELECT 1");
      database = "ok";
    } catch {
      database = "error";
    }
  }

  return withSecurityHeaders(
    NextResponse.json({
      ok: database !== "error",
      service: env.NEXT_PUBLIC_SITE_NAME,
      checks: {
        database,
        upstashRateLimit: hasUpstashConfig() ? "configured" : "memory_fallback"
      }
    })
  );
}

