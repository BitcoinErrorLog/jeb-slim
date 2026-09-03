# jeb-slim report

Measuring-instrument mention-reply bot. Local commits only; no remotes.

## Proof (after contract 3428ea0)

### `npm run typecheck`

```
> jeb-slim@0.1.0 typecheck
> tsc --noEmit
```

Exit 0.

### `npm test`

```
DATABASE_URL=postgres://johncarvalho@127.0.0.1:5432/jeb_slim_test npm test

 Test Files  4 passed (4)
      Tests  12 passed (12)
```

### Contract, staging, 19/19

```
cd /Volumes/vibedrive/vibes-dev/jeb-contract && \
  CONTRACT_HOMESERVER=staging \
  CONTRACT_STAGING_ADMIN_PASSWORD="$(cat /tmp/jeb-staging-admin.pw)" \
  DATABASE_URL=postgres://johncarvalho@127.0.0.1:5432/jeb_slim_test \
  CONTRACT_ADAPTER=/Volumes/vibedrive/vibes-dev/jeb-slim/dist/contract-adapter.js \
  npm test
```

```
[jeb-contract] homeserver mode=staging
 ✓ tests/contract.test.ts (14 tests) 102249ms
 ✓ tests/fixtures-shape.test.ts (4 tests)
 ✓ tests/process-group.test.ts (1 test)
 Test Files  3 passed (3)
      Tests  19 passed (19)
 Duration  103.47s
```

Admin password was read only via that substitution. Not logged, not written into this repo.

## LOC (`wc -l` on `src/*.ts` excluding tests)

**1004** lines (was 1061 with the fake fallback).

Breakdown: bot 206, db 150, types 108, homeserver 98, config 67, nexus 54, contract-adapter 43, context 34, model 31, keygen 25, health 19, policy 15, log 13, index 10.

Still above the ~500 target. The drop is the deleted `FallbackTransport` / `JEB_CONTRACT_RUNTIME` path (~70 lines). The rest is product: poll, Postgres idempotency, policy, SDK publish/readback. Not compressed to game the count.

## Transport

The bot has **zero test-only transport code**. Publish and readback go through `@synonymdev/pubky` `SessionTransport` only. `env.testnet` (or `JEB_SLIM_TESTNET=1`) selects `Pubky.testnet()` vs `new Pubky()`. Sign-in first, then signup. No harness runtime file is read.

Cursor is keyed by `(bot_id, nexus_url)` so one bot talking to different Nexus bases does not share an `end` cursor.

## Left out

- Live model call (no API key used or searched; canned path used by the contract).
- Local `pubky-testnet` (UDP 6881 taken; staging is the prescribed mode).
- Sub-500 LOC (not met; remaining lines are required product behavior).
