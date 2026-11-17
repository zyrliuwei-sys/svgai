# SeeAPI SVG integration — first version

Verified 2026-11-17 against https://www.seeapi.com/docs/gpt-image-2-6-sunburst/text-to-image/
and the authenticated `GET /v1/prices` endpoint. The configured key was used only on the server.
No deployment or schema migration was performed.

- Model: `gpt-image-2-6-sunburst`, endpoint `text-to-image`, provider `seeapi`.
- Native SVG output, 1K, medium quality, high complexity. Uploaded-image tracing stays free and local.
- API pricing rule: `provider_cost_prepaid`, initial reservation 20 provider credits,
  precision 0.001, final cost supplied after delivery. Missing cost stays pending.
- Official token prices per million: text input 1,300 provider credits; cached text
  325; image input 2,080; cached image 520; text output 2,600; image output 7,800.
- App debit: `ceil(actual provider consumed_credits × 8)`. Reserve 160 app credits;
  return unused reservation, charge the difference if usage exceeds it. A result
  requiring more balance remains pending until top-up and resume. Failed or unsafe
  results return the entire reservation. Preserve source-grant expiration on release.
- Official USD equivalents depend on the upstream purchase plan. The public docs
  default to the discounted Studio yearly basis (~$0.00375/provider credit).
  The conservative one-time Creator Pack is $299/55,000 (~$0.005436/provider credit),
  verified at https://www.seeapi.com/pricing/. Our packs are $9/1,600, $29/5,200,
  $79/14,400 credits, available once or monthly. Effective app-credit prices are
  at least that conservative basis, so the 8× usage debit preserves at least 8×
  gross API cost before tax/payment fees on this reference purchase plan.
- Real smoke test: task `task_22963d50ee164516b9cf3f7f60a44735`, native SVG delivered,
  10.816 provider credits, equivalent app debit 87. This provider-only smoke test
  did not debit a real product user's balance.
- Client persists pending request/task per signed-in user. Poll with backoff and
  retain ambiguous submissions on network failure. The same idempotency key recovers
  a lost submit response. An open browser resumes settlement; there is no scheduled
  background reconciliation or webhook in this first version.
- Saved payment providers were all disabled at verification time. Checkout is wired
  to the server catalog, with a clear unavailable state until a provider is enabled.

## Verification

- 65 regression tests pass (generation, credit/payment guards, refunds, installers,
  English-only copy and vector sanitization), plus 14 billing tests on real local D1.
- TypeScript check and production build pass. Security scan passes with no findings.
- Isolated browser QA used the saved provider key with a temporary local account:
  two native SVG results cost 88 and 87 app credits. The 1,000-credit QA balance
  settled to 825, with exactly two task records. Real production user balances were untouched.
- Reload while processing retained the same task ID. Completed output is restored
  after reload without resubmitting generation. Native SVG download verified.
- Pricing tabs, USD amounts and credit allowances verified. Light and dark mobile
  screenshots inspected. No horizontal overflow at 320, 390, 768 or 1440px.
