# Observed reference behaviors and adaptation

Reference: https://imgtosvg.net, inspected 2026-11-17.

- Navigation is fixed/sticky at top and uses hairline segmented links. No shrinking observed during a 680px scroll.
- First screen is click-driven: Image/Text tabs replace the left panel; preview modes replace right output. The preview is a working image on a grid, not browser chrome.
- Sample buttons replace the active vector; palette presets recolor it. The longer workflow demo cycles over time and also accepts click-to-seek. We use a static, actionable three-step description instead of reproducing a decorative video.
- Mobile: toolbar condenses, editor and preview stack, sample strip wraps. Desktop max content around 1280px with 56px side margins. Our breakpoint is 700px for editor stacking; navigation condenses below 760px.
- Our controls require hover, focus, active, loading, disabled, error and success states. Preserve state across preview tabs. Respect reduced motion. No scroll-triggered state changes in generator.
