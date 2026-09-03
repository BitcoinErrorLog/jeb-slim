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

Contract: compile `npm run build`, then from `jeb-contract`:

```bash
DATABASE_URL=postgres://postgres:postgres@127.0.0.1:55437/postgres \
  CONTRACT_ADAPTER=/Volumes/vibedrive/vibes-dev/jeb-slim/dist/contract-adapter.js \
  npm test
```
