import pino from "pino";

export const log = pino({
  level: process.env.JEB_SLIM_LOG_LEVEL ?? "info",
  redact: {
    paths: ["secretKeyHex", "apiKey", "JEB_SLIM_SECRET_KEY_HEX", "JEB_SLIM_MODEL_API_KEY"],
    remove: true,
  },
});

export function withMention(mention_key: string) {
  return log.child({ mention_key });
}
