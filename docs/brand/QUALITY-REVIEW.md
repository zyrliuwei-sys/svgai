# svgai craft review

## Quality target and limits

The target is the level of execution associated with leading digital design awards. Passing an internal checklist is not an award prediction. The review separates observable checks from subjective creative judgment. This local craft review does not certify live paid AI generation, checkout or public-network performance.

References: [Webby judging criteria](https://www.webbyawards.com/judging-criteria/), [Awwwards mobile excellence checklist](https://www.awwwards.com/mobile-excellence-guidelines.pdf), [FWA independent judges](https://thefwa.com/judges).

## Baseline findings

- The working generator is clear, but four equal gallery cards and uniformly weighted sections give the page a repetitive rhythm.
- The brand speaks about editable geometry while most explanatory visuals are static. An actual small vector interaction would make that idea tangible.
- Color swatches only expose the first seven colors and their hit areas are small. Several preview controls use tiny labels.
- Output preview has no expanded view. Image input can be chosen or dropped but not pasted.
- Existing SVG tracing, export, SEO, light/dark mode and responsive behavior already work; preserve them.
- Largest client entry: 202,336 gzip bytes in the baseline build. Rich-text editor is a separate lazy chunk. Avoid adding animation/rendering dependencies.

## Review passes

1. Art direction and identity: distinctive native vector interaction, editorial gallery rhythm, deliberate type scale, useful motion and consistent inner-page chrome.
2. Product interaction: keyboard-operable controls, larger targets, complete palette, preview expansion, paste and truthful empty/error/loading states.
3. Verification: functional browser exercises, small/medium/large layouts, dark mode, reduced motion, readable controls, production build, types, targeted vector tests and measured bundle delta.

## Acceptance evidence

Results are recorded after each observed test. Do not replace findings with invented scores, reviews, traffic claims, or award badges. A remaining material failure must be fixed or reported explicitly.

### Pass 1 — art direction

- Changed the four equal artwork cards to a 7/5 and 5/7 editorial grid, with open captions and a lemon focal tile. Mobile retains two readable columns.
- Gallery hover and keyboard focus reveal the actual SVG outlines. No animation library or raster mockup is involved.
- Added a real cubic Bézier study derived from the brand's curve motif. The visitor can drag either handle, use arrow keys (Shift for larger steps, Home to reset a handle), reset the whole curve and download the current geometry.
- Reviewed desktop homepage, examples and guide screenshots, plus mobile light/dark screens. A second visual check found the dark orbital tile too muddy; its background now retains a bright lemon accent and unfiltered outlines.

### Pass 2 — product detail

- Added an expanded artwork dialog with a download action. At 390 × 844 its bounds are x=12, y=12, width=366, height=820. Keyboard focus enters the dialog, Escape closes it, and focus returns to its trigger.
- Exposed all nine colors in the initial sample instead of seven; each swatch has a 24 × 24px target. The mobile toolbar wraps into palette, metadata/copy and a full-width download action.
- Image paste works inside the generator and from page-body focus. A browser-dispatched clipboard image changed the input mode and converted to 41 paths / 5.9KB. The downloaded file contains real path geometry. This verifies the application's clipboard handler; an OS clipboard image was not used.
- Tested both input and output tabs with arrow keys, the skip link's focus transfer, mobile navigation Escape/focus return, and curve keyboard/pointer/reset/export actions.
- Mobile prompt text is 16px to avoid small editable text and iOS input zoom. Sign-in and sign-up now have one semantic H1 each.

### Pass 3 — regression and cost

- Homepage at 320, 375, 390, 414, 768, 1024 and 1440px: no horizontal overflow. At 320px, all four product inner pages, pricing, both authentication pages and the privacy policy also have no overflow and one H1.
- Product inner pages have their own title and canonical URL. Authentication pages remain noindex. Homepage copy remains approximately 1,300 English words.
- Measured light/dark token contrast ratios: body 14.90/16.05, muted text 5.86/8.01, button label 5.47/7.50, accent text 5.28/7.41. These are sampled token pairs, not a claim of a complete accessibility certification.
- Reduced-motion emulation reports no hero/generator animation and a 0s gallery transition. No scroll hijacking or continuous decorative animation was added.
- Production build and TypeScript check pass. All 22 SVG, English-only and product-copy tests pass.
- Largest client entry: 204,597 gzip bytes, compared with 202,336 at baseline (+2,261 bytes, approximately 1.1%). Other ongoing changes in the shared workspace are included in this observed build delta. No new motion or rendering dependency was added in this review.

Screenshots and exported SVG evidence are in `docs/design-references/quality-*`. Production network measurements and subjective award judging require the published product and its final AI output; no Lighthouse score or award rating is claimed here.
