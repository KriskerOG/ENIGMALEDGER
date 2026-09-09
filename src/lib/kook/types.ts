export interface KookWebhookEnvelope {
  s?: number;
  d?: KookWebhookEvent | KookWebhookChallenge;
  sn?: number;
  encrypt?: string;
}

export interface KookWebhookChallenge {
  challenge?: string;
  verify_token?: string;
}

export interface KookWebhookEvent {
  type?: number;
  channel_type?: string;
  target_id?: string;
  author_id?: string;
  content?: string;
  msg_id?: string;
  msg_timestamp?: number;
  nonce?: string;
  verify_token?: string;
  extra?: {
    author?: {
      id?: string;
      username?: string;
      bot?: boolean;
    };
    body?: unknown;
    guild_id?: string;
    channel_name?: string;
  };
}

export interface KookCommand {
  name: "help" | "search" | "ship" | "item" | "price" | "route" | "unknown";
  args: string[];
  raw: string;
}

export interface KookReply {
  content: string;
  shouldSend: boolean;
}

