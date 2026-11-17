# Homepage SEO changes — 2026-11-17

The brand placeholder is rendered literally as `{{BRAND}}`. This change is local and has not been committed, pushed, or deployed. Existing URL paths, the production domain, and the homepage H1 remain unchanged.

## 1. Brand replacement

Direct brand edits:

- `.env.example` (public example values)
- `cloudflare/production.json` (public application name only; Worker and D1 resource names unchanged)
- `src/config/index.ts` (fallback application name)
- `messages/en.json` (brand mentions in titles, descriptions and product copy)
- `src/content/pages/privacy-policy.en.mdx`
- `src/content/pages/terms-of-service.en.mdx`
- `public/brand/wordmark.svg`
- `public/brand/wordmark-reverse.svg`
- `public/brand/social-card.svg`
- `public/brand/social-card.png` (regenerated from the updated SVG)

The ignored local development/production env files were aligned as well. Header, mobile navigation, footer copyright, Open Graph site name and structured-data application/site names inherit the configured application name. Literal braces are escaped in the existing Paraglide message format; MDX uses character entities in body content.

Rendered homepage brand remnants: **0** in body text, metadata and JSON-LD. A source grep for an isolated quoted/text-node `svgai` also finds **0**. Existing internal CSS/i18n identifiers, visitor cookies, and Cloudflare resource names retain their technical namespaces to avoid unrelated refactoring or data changes.

## 2. Images

- Added missing dimensions to **34 of 37** homepage images. Final coverage: **37/37**.
- All 16 SVG gallery sources have verified `512 × 512` viewports; both comparison layers receive their source dimensions. The generator uses the current SVG dimensions rather than a fixed guess.
- Both first-screen visual layers use `fetchpriority="high"`. The 34 images outside that visual/header use `loading="lazy"`, including the footer mark.
- Uploaded image previews wait for validated image dimensions. Browser verification with a `120 × 80` PNG confirmed matching attributes and decoded dimensions.
- Existing image CSS sizing, object fit and responsive behavior were preserved.

## 3. Homepage description

> Use our AI SVG generator to turn text and image inputs into editable SVG files, preview vector artwork, refine colors, and export SVG designs.

**142 characters**, one complete English sentence containing `AI SVG generator`, `text`, `image`, and editable SVG export.

## 4. Internal anchors

| Destination (unchanged) | Before                                               | After                                                                                   |
| ----------------------- | ---------------------------------------------------- | --------------------------------------------------------------------------------------- |
| `/text-to-svg`          | Text to SVG; Explore text to SVG; no paragraph link  | Text to SVG in a body paragraph and navigation/footer; existing keyword button retained |
| `/image-to-svg`         | Image to SVG; Convert an image; no paragraph link    | Image to SVG in a body paragraph and navigation/footer; button: Explore image to SVG    |
| `/examples`             | Examples in navigation/footer; no paragraph link     | SVG examples in a body paragraph and navigation/footer                                  |
| `/how-it-works`         | How it works in navigation/footer; no paragraph link | how it works in a body paragraph; How it works in navigation/footer                     |
| `/pricing`              | Pricing in navigation/footer; no paragraph link      | pricing in a body paragraph; Pricing in navigation/footer                               |

All five destinations have at least one paragraph entry and one navigation/footer entry. No routes or trailing-slash conventions were changed.

## 5. Copy and frequency

| Scope                                                          | Before | After |
| -------------------------------------------------------------- | -----: | ----: |
| Editorial main content, excluding repeated accessibility hints |   1844 |  1618 |
| Main HTML text, including accessibility hints                  |   1948 |  1722 |
| Full body, including navigation/footer                         |   2008 |  1784 |

Counts use server-rendered HTML text, omit scripts/styles/inline SVG markup, and count English words with internal apostrophes/hyphens as single tokens. FAQ content remains included. Full HTML counts are retained as a conservative check against the 1,800-word ceiling.

Frequency ranking removes repeated screen-reader-only interaction hints and common grammatical English stopwords, and combines singular/plural forms. Generic content words such as `your`, `create`, `make`, and `ideas` are retained.

| Word     | Count |
| -------- | ----: |
| svg      |    68 |
| vector   |    40 |
| image    |    37 |
| color    |    31 |
| preview  |    24 |
| outline  |    24 |
| editable |    21 |
| icon     |    21 |
| ai       |    20 |
| logo     |    20 |

Six entries directly match the requested topic words: SVG, vector, image, editable, icon, logo. Color, preview, outline and AI also describe the tool. Generic-word totals in the complete main HTML: `your` 2, `create` 1, `make` 2, `ideas` 1.

The exact phrase `ai svg generator` occurs **9** times in main content, case-insensitive, including the unchanged H1: `AI SVG generator. Ideas take shape.`

## Validation

- `pnpm build`: passed.
- `pnpm exec tsc --noEmit`: passed.
- Prettier check across every changed TypeScript/TSX/JSON/MDX file: passed.
- `git diff --check`: passed.
- This repository has no standalone ESLint/lint command. The existing Prettier rules and TypeScript checks were used without adding a linter or changing tooling.
- Browser checked at 390px: no horizontal overflow; literal brand placeholder visible, all homepage images have dimensions.
