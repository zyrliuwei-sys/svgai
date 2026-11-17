# Customer experience audit — 2026-11-17

Tested as a visitor and a normal customer in the browser. Account creation,
profile changes, support tickets and credit fixtures used an isolated local
SQLite database. Existing customer accounts, orders and balances were not changed.
The configured SeeAPI key stayed on the server. No deployment or real payment was made.

## Coverage

- Public pages: home, Text to SVG, Image to SVG, Examples, How it works,
  Pricing, Privacy Policy, Terms of Service, Blog and Guest Post.
- Account pages: Overview, Profile, Credits, Billing, Payments and Support Tickets.
  Disabled API keys and guest-post features, signed-out account redirects,
  normal-user access to `/admin`, and a missing-page state were also checked.
- Authentication: sign-in, sign-up, forgotten password, missing-token password
  reset, email verification without context, invite redemption and auth callback.
  Checked validation, policy/support destinations, callback preservation and
  the login round trip with a saved creative brief.
- Clicked 114 public internal-link destinations, deduplicated by href within
  each source page; checked all six account sidebar destinations and the
  overview's studio/pricing/home navigation. Email targets were checked without
  sending mail. Both external SeeAPI policy destinations returned HTTP 200.
  Own-site links in legal content now use `/` so preview and staging users stay
  on the current site; availability of the public deployment domain is separate.
- Checked 16 public/account pages at 320px and 768px: 32 layout states, with
  no document-level horizontal overflow, missing H1 or broken visible images.
  Also inspected desktop and 390px views, both themes and mobile navigation.
- Exercised image selection, invalid file/size messages, browser tracing,
  preview/outline/code, copy, SVG download, zoom and the expanded preview.
- Clicked all six purchase buttons, all four gallery examples and all five
  homepage FAQ items. Confirmed the purchase-unavailable notice and opened answers.

## Fixes

1. Validate an empty creative brief before redirecting to sign-in.
2. Preserve prompt, style and canvas ratio across authentication.
3. Preserve the selected monthly plan across sign-in/sign-up and existing-session redirects.
4. Keep a saved text result from replacing Image to SVG or an explicitly selected example.
5. Accept numeric XML whitespace references emitted by SeeAPI. Other entities,
   executable elements and external resources remain rejected. Added regression coverage.
6. Refresh available credits both when a task reserves credits and when it settles.
7. Use accurate settled/returned descriptions in generation credit records,
   while retaining the atomic settlement and permanent idempotency key.
8. Refresh the account session after saving a profile name.
9. Close the mobile account sidebar after navigation and render each navigation
   entry as one link, without a nested button.
10. Give account pages distinct browser titles; retain private-page noindex metadata.
11. Add a direct Create an SVG action to the account overview.
12. Add policy/support links to authentication pages; replace raw validation,
    reset-link and unavailable-state wording with user-facing English.
13. Give account/menu and ticket controls accessible names; fix table count grammar
    and replace internal credit source/type labels with readable copy.
14. Close the quick-support dialog when following its ticket link, and move the
    development query-tools button so it does not cover Contact support.
15. Keep the legal pages' own-site links inside the current website.

## Real generation and verification

The first real generation exposed the XML-whitespace compatibility bug. It was
rejected safely and the full 160-credit reservation was returned. After the fix,
a second generation produced a native SVG with three paths at 1024 × 768.
The downloaded file was parsed again successfully and contained no raster image.

SeeAPI reported 7.657 credits. The final debit was `ceil(7.657 × 8) = 62`;
the isolated account moved from 1000 to 840 during reservation, then to 938
after settlement. No additional generation ran during the subsequent login test.

- Production build: passed.
- TypeScript check: passed.
- Generation, vector parsing, billing, English copy, SeeAPI and request-security
  regression tests: 46 passed.
- Real local D1 billing tests: 14 passed.
- Rechecked draft and monthly-plan callbacks on the built production server.
- Worktree security scanner: 172 changed files checked, no findings. Reviewed
  the changed redirect paths, bounded SVG whitespace normalization and atomic
  credit-description update against the repository security checklist.

| Severity | Area                             | Finding                                   | Action                            |
| -------- | -------------------------------- | ----------------------------------------- | --------------------------------- |
| None     | Changes from this customer audit | No unresolved security finding identified | No commit or deployment performed |

The isolated QA server, temporary account database and setup scripts were removed
after verification. Existing development servers were left running.

## Configuration limits

Payment providers are disabled in the tested configuration. Purchase buttons
show the unavailable state; real checkout, renewal, cancellation of a paid plan
and processor refunds cannot be verified until a provider is enabled. Email
delivery and third-party OAuth were not exercised in the isolated environment.
Closed optional features were checked as closed features, not activated for testing.
