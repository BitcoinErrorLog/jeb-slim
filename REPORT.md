# jeb-slim report

Measuring-instrument mention-reply bot. Local commits only; no remotes.

## Proof

### `npm run typecheck`

```
> jeb-slim@0.1.0 typecheck
> tsc --noEmit
```

Exit 0.

### `npm test`

Postgres: Homebrew `johncarvalho@127.0.0.1:5432/jeb_slim_test` (see below).

```
DATABASE_URL=postgres://johncarvalho@127.0.0.1:5432/jeb_slim_test npm test

 Test Files  4 passed (4)
      Tests  12 passed (12)
```

Covers cursor/`end`, mention+reply filter, idempotent claim→published, ancestor createdAt order, self/blocklist/thread/hourly policy.

### Contract (20/20)

```
cd /Volumes/vibedrive/vibes-dev/jeb-contract && \
  DATABASE_URL=postgres://johncarvalho@127.0.0.1:5432/jeb_slim_test \
  CONTRACT_ADAPTER=/Volumes/vibedrive/vibes-dev/jeb-slim/dist/contract-adapter.js \
  npm test
```

```
[jeb-contract] using fallback homeserver (Postgres prerequisite missing ...)
 ✓ tests/contract.test.ts (15 tests)
 ✓ tests/fixtures-shape.test.ts (4 tests)
 ✓ tests/process-group.test.ts (1 test)
 Test Files  3 passed (3)
      Tests  20 passed (20)
```

Homeserver: in-process fallback (UDP 6881 taken; Docker testnet Postgres also unavailable). Staging sign-in skipped per follow-up brief.

## LOC (`wc -l` on `src/*.ts` excluding tests)

1061 lines (bot+homeserver+db dominate). Over the ~500 target because the contract needs a fallback HTTP transport plus Postgres idempotency/thread caps.

## Postgres for tests

Requested `docker run -d --name jeb-slim-pg -p 55437:5432 ... postgres:15-alpine`. On this machine the Docker daemon did not answer on `~/.docker/run/docker.sock` (CLI and HTTP ping timed out). Used an isolated local DB instead: `CREATE DATABASE jeb_slim_test` on Homebrew Postgres 17, user `johncarvalho`, no password in the URL. Schema is only `cursor_state`, `handled_mentions`, `kill_switch`.

`scripts/test-pg.sh` still documents the intended throwaway container.

## Fresh key

`npm run keygen -- --out secrets/bot.key` printed public `4n8q4u3a4msy5kdghk116y1mkpiuby13k7ub5hj39ihyqoxuh13o` only. Secret file mode 0600, gitignored. Not logged.

## What works

- Signin/signup (`Keypair.fromSecret`), Nexus poll with `end` cursor, first-boot max-age (disabled when `<= 0`).
- Mention + reply notifications; 404 parent → skip; 5xx poll retry.
- Claim-before-model; processing retry + list-own-posts recovery; publish via `PubkySpecsBuilder.createPost` + readback.
- Canned reply + `modelDelayMs`; Vercel AI SDK path when canned is unset.
- Policy: self, blocklist, per-thread cap, per-user hour, kill switch, fail-closed if Postgres is down.
- `debugLastContext()` ancestors newest-first (`createdAt` descending).
- `/healthz`, docker-compose + non-root Dockerfile, `.env.example` names only.

## Left out (and why)

- **Docker Postgres / pubky-testnet smoke:** Docker daemon hung; testnet UDP 6881 occupied. Contract fallback is the prescribed smoke test.
- **Staging homeserver signin:** skipped per additional context (no signup token hunt).
- **Live model call against OpenAI:** no API key used or searched; contract uses `cannedReply`. The `ai` + `@ai-sdk/openai` path is real and fails the mention as `failed` if the key is missing.
- **Sub-500 LOC:** not met; cutting further would drop required contract/idempotency behavior.
