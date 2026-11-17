# svgai first version

Reading this as: a working vector creation studio for designers, makers and web builders, with a precise, editorial workshop language.

User scope: draw visual inspiration from https://imgtosvg.net/ rather than reproduce its identity. Product svgai, canonical domain https://aisvg-generator.com. Local first version; do not deploy. Existing remote D1 and administrator must remain intact. English only. AI credentials will be configured later.

## Research

- Recraft describes prompt-to-vector as real paths, fills and strokes, exportable as SVG: https://www.recraft.ai/ai-vector-generator
- Vectorizer.AI distinguishes bitmap input from reconstructed vector shapes: https://vectorizer.ai/about
- Reference observed in a real browser: warm background rgb(248,247,243), ink rgb(20,20,19), secondary rgb(107,105,99). Geist Sans body, Instrument Serif display, Geist Mono metadata. Header 56px; heading 54px / 56.7px. Small 2px control corners and hairline borders.
- Reference topology: top horizontal navigation; two-column first-screen generator and preview; samples; workflow; layered-path benefits; instructions; FAQs; tools; footer.

## Chosen direction

Product-first light with an editorial title. Paper oklch(.976 .006 86), ink oklch(.23 .01 70), muted oklch(.49 .012 70), vermilion oklch(.59 .18 35), cobalt artwork oklch(.51 .19 267), white surfaces oklch(.995 .002 86). Dark equivalents are warm charcoal with pale paper text and brighter orange. Geist Sans for UI, Instrument Serif for display only. Signature: an actual checkerboard vector artboard with visible editable palette and outline/code views. No invented usage claims or testimonials. Design variance 5, motion 3, density 5. Four-pixel corners; restrained transitions.

## Files and ownership

Root owns src/styles/globals.css, src/routes/__root.tsx, src/routes/index.tsx, src/blocks/hero.tsx, src/components/svg-generator.tsx, src/types/svg-generator.ts, messages/en.json, environment branding and logo/favicon.
Marketing builder owns src/blocks/header.tsx, src/blocks/footer.tsx, src/blocks/svg-showcase.tsx, src/blocks/svg-workflow.tsx, src/blocks/faq.tsx, src/styles/svg-marketing.css. Its messages go into docs/research/svg-marketing-messages.json for root merging.
Vector builder owns src/lib/svg-vectorizer.ts, src/lib/svg-samples.ts, tests/svg-vectorizer.test.ts.
API builder owns src/modules/svg-generator/service.ts, src/routes/api/svg/generate.ts, tests/svg-generator.test.ts.

## Functionality

Image input PNG/JPEG/WebP up to 10MB; client-side real tracing, no bitmap in SVG. Text prompts use a server route with explicitly configured AI provider only, never ambient API keys. Missing provider is a clear unavailable state; predefined samples are labelled examples. SVG displays as a data/blob image, not injected HTML. Palette recoloring, viewBox, outline view, code copy, SVG download. Upload errors and busy states. All reusable UI receives copy via props; blocks own translation reads. Use TanStack Query and api-client for HTTP. No DB schema changes.
