# Browser logo verification

Verified on 2026-11-17 using the existing svgai vector mark as the source.

| Asset                   | Purpose                                    | Size                    |
| ----------------------- | ------------------------------------------ | ----------------------- |
| `/logo.svg`             | Site header, footer and dashboard branding | Vector                  |
| `/logo.png`             | Direct browser preview and raster fallback | 512 × 512               |
| `/favicon.svg`          | Scalable browser tab icon                  | Vector                  |
| `/favicon.ico`          | Browser icon fallback                      | 16, 32 and 48px entries |
| `/favicon-96x96.png`    | PNG browser icon                           | 96 × 96                 |
| `/apple-touch-icon.png` | Apple device icon                          | 180 × 180               |

The root document declares the SVG, PNG and ICO favicon variants and uses the PNG Apple icon. Files are self-hosted under `public/`; no external image host or authentication is needed.

All six files returned HTTP 200 with image MIME types and decoded successfully in the development browser. The Cloudflare production build contained byte-identical copies, and all six returned HTTP 200 in Wrangler's production bundle preview. Direct SVG and PNG browser previews rendered successfully. TypeScript and the Cloudflare build passed.

The Cloudflare build also required decoding the filesystem URL with `fileURLToPath` for the database-driver alias, because this checkout contains a Chinese directory name.

Requests to the intended production domain failed during this check. This verifies release packaging and local browser rendering; it does not claim that the website has been published. After publication, verify `https://aisvg-generator.com/logo.svg` and the favicon links in the homepage on the live domain.
