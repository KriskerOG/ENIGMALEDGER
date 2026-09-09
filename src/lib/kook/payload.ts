import crypto from "node:crypto";
import zlib from "node:zlib";
import { env } from "../env";
import type { KookWebhookEnvelope } from "./types";

function parseJsonBuffer(buffer: Buffer): KookWebhookEnvelope | null {
  try {
    return JSON.parse(buffer.toString("utf8")) as KookWebhookEnvelope;
  } catch {
    return null;
  }
}

function tryInflate(buffer: Buffer): Buffer | null {
  for (const inflate of [zlib.inflateSync, zlib.inflateRawSync]) {
    try {
      return inflate(buffer);
    } catch {
      continue;
    }
  }

  return null;
}

function decryptKookPayload(encryptedPayload: string): KookWebhookEnvelope {
  if (!env.KOOK_ENCRYPT_KEY) {
    throw new Error("KOOK_ENCRYPT_KEY is required for encrypted KOOK webhooks.");
  }

  const key = Buffer.alloc(32);
  Buffer.from(env.KOOK_ENCRYPT_KEY).copy(key);

  const encryptedEnvelope = Buffer.from(encryptedPayload, "base64");
  const iv = encryptedEnvelope.subarray(0, 16);
  const cipherText = Buffer.from(encryptedEnvelope.subarray(16).toString("utf8"), "base64");
  const decipher = crypto.createDecipheriv("aes-256-cbc", key, iv);
  const decrypted = Buffer.concat([decipher.update(cipherText), decipher.final()]).toString("utf8");
  const cleaned = decrypted.replace(/\0+$/g, "");

  return JSON.parse(cleaned) as KookWebhookEnvelope;
}

export function parseKookWebhookBody(rawBody: Buffer): KookWebhookEnvelope {
  const parsed = parseJsonBuffer(rawBody);

  if (parsed?.encrypt) {
    return decryptKookPayload(parsed.encrypt);
  }

  if (parsed) {
    return parsed;
  }

  const inflated = tryInflate(rawBody);
  const inflatedParsed = inflated ? parseJsonBuffer(inflated) : null;

  if (inflatedParsed?.encrypt) {
    return decryptKookPayload(inflatedParsed.encrypt);
  }

  if (inflatedParsed) {
    return inflatedParsed;
  }

  throw new Error("Unable to parse KOOK webhook payload.");
}

export function verifyKookWebhook(envelope: KookWebhookEnvelope): boolean {
  if (!env.KOOK_VERIFY_TOKEN) {
    return false;
  }

  const verifyToken = envelope.d?.verify_token;
  return verifyToken === env.KOOK_VERIFY_TOKEN;
}

