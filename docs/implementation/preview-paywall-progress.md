# Preview before payment — implemented

Updated 2026-11-17. The application remains local; this work did not deploy the website or process a real purchase.

## Product behavior

- One free preview without registration, shared between text and image input. The signed HttpOnly visitor session recovers the preview after refresh; signing in binds it to the account.
- Only a private PNG preview reaches an unpaid visitor. SVG download, source copying and generated outline access require a verified, non-refunded SVG purchase. Signup credits or admin-granted credits alone do not unlock exports.
- First unlock deducts the displayed credit cost atomically. Repeat exports of that result reuse the completed task without another deduction. Image conversion costs 160 credits; text generation settles to provider usage multiplied by 8.
- Browser uploads are validated and resized to a bounded PNG. Tracing and raster preview rendering run on the server. Successful previews discard the temporary source image.
- Preview intent survives pricing, sign-in and the checkout return. Image requests persist only a fingerprint and idempotency identifier for safe network retries; completed results can be recovered by task ID.

## Prices

| Tier    | One-time | Monthly | Credits | Estimated SVG files |
| ------- | -------: | ------: | ------: | ------------------: |
| Starter |       $9 |      $7 |   1,600 |                  10 |
| Pro     |      $29 |     $22 |   5,200 |                  32 |
| Studio  |      $79 |     $59 |  14,400 |                  90 |

File estimates use 160 credits per SVG. Actual text generation usage varies. Larger tiers improve per-credit value in both billing groups. Monthly credits expire at the billing-period end; one-time credits do not expire.

## Data and enforcement

The additive `scripts/sql/svg-preview.sql` was applied to the existing shared development D1 `svgai`. Both SQLite/D1 schema definitions include the new preview and quota tables. Existing data was preserved. The site is not deployed.

Claims use atomic batches with unique visitor/account indexes, a persistent keyed network/browser claim, a 3-attempt daily IP allowance and a site-wide daily attempt cap. `SVG_FREE_PREVIEW_DAILY_LIMIT` defaults to 100 and is documented in `.env.example`. Failed jobs have bounded retries. No raw IP or browser identifier is stored in these quota records.

Anonymous checks cannot prove a person's identity across every device and network. Cookies, account binding and network/browser hashes enforce the allowance within the available identity signals. The Privacy Policy describes this limitation and the actual processing/storage behavior.

## Verification

- `pnpm test:svg`: 45 tests passed, including provider-mocked anonymous text generation, isolated preview claims, concurrent unlocks, credit replay, malformed PNG rejection and existing SVG billing/vector tests.
- `pnpm test:svg:d1`: 27 tests passed using isolated local D1 batches. No fake paid orders were inserted into the shared live D1.
- `pnpm exec tsc --noEmit`: passed.
- `pnpm build` and `pnpm cf:build`: passed. Cloudflare output emits a compiled Resvg WASM module through Nitro. The emitted renderer was exercised in local workerd and returned a valid PNG (HTTP 200).
- Browser: anonymous image preview, refresh recovery, unpaid export HTTP 402, PNG content type, no SVG source in preview metadata, code paywall, preview intent through sign-in, monthly prices/counts and 390px layouts verified. Another session cannot read the private preview (HTTP 404).
- Existing R2 and logo verification are recorded separately in `docs/storage-r2.md` and `docs/brand/LOGO-COMPATIBILITY.md`.

## Remaining external configuration

Stripe, Creem and PayPal are currently disabled in public configuration. Checkout and payment settlement code remain connected to the server catalog, but no real payment was attempted. Enable and configure a payment provider in the admin panel before accepting purchases. AI text integration was tested with a provider mock, without spending credits on a live generation during this change.
