import pg from "pg";

export type MentionStatus = "processing" | "published" | "failed" | "skipped";

export class Store {
  readonly pool: pg.Pool;

  constructor(url: string) {
    this.pool = new pg.Pool({ connectionString: url, max: 4 });
  }

  async migrate(): Promise<void> {
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS cursor_state (
        bot_id TEXT PRIMARY KEY,
        last_ts BIGINT NOT NULL DEFAULT 0,
        first_boot_done BOOLEAN NOT NULL DEFAULT FALSE
      );
      CREATE TABLE IF NOT EXISTS handled_mentions (
        mention_key TEXT PRIMARY KEY,
        status TEXT NOT NULL,
        reply_uri TEXT,
        root_uri TEXT,
        author TEXT,
        bot_id TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );
      ALTER TABLE handled_mentions ADD COLUMN IF NOT EXISTS bot_id TEXT;
      CREATE TABLE IF NOT EXISTS kill_switch (
        id INT PRIMARY KEY DEFAULT 1,
        disabled BOOLEAN NOT NULL DEFAULT FALSE
      );
      INSERT INTO kill_switch (id, disabled) VALUES (1, FALSE) ON CONFLICT (id) DO NOTHING;
    `);
  }

  async close(): Promise<void> {
    await this.pool.end();
  }

  async ping(): Promise<boolean> {
    try {
      await this.pool.query("SELECT 1");
      return true;
    } catch {
      return false;
    }
  }

  async killSwitchOn(): Promise<boolean> {
    const r = await this.pool.query<{ disabled: boolean }>("SELECT disabled FROM kill_switch WHERE id = 1");
    return r.rows[0]?.disabled === true;
  }

  async getCursor(botId: string): Promise<{ lastTs: number; firstBootDone: boolean }> {
    const r = await this.pool.query(
      `INSERT INTO cursor_state (bot_id, last_ts, first_boot_done) VALUES ($1, 0, FALSE)
       ON CONFLICT (bot_id) DO UPDATE SET bot_id = EXCLUDED.bot_id
       RETURNING last_ts, first_boot_done`,
      [botId],
    );
    const row = r.rows[0] as { last_ts: string | number; first_boot_done: boolean };
    return { lastTs: Number(row.last_ts), firstBootDone: row.first_boot_done };
  }

  async setCursor(botId: string, lastTs: number, firstBootDone: boolean): Promise<void> {
    await this.pool.query(
      `INSERT INTO cursor_state (bot_id, last_ts, first_boot_done) VALUES ($1, $2, $3)
       ON CONFLICT (bot_id) DO UPDATE SET last_ts = EXCLUDED.last_ts, first_boot_done = EXCLUDED.first_boot_done`,
      [botId, lastTs, firstBootDone],
    );
  }

  async claim(mentionKey: string, author: string, botId: string): Promise<"claimed" | "exists"> {
    const r = await this.pool.query(
      `INSERT INTO handled_mentions (mention_key, status, author, bot_id)
       VALUES ($1, 'processing', $2, $3)
       ON CONFLICT (mention_key) DO UPDATE
         SET status = 'processing', author = EXCLUDED.author, bot_id = EXCLUDED.bot_id, updated_at = now()
         WHERE handled_mentions.status = 'failed'
       RETURNING mention_key`,
      [mentionKey, author, botId],
    );
    return r.rowCount === 1 ? "claimed" : "exists";
  }

  async get(mentionKey: string): Promise<{
    status: MentionStatus;
    reply_uri: string | null;
    root_uri: string | null;
    updated_at: Date;
  } | null> {
    const r = await this.pool.query(
      `SELECT status, reply_uri, root_uri, updated_at FROM handled_mentions WHERE mention_key = $1`,
      [mentionKey],
    );
    const row = r.rows[0];
    if (!row) return null;
    return {
      status: row.status as MentionStatus,
      reply_uri: row.reply_uri,
      root_uri: row.root_uri,
      updated_at: row.updated_at,
    };
  }

  async mark(mentionKey: string, status: MentionStatus, extra?: { replyUri?: string; rootUri?: string }): Promise<void> {
    await this.pool.query(
      `UPDATE handled_mentions SET status = $2, reply_uri = COALESCE($3, reply_uri),
       root_uri = COALESCE($4, root_uri), updated_at = now() WHERE mention_key = $1`,
      [mentionKey, status, extra?.replyUri ?? null, extra?.rootUri ?? null],
    );
  }

  async staleProcessing(olderThanMs: number): Promise<string[]> {
    const r = await this.pool.query<{ mention_key: string }>(
      `SELECT mention_key FROM handled_mentions
       WHERE status = 'processing' AND updated_at < now() - ($1::text || ' milliseconds')::interval`,
      [String(olderThanMs)],
    );
    return r.rows.map((x) => x.mention_key);
  }

  async publishedInThread(botId: string, rootUri: string): Promise<number> {
    const r = await this.pool.query(
      `SELECT COUNT(*)::int AS n FROM handled_mentions WHERE bot_id = $1 AND root_uri = $2 AND status = 'published'`,
      [botId, rootUri],
    );
    return r.rows[0]?.n ?? 0;
  }

  async publishedByAuthorLastHour(author: string): Promise<number> {
    const r = await this.pool.query(
      `SELECT COUNT(*)::int AS n FROM handled_mentions
       WHERE author = $1 AND status = 'published' AND updated_at > now() - interval '1 hour'`,
      [author],
    );
    return r.rows[0]?.n ?? 0;
  }
}
