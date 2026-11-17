# svgai object storage

Configured on 2026-11-17.

- Cloudflare R2 bucket: `svgai` (Standard storage).
- Public asset origin: `https://cdn.aisvg-generator.com`, with an active TLS certificate and TLS 1.2 minimum.
- Object prefix: `uploads`.
- Connection settings: Admin → Settings → Storage. The application resolves these settings from the shared D1 database through `getStorage()`.
- Account token: `svgai-storage`, restricted to Object Read & Write on this bucket only. Both credential fields are encrypted in D1 and masked in the administrator interface. No credentials are recorded in this document or committed environment files.

Validation: the administrator's R2 test uploaded a text object and its public URL returned HTTP 200 with the expected content. The application image upload endpoint uploaded a 6,067-byte PNG; downloading it through the CDN returned identical SHA-256 content. Temporary verification objects were removed after checking them.

The R2 upload implementation lets Fetch derive Content-Length from the binary body. An explicit Content-Length failed with Node's fetch when Wrangler installed its proxy dispatcher. The local transport regression test is `node --import tsx --test tests/r2-storage.test.ts`; it needs no cloud credentials and sends only to a local HTTP server.

The transport regression, production build and TypeScript check all pass after the repair.

The existing storage settings were empty when inspected. No existing R2 buckets or unrelated configuration were deleted. Future deployments must retain the project's existing CONFIG_ENCRYPTION_KEY so they can decrypt the saved credentials. This provider uses the S3 API and does not require a Workers R2 binding.
