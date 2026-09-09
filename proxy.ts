import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { securityHeaders } from "./src/lib/security/headers";

export function proxy(request: NextRequest) {
  const response = NextResponse.next();
  const requestId = request.headers.get("x-request-id") ?? crypto.randomUUID();

  response.headers.set("x-request-id", requestId);

  Object.entries(securityHeaders).forEach(([key, value]) => {
    response.headers.set(key, value);
  });

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"]
};

