import { existsSync, readFileSync } from "node:fs";
import { Keypair, Pubky, PublicKey } from "@synonymdev/pubky";
import { PubkyAppPostKind, PubkySpecsBuilder } from "pubky-app-specs";
import { POSTS_PREFIX, STATIC_TESTNET_HS } from "./types.js";

export interface Published {
  path: string;
  uri: string;
  json: Record<string, unknown>;
}

export interface Transport {
  botPk: string;
  putJson(path: string, json: unknown): Promise<void>;
  getJson(path: string): Promise<unknown>;
  listPosts(): Promise<Array<{ parent?: string; uri: string }>>;
}

interface RuntimeFile {
  mode?: string;
  fallbackUrl?: string;
}

function readContractRuntime(): RuntimeFile | null {
  const file = process.env.JEB_CONTRACT_RUNTIME;
  if (!file || !existsSync(file)) return null;
  return JSON.parse(readFileSync(file, "utf8")) as RuntimeFile;
}

class FallbackTransport implements Transport {
  constructor(
    readonly botPk: string,
    private readonly base: string,
    private readonly cookie: string,
  ) {}

  private headers(): Record<string, string> {
    return {
      "content-type": "application/json",
      cookie: `session=${this.cookie}`,
      "x-pubky-user": this.botPk,
    };
  }

  async putJson(path: string, json: unknown): Promise<void> {
    const res = await fetch(`${this.base}${path}`, {
      method: "PUT",
      headers: this.headers(),
      body: JSON.stringify(json),
    });
    if (!res.ok) throw new Error(`put ${res.status}`);
  }

  async getJson(path: string): Promise<unknown> {
    const res = await fetch(`${this.base}${path}`, { headers: this.headers() });
    if (!res.ok) throw new Error(`get ${res.status}`);
    return res.json();
  }

  async listPosts(): Promise<Array<{ parent?: string; uri: string }>> {
    const res = await fetch(`${this.base}${POSTS_PREFIX}`, { headers: this.headers() });
    if (!res.ok) return [];
    const listed: unknown = await res.json();
    const urls = Array.isArray(listed) ? listed.map(String) : [];
    const out: Array<{ parent?: string; uri: string }> = [];
    for (const url of urls) {
      const id = url.split("/").filter(Boolean).pop();
      if (!id) continue;
      const json = (await this.getJson(`${POSTS_PREFIX}${id}`)) as { parent?: string };
      out.push({ parent: json.parent, uri: `pubky://${this.botPk}${POSTS_PREFIX}${id}` });
    }
    return out;
  }
}

class SessionTransport implements Transport {
  constructor(
    readonly botPk: string,
    private readonly session: Awaited<ReturnType<ReturnType<Pubky["signer"]>["signin"]>>,
    private readonly pubky: Pubky,
  ) {}

  async putJson(path: string, json: unknown): Promise<void> {
    await this.session.storage.putJson(path as never, json);
  }

  async getJson(path: string): Promise<unknown> {
    return this.session.storage.getJson(path as never);
  }

  async listPosts(): Promise<Array<{ parent?: string; uri: string }>> {
    const addr = `pubky${this.botPk}${POSTS_PREFIX}`;
    let listed: unknown;
    try {
      listed = await this.pubky.publicStorage.list(addr as never, null, false, 200, false);
    } catch {
      listed = [];
    }
    const urls = Array.isArray(listed) ? listed.map(String) : [];
    const out: Array<{ parent?: string; uri: string }> = [];
    for (const url of urls) {
      const id = url.split("/").filter(Boolean).pop();
      if (!id) continue;
      try {
        const json = (await this.pubky.publicStorage.getJson(url as never)) as { parent?: string };
        out.push({ parent: json.parent, uri: `pubky://${this.botPk}${POSTS_PREFIX}${id}` });
      } catch {
        continue;
      }
    }
    return out;
  }
}

export async function openTransport(opts: {
  secretKeyHex: string;
  homeserverPk: string;
  signupToken?: string;
}): Promise<Transport> {
  const raw = Buffer.from(opts.secretKeyHex, "hex");
  if (raw.length !== 32) throw new Error("secret must be 32 bytes");
  const keypair = Keypair.fromSecret(raw);
  const botPk = keypair.publicKey.z32();
  const runtime = readContractRuntime();
  if (runtime?.mode === "fallback-http" && runtime.fallbackUrl) {
    const token = opts.signupToken ?? "";
    const res = await fetch(
      `${runtime.fallbackUrl}/signup?signup_token=${encodeURIComponent(token)}`,
      { method: "POST", headers: { "x-pubky-user": botPk } },
    );
    const set = res.headers.get("set-cookie") ?? "";
    const m = /session=([^;]+)/.exec(set);
    return new FallbackTransport(botPk, runtime.fallbackUrl, m?.[1] ?? "");
  }
  const pubky =
    opts.homeserverPk === STATIC_TESTNET_HS || runtime?.mode === "pubky-testnet"
      ? Pubky.testnet()
      : new Pubky();
  const signer = pubky.signer(keypair);
  let session;
  if (opts.signupToken && opts.homeserverPk) {
    const hs = PublicKey.from(opts.homeserverPk);
    try {
      session = await signer.signup(hs, opts.signupToken);
    } catch {
      session = await signer.signin();
    }
  } else {
    session = await signer.signin();
  }
  return new SessionTransport(botPk, session, pubky);
}

export async function publishReply(t: Transport, parentUri: string, content: string): Promise<Published> {
  const specs = new PubkySpecsBuilder(t.botPk);
  const kind = content.length > 2000 ? PubkyAppPostKind.Long : PubkyAppPostKind.Short;
  const { post, meta } = specs.createPost(content.slice(0, 2000), kind, parentUri, null, null);
  const json = post.toJson() as Record<string, unknown>;
  await t.putJson(meta.path, json);
  const read = await t.getJson(meta.path);
  if (!read || typeof read !== "object") throw new Error("readback failed");
  return { path: meta.path, uri: meta.url, json };
}

export async function existingReply(t: Transport, parentUri: string): Promise<string | null> {
  const posts = await t.listPosts();
  return posts.find((p) => p.parent === parentUri)?.uri ?? null;
}
