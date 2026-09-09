import { NextResponse } from "next/server";
import { dataSourceCatalog } from "@/lib/sources/catalog";
import { withSecurityHeaders } from "@/lib/security/headers";

export const runtime = "nodejs";

export async function GET() {
  return withSecurityHeaders(
    NextResponse.json({
      data: dataSourceCatalog,
      meta: {
        count: dataSourceCatalog.length
      }
    })
  );
}

