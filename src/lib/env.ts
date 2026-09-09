import { z } from "zod";

const EnvSchema = z.object({
  DATABASE_URL: z.string().min(1).optional(),
  UEX_API_TOKEN: z.string().min(1).optional(),
  UEX_CLIENT_VERSION: z.string().min(1).default("enigma-verse-index/0.1.0"),
  SC_TRADE_TOOLS_API_BASE_URL: z.string().url().default("https://sc-trade.tools/api"),
  UPSTASH_REDIS_REST_URL: z.string().url().optional(),
  UPSTASH_REDIS_REST_TOKEN: z.string().min(1).optional(),
  NEXT_PUBLIC_SITE_NAME: z.string().min(1).default("ENIGMA Verse Index"),
  KOOK_BOT_TOKEN: z.string().min(1).optional(),
  KOOK_VERIFY_TOKEN: z.string().min(1).optional(),
  KOOK_ENCRYPT_KEY: z.string().min(1).optional(),
  KOOK_API_BASE_URL: z.string().url().default("https://www.kookapp.cn/api/v3")
});

export const env = EnvSchema.parse(process.env);

export function hasDatabaseConfig(): boolean {
  return Boolean(env.DATABASE_URL);
}

export function hasUpstashConfig(): boolean {
  return Boolean(env.UPSTASH_REDIS_REST_URL && env.UPSTASH_REDIS_REST_TOKEN);
}
