# Codex Session Prompts

## 1. Ready-to-paste prompt for a new session

Copy the text below into a new conversation and upload the latest project ZIP.

```text
I am continuing development of a Node.js project named Ronyka Panel Splitter. I uploaded the latest project ZIP. Read CHANGES.md first, then inspect the actual source files before making changes. Treat CHANGES.md as the intended behavior, but treat the source code as the current implementation and call out any mismatch.

Project summary:
- Current application version: 1.25.0. Keep package.json, package-lock.json, the GUI version label, and CHANGES.md synchronized only when the release is committed.
- Node.js ESM project using Sharp, Express, Multer, Archiver, and Winston.
- CLI: src/index.js.
- Browser GUI server: src/gui-server.js.
- GUI front end: public/index.html, public/app.js, public/style.css.
- The browser title is "Ronyka Panel Splitter"; the visible heading beside public/ronyka-logo.jpg is "Panel Splitter". Preserve the supplied logo asset unless the user requests a replacement.
- The GUI header shows the package version in small text beneath the visible heading; keep it synchronized with package.json when the version changes.
- The GUI uses a Cricut-inspired green, charcoal, white, mint, and neutral color system without including Cricut logos or proprietary assets.
- The visible heading uses a bold rounded system-font stack in Cricut dark green; do not add or redistribute proprietary Cricut font files.
- Settings labels, values, controls, notes, and action text use the same rounded system-font family as the heading at font weight 500.
- It splits a large image into physical poster panels and exports PNGs plus assembly guides.
- Default --fit actual must not resize source pixels.
- --target-width-mm or --target-height-mm intentionally scales the full poster.
- Preserve source PNG alpha transparency through resizing, cropping, margins, partial panels, and previews.
- Grid lines must appear only in original-with-grid.png, never in individual poster panel PNGs.
- The default grid-line color is rgb(1, 168, 107), represented as #01a86b in the GUI, CLI, and server fallback.
- Letter landscape max: 9.26 in wide × 6.55 in high.
- Letter portrait max: 6.55 in wide × 9.26 in high.
- Legal landscape max: 11.84 in wide × 6.76 in high.
- Legal portrait max: 6.76 in wide × 11.84 in high.
- Custom paper mode keeps the current dimensions, permits panel width and height up to 100 in, disables GUI orientation selection, and requires both --panel-width-in and --panel-height-in in the CLI.
- GUI sliders and server/CLI validation must enforce the same paper-profile limits.
- GUI supports drag-and-drop, live grid preview, panel dimension sliders, poster-height scaling, and ZIP export.
- While the preview canvas is hovered, Left/Right adjust panel width and Up/Down adjust panel height; the grid line must move in the pressed arrow's visual direction and remain within the active limits.
- The GUI Auto minimize panels control is a toggle: enabling it generates the artwork-aware layout, while disabling it restores the uniform grid. It detects visible artwork against transparency or a plain background, omits empty canvas regions, and uses a deterministic non-overlapping partition that independently chooses portrait or landscape for each sheet. No source-image segment may occur in more than one generated panel. Preserve the exact generated rectangle list through preview, GUI-server handoff, CLI export, grid preview, and assembly-guide output.
- While Auto minimize panels remains enabled, changes to panel dimensions, DPI, poster height, or paper size must recalculate the automatic layout instead of disabling the toggle.
- Disable the global GUI orientation control while Auto minimize panels is enabled because automatic panels choose orientation independently; restore it when automatic mode is disabled unless Custom paper still requires it to remain disabled.
- `Shift+A` toggles Auto minimize panels unless focus is in an editable control or the export modal is open.
- The **Print Panel Numbers** GUI control is a switch-style toggle directly below Auto minimize panels. Enabled numbers are zero-based plain text with a white outline, use the selected visible-size preset and grid-line color, and derive the corresponding export-pixel font size from the output-to-displayed-preview scale so preview and export have the same relative artwork size in uniform and automatic layouts.
- Panel-number size presets are Small (14 visible px), Medium (20 visible px, default), and Large (28 visible px). Persist the selected preset and derive its proportional output-pixel size for export.
- Each enabled preview number is independently draggable and clamped inside its panel. Export must receive the complete source-coordinate anchor list, validate it against the final panel crops, place each number at the matching local coordinate, and record the anchors in the assembly guide.
- When GUI panel numbering is enabled, `original-with-grid.png` must include every number at the same final source-canvas anchor as the browser preview and corresponding exported panel.
- Preview numbers use 50% opacity and regular weight normally, then full opacity and bold weight while hovered or actively dragged so the affected number is visually explicit. Exported plain numbers remain at 50% opacity.
- The GUI unit selector switches only panel width/height, panel limits, and assembled-poster preview dimensions between centimeters and inches. Poster height and grid width inputs always remain in millimeters; the server contract remains panel inches plus poster/grid millimeters.
- Imperial (`in`) is selected by default in the GUI unit selector.
- Paper size, unit-system selection, the Print Panel Numbers toggle, and its size preset persist in browser local storage under ronyka-panel-splitter.display-settings.v1. Other GUI settings, number positions, and uploaded image data remain transient.
- The assembled-poster preview summary places poster dimensions on a separate line ending with `(W × H)`.
- GUI ZIP export uses a modal progress bar, a unique export ID, and polling through /api/export-progress/:id; preserve actual per-panel progress plus preparing, zipping, completion, cancellation, and error phases.
- Pressing Escape during an active export must abort the browser request, call DELETE /api/export/:id, terminate the matching CLI process, and remove partial temporary output. A second Escape press dismisses the modal without allowing the asynchronous cancellation result to reopen it.
- Keep all export status feedback inside the modal; do not restore a status-text area beneath the Export panels ZIP button.
- Keep the selected-image filename and original pixel dimensions in the dedicated label beneath the image picker.
- The modal hint reads "Press Esc to cancel generation." while active and "Press Esc to close" after completion, cancellation, or failure.
- The CLI and GUI server share src/logger.js. Winston defaults to debug unless LOG_LEVEL overrides it; keep CLI diagnostics on stderr so stdout progress parsing remains stable.
- scripts/install-update.mjs supports Windows/macOS installs and updates from GitHub archives without Git; preserve its safe archive extraction and npm ci behavior.
- Panel numbering starts at 0. --no-number and --no-label disable numbering.
- Large target posters, including a 4000 mm target height, can exceed Sharp's default input pixel limit. Preserve the openImage() handling for source and intermediate poster buffers and the disabled pixel limit on the full-size grid composite.
- GUI temporary paths are rooted at os.tmpdir(), not a hard-coded /tmp path.
- Delete each generated export directory when the ZIP response finishes, the client connection closes, or the request fails. Delete the uploaded source in the request cleanup.
- Preserve crash recovery: on GUI startup and once per hour, delete only app-owned temporary export directories and uploads older than 24 hours.
- Do not claim a feature is implemented until you inspect and verify the code.

Before editing:
1. Read CHANGES.md and README.md.
2. Inspect package.json, src/index.js, src/gui-server.js, public/app.js, public/index.html, and public/style.css.
3. Summarize any mismatch between documentation and implementation.
4. Make the requested change while preserving all invariants in CHANGES.md.
5. Run syntax checks and any feasible functional tests.
6. For GUI export changes, verify success, failure/disconnect cleanup, and avoid deleting active or recent exports.
7. Return an updated ZIP and briefly list changed files and validation results.
```

## 2. Suggested first message after loading the project

```text
Please read CHANGES.md and audit the current source against it. Do not modify anything yet. Tell me which documented features are fully implemented, partially implemented, or missing.
```
