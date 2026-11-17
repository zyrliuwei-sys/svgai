# Active implementation: preview before payment

User requirements: monthly plans must cost less for the same credits; show SVG file estimates on every price. Visitors can generate one free preview without registering, shared across text and image modes; downloading requires verified payment. Preserve existing credit accounting and payment integrity.

In progress:

- Monthly catalog changed to $7 / $22 / $59 versus one-time $9 / $29 / $79. Credits stay 1,600 / 5,200 / 14,400. Estimates use 160 credits: 10 / 32 / 90 SVGs. Monthly comparison/savings UI added. Need update existing catalog margin test to support the authorized monthly discount (6x provider-cost floor; one-time stays 8x), and test monotonically improving per-credit value.
- Installed @cf-wasm/resvg, fast-png; @cf-wasm/plugins dev install pending.
- Added svgPreview and svgPreviewQuota definitions to active SQLite/D1 schema and schema.sqlite template; DB NOT YET SYNCED.

Implementation design:

- Signed HttpOnly visitor cookie (HMAC with existing AUTH_SECRET), durable one-preview claim unique by visitor and nullable unique user ID. Bind preview to authenticated user on sign-in, reject cross-account access. Hash IP for persistent daily counters (3/IP, configurable global limit), plus IP/user rate limits. Concurrent requests use atomic guards and provider idempotency keys.
- SVG sources stay on server; use Resvg WASM to rasterize PNG previews. No raw SVG/outline/code response for unpaid preview. A preview PNG endpoint must check visitor/account ownership and no-store. Public demo samples remain public, but UI download/copy invokes paywall until paid.
- Browser normalizes uploaded PNG/JPEG/WebP to a bounded PNG (512px) WITHOUT tracing or generating any SVG. Server decodes PNG with fast-png, traces via existing ImageTracerJS, sanitizes, caps SVG size, rasterizes. Pending preview stores normalized image in options, clears it once complete to keep each D1 row under 2MB.
- Existing paid text generation keeps actual provider usage ×8. Paid image conversion costs 160 credits. Need a new ai-tasks atomic helper that creates a completed SVG task and deducts credits together (unique deterministic task/ledger ID) for image conversion and free-preview export unlock. It should not create a fake payment/order.
- A verified non-refunded paid order for one of the six SVG products is required for generation after the trial and ALL generated SVG exports. Admin credits/free signup credits alone do not grant paid entitlement. Existing paid task GET must enforce this too.
- Export trial: first bind owner, then atomic completed-task/credit consumption keyed to preview ID; replay returns same successful task without charging twice. Repeat downloads do not spend more credits.
- Frontend: preserve existing paid text retry/recovery logic. Add guest trial branch and raster-only result state. Disable/gate code/outline/palette until unlock; paywall dialog on download/copy, shared with expanded view. No signup before first generation. Paid image branch calls server. Restore trial across refresh/sign-in via cookie. Pricing carries preview intent through sign-in/checkout and returns to generator after purchase, using server-confirmed paid state.
- Timeline: custom source for bound preview rows, register server-only svg_preview event label. Update all copy/privacy docs that currently claim free unlimited browser-only image tracing.

Still required: implement services/routes/UI, sync additive D1 tables (site remains undeployed), local isolated atomic tests and D1 path tests, browser anonymous preview/paywall/no raw SVG leakage checks, paid fixture tests, production build/typecheck and Cloudflare WASM build/runtime validation. No real checkout or fake paid records in live DB. Test with a separate anonymous cookie jar/127.0.0.1 host to avoid consuming the user's browser trial.

Environment: local preview http://localhost:3001, remote D1 svgai id 359821ff-63dc-414d-b9f9-55b7982269a3, R2 configured via encrypted D1 admin settings. Existing source has concurrent unrelated edits; preserve them. No deployment requested by latest task. Main site has not been reachable; CDN cdn.aisvg-generator.com is live. Read /Users/wl./.agents/skills/ego-browser/SKILL.md and run ego-browser skill before browser work. New browser goal gets a new TaskSpace (prior space 53 finished, user kept logo preview). No proactive subagents unless explicitly requested by user or applicable skill.
