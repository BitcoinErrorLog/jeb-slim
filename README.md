# jeb-slim

Smallest credible Pubky mention-reply bot. Measuring instrument, not a product.

## Run

```bash
cp .env.example .env
# set JEB_SLIM_SECRET_KEY_HEX or:
npm run keygen -- --out ./secrets/bot.key   # prints public z32 only
docker compose up --build
```

Tests need Postgres: `bash scripts/test-pg.sh` then `DATABASE_URL=postgres://postgres:postgres@127.0.0.1:55437/postgres npm test`.

Contract: compile `npm run build`, then from `jeb-contract` (SDK-only; `env.testnet` selects `Pubky.testnet()` vs `new Pubky()`):

```bash
CONTRACT_HOMESERVER=staging \
  CONTRACT_STAGING_ADMIN_PASSWORD="$(cat /tmp/jeb-staging-admin.pw)" \
  DATABASE_URL=postgres://johncarvalho@127.0.0.1:5432/jeb_slim_test \
  CONTRACT_ADAPTER=/Volumes/vibedrive/vibes-dev/jeb-slim/dist/contract-adapter.js \
  npm test
```
