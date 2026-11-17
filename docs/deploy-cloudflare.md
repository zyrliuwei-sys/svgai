# Cloudflare deployment

Production: https://aisvg-generator.com

- GitHub repository: `zyrliuwei-sys/svgai`, production branch `main`.
- Worker: `svgai`, account `d7c3d8fa2229ed65b03fd28fc8659989`.
- D1: `svgai`, binding `DB`, database ID `359821ff-63dc-414d-b9f9-55b7982269a3`.
- R2: `svgai`; credentials and CDN settings remain encrypted in the D1 admin configuration.

`cloudflare/production.json` contains public deployment configuration. `scripts/cloudflare.mjs` materializes the ignored root `wrangler.jsonc` from it, sets production build variables, builds the SQLite/D1 schema and Workers bundle, and deploys with Wrangler. A clean Git checkout therefore needs no manually copied configuration or local env file.

Local manual deployment:

```sh
pnpm install --frozen-lockfile
pnpm cf:deploy
```

The optional ignored `.env.production.local` / `.env.production` files can provide local credentials. They are parsed as data, never executed as shell code. `AUTH_SECRET` and `CONFIG_ENCRYPTION_KEY` are runtime Workers secrets and remain stable across deployments. Never commit either value or put it in the public deployment manifest.

Cloudflare Workers Builds is connected to this repository and the existing `svgai` Worker. Production branch is `main`, build command is `pnpm cf:build`, deploy command is `pnpm exec wrangler deploy`, and root directory is `/`. Preview builds are disabled to keep other branches away from production resources. Node and pnpm versions are pinned in `.node-version` and `package.json`. Local edits must be committed and pushed to GitHub to trigger a cloud build.

The existing D1 database already contains the application schema, configured admin and encrypted provider settings. Application builds do not run destructive `db:push` against production. Future schema changes must be generated and reviewed as migrations before explicitly applying them to D1, following `AGENTS.md`; code-only deployments reuse the current database.

Verification after deployment includes the public domain, database-backed configuration, authentication endpoints, pricing, PNG-only anonymous preview ownership, and logo/favicon assets. Payment providers must still be configured in the admin panel before accepting purchases.
