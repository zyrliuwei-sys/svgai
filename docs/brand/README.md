# svgai brand system

Design read: a premium vector creation studio for designers, makers and web builders. The language is precise, open and tactile. Design variance 6, motion 3, density 5.

## Identity

**Brand line:** Ideas, precisely shaped.

The mark is an open S-shaped Bézier path on a cobalt field. Its two lemon nodes represent a starting point and an editable endpoint. The mark remains legible as an app icon. Wordmarks are supplied for light and dark backgrounds; product UI uses the configured application name.

Assets: `public/brand/mark.svg`, `wordmark.svg`, `wordmark-reverse.svg`, `social-card.svg`, `social-card.png`. Logo and favicon are wired to the same mark. Keep a clear space of one node diameter around the symbol. Do not stretch, add shadows, or recolor individual nodes independently.

## Palette

| Role                    | Light                  | Dark                   |
| ----------------------- | ---------------------- | ---------------------- |
| Canvas                  | oklch(0.979 0.005 260) | oklch(0.185 0.027 265) |
| Graphite / foreground   | oklch(0.255 0.041 264) | oklch(0.947 0.012 260) |
| Cobalt / primary        | oklch(0.53 0.22 267)   | oklch(0.72 0.145 267)  |
| Lemon / secondary field | oklch(0.943 0.086 110) | oklch(0.38 0.056 110)  |
| Secondary text          | oklch(0.49 0.026 264)  | oklch(0.738 0.026 264) |

Colors are semantic CSS tokens in `src/styles/globals.css`. Cobalt identifies primary actions, selected controls and interactive paths. Lemon is a supporting field, not a replacement primary button color. Artwork palettes remain independent of interface colors.

## Typography

Bricolage Grotesque Variable is the display face and wordmark companion. Geist Variable is the reading and interface face. System monospace is reserved for dimensions, SVG code and file metadata. Headlines use medium weight, tight tracking and balanced wrapping; body text uses open line spacing. Do not bring back decorative italic serif headlines.

## Shape and layout

Use 5-9px corners for controls and workspaces, hairline boundaries, and small restrained shadows. The layout has a 1240px content maximum and 40px desktop / 20px mobile side gutters. The signature visual is the live vector artboard: its grid and control points communicate real editability. Avoid gradient headlines, glow, invented statistics and fake software chrome.

## Voice and motion

Use concrete creative language: describe, inspect, refine, download. Explain capabilities and limits. Examples are labelled examples; unconfigured AI generation is never presented as active. Motion supports input, selection and loading feedback and respects reduced-motion preferences.

## Search and content

Homepage primary phrase: **AI SVG generator**. Interior intent is split between `/text-to-svg`, `/image-to-svg`, `/examples`, and `/how-it-works`. Each has a unique title, description, canonical URL and share metadata. Structured data describes the real application without invented prices, reviews, or ratings. Homepage copy targets approximately 1,300 English words including the workspace and FAQ content.

Editorial guidance: [Google helpful content](https://developers.google.com/search/docs/fundamentals/creating-helpful-content), [descriptive title links](https://developers.google.com/search/docs/appearance/title-link), [SVG paths](https://developer.mozilla.org/en-US/docs/Web/SVG/Reference/Element/path).
