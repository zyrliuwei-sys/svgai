# SVG Generator specification

Reference screenshot: docs/design-references/imgtosvg.net/desktop-top.png.
Interaction: click-driven real editor, not decorative screenshot.
Desktop: max-width 1240px; left input width 42%, right artboard 58%; thin border, 4px radius. Input white, artboard grid on warm paper. Height approximately 440px. Navigation 64px; heading Instrument Serif 64px / 1.05, body Geist 15px / 1.65. On 900px and below stack with artboard at least 330px. At 390px use 20px page gutters and preserve all functional controls.
Input tabs: Text to SVG default; Image to SVG alternative. Textarea labelled, prompt samples, style and aspect controls. Upload PNG/JPEG/WebP only, 10MB max, remove background option.
Output: sample artwork explicitly labelled; modes Preview, Outline, Code. Zoom, palette colors and Download SVG. Samples are original native SVG artwork, never raster wrappers. Actual dimensions, path count and byte size derived from SVG. Download a real image/svg+xml file and copy code via clipboard with feedback. Error text inline. No copy in reusable components except supplied props.
