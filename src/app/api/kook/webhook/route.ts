import { NextResponse, type NextRequest } from "next/server";
import { handleKookCommand, parseKookCommand } from "@/lib/kook/commands";
import { sendKookChannelMessage } from "@/lib/kook/client";
import { parseKookWebhookBody, verifyKookWebhook } from "@/lib/kook/payload";
import type { KookWebhookEvent } from "@/lib/kook/types";
import { withSecurityHeaders } from "@/lib/security/headers";

export const runtime = "nodejs";

const MAX_BODY_BYTES = 256 * 1024;

function isKookEvent(value: unknown): value is KookWebhookEvent {
  return Boolean(value && typeof value === "object" && !("challenge" in value));
}

export async function POST(request: NextRequest) {
  const rawBody = Buffer.from(await request.arrayBuffer());

  if (rawBody.length > MAX_BODY_BYTES) {
    return withSecurityHeaders(NextResponse.json({ error: "Payload too large." }, { status: 413 }));
  }

  let envelope;

  try {
    envelope = parseKookWebhookBody(rawBody);
  } catch {
    return withSecurityHeaders(NextResponse.json({ error: "Invalid KOOK payload." }, { status: 400 }));
  }

  if (!verifyKookWebhook(envelope)) {
    return withSecurityHeaders(NextResponse.json({ error: "Invalid verify token." }, { status: 401 }));
  }

  if (envelope.d && "challenge" in envelope.d && envelope.d.challenge) {
    return withSecurityHeaders(NextResponse.json({ challenge: envelope.d.challenge }));
  }

  const event = envelope.d;

  if (!isKookEvent(event) || event.extra?.author?.bot) {
    return withSecurityHeaders(NextResponse.json({ ok: true, ignored: true }));
  }

  const command = parseKookCommand(event.content ?? "");

  if (!command || !event.target_id) {
    return withSecurityHeaders(NextResponse.json({ ok: true, ignored: true }));
  }

  const reply = await handleKookCommand(command);

  if (reply.shouldSend) {
    await sendKookChannelMessage(event.target_id, reply.content, event.msg_id);
  }

  return withSecurityHeaders(NextResponse.json({ ok: true }));
}

export async function GET() {
  return withSecurityHeaders(
    NextResponse.json({
      ok: true,
      service: "ENIGMA KOOK webhook",
      hint: "Configure KOOK webhook POST callbacks to this route. Use ?compress=0 for MVP deployments."
    })
  );
}
