import { env } from "../env";
import { sanitizeKookText } from "./markdown";

const MAX_CHANNEL_MESSAGE_LENGTH = 1800;

export async function sendKookChannelMessage(targetId: string, content: string, quoteMessageId?: string) {
  if (!env.KOOK_BOT_TOKEN) {
    throw new Error("KOOK_BOT_TOKEN is required to send KOOK messages.");
  }

  const response = await fetch(`${env.KOOK_API_BASE_URL}/message/create`, {
    method: "POST",
    headers: {
      authorization: `Bot ${env.KOOK_BOT_TOKEN}`,
      "content-type": "application/json"
    },
    body: JSON.stringify({
      type: 9,
      target_id: targetId,
      content: sanitizeKookText(content, MAX_CHANNEL_MESSAGE_LENGTH),
      quote: quoteMessageId
    })
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`KOOK message send failed: ${response.status} ${body.slice(0, 300)}`);
  }

  return response.json() as Promise<unknown>;
}

