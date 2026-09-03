export interface Config {
  nexusUrl: string;
  homeserverPk: string;
  signupToken?: string;
  secretKeyHex: string;
  databaseUrl: string;
  cannedReply?: string;
  modelDelayMs: number;
  maxRepliesPerThread: number;
  maxPerUserPerHour: number;
  maxAgeMinutes: number;
  pollMs: number;
  model: string;
  modelBaseUrl?: string;
  modelApiKey?: string;
  modelTimeoutMs: number;
  blocklist: Set<string>;
  disabledEnv: boolean;
  port?: number;
}

function req(name: string): string {
  const v = process.env[name]?.trim();
  if (!v) throw new Error(`missing ${name}`);
  return v;
}

function num(name: string, fallback: number): number {
  const raw = process.env[name];
  if (raw === undefined || raw === "") return fallback;
  const n = Number(raw);
  if (!Number.isFinite(n)) throw new Error(`invalid ${name}`);
  return n;
}

export function configFromProcessEnv(): Config {
  const hex = req("JEB_SLIM_SECRET_KEY_HEX");
  if (!/^[0-9a-fA-F]{64}$/.test(hex)) throw new Error("JEB_SLIM_SECRET_KEY_HEX must be 32-byte hex");
  const portRaw = process.env.JEB_SLIM_PORT;
  return {
    nexusUrl: process.env.JEB_SLIM_NEXUS_URL?.trim() || "https://nexus.staging.pubky.app",
    homeserverPk: process.env.JEB_SLIM_HOMESERVER?.trim() || "",
    signupToken: process.env.JEB_SLIM_SIGNUP_TOKEN?.trim() || undefined,
    secretKeyHex: hex.toLowerCase(),
    databaseUrl: req("DATABASE_URL"),
    cannedReply: process.env.JEB_SLIM_CANNED_REPLY || undefined,
    modelDelayMs: num("JEB_SLIM_MODEL_DELAY_MS", 0),
    maxRepliesPerThread: num("JEB_SLIM_MAX_REPLIES_PER_THREAD", 1),
    maxPerUserPerHour: num("JEB_SLIM_MAX_PER_USER_PER_HOUR", 5),
    maxAgeMinutes: num("JEB_SLIM_MAX_AGE_MINUTES", 30),
    pollMs: num("JEB_SLIM_POLL_MS", 10_000),
    model: process.env.JEB_SLIM_MODEL?.trim() || "gpt-4o-mini",
    modelBaseUrl: process.env.JEB_SLIM_MODEL_BASE_URL?.trim() || undefined,
    modelApiKey: process.env.JEB_SLIM_MODEL_API_KEY || undefined,
    modelTimeoutMs: num("JEB_SLIM_MODEL_TIMEOUT_MS", 30_000),
    blocklist: new Set(
      (process.env.JEB_SLIM_BLOCKLIST ?? "")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
    ),
    disabledEnv: process.env.JEB_SLIM_DISABLED === "1",
    port: portRaw ? Number(portRaw) : undefined,
  };
}
