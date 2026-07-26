# Codex Session Prompts

## 1. Ready-to-paste prompt for a new session

Copy the text below into a new conversation and upload the latest project ZIP.

```text
I am continuing development of a Node.js project named Ronyka Panel Splitter. I uploaded the latest project ZIP. Read CHANGES.md first, then inspect the actual source files before making changes. Treat CHANGES.md as the intended behavior, but treat the source code as the current implementation and call out any mismatch.

Project summary:
- Current application version: 1.31.0. Keep package.json, package-lock.json, the GUI version label, and CHANGES.md synchronized only when the release is committed.
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
- The GUI **Auto paneling** control is a toggle: enabling it generates the artwork-aware layout, while disabling it restores the uniform grid. It detects visible artwork against transparency or a plain background, omits empty canvas regions, and uses a deterministic non-overlapping partition that independently chooses portrait or landscape for each sheet. No source-image segment may occur in more than one generated panel. Preserve the exact generated rectangle list through preview, GUI-server handoff, CLI export, grid preview, and assembly-guide output.
- Keep the Auto paneling enable toggle, Maximum panel side, and Minimum panel side controls visually nested inside a dedicated **Auto paneling** subsection within **Panel Layout**.
- When Auto paneling is off, keep its subsection heading, enable toggle, artwork-detection description, and `Shift+A` shortcut visible. Disable and collapse only the sizing options with a short slide/fade transition; expand and enable them when an automatic layout becomes active. Keep `aria-expanded`, `aria-hidden`, and input disabled states synchronized.
- On website startup, drive Auto/Manual disclosure state from the restored Auto paneling preference even before an image loads. If the restored preference is on but layout generation fails after loading, keep Auto controls visible and allow their changes to retry generation while Manual controls remain hidden.
- Keep Panel orientation, Panel width, and Panel height visually nested inside a dedicated **Manual paneling** subsection within **Panel Layout**.
- While **Auto paneling** remains enabled, changes to Maximum panel side, Minimum panel side, DPI, poster height, or paper size must recalculate the active automatic layout instead of disabling the toggle. Manual orientation/width/height belong to the uniform grid and are disabled while Auto paneling is active. Do not use the persisted preference as a substitute for an active layout during control-change handling.
- Auto paneling has one **Minimum panel side** slider at the same visual level as **Maximum panel side**. It applies equally to width and height, defaults to its 0.25-inch lower limit on every new image, and follows the selected metric/imperial unit system while retaining a canonical inch value. Reset both Auto side controls to their selected-paper defaults whenever a new image is loaded. Its upper limit is the selected paper profile's longest side, independently of the current Maximum panel side value. If the minimum is raised above the maximum, raise the maximum to match; if the maximum is lowered below the minimum, lower the minimum to match. Use 0.01-inch physical steps so exact paper limits remain reachable. When migrating legacy stored width/height minimums, use the larger value. It must not generate a crop smaller than the configured side at the selected DPI. Expand small artwork bounds only within disjoint partition containers so minimum-size enforcement never introduces overlap; reject a layout when the poster canvas or a valid non-overlapping partition cannot satisfy the minimum.
- Auto paneling uses a single **Maximum panel side** setting instead of Panel width/height. Its minimum is 0.75 inches; cap its maximum at the selected paper profile's longest printable side. Derive the automatic short side from the smaller of that setting and the profile's shorter printable side. Persist it as canonical inches while displaying the selected unit system.
- Manual Panel width/height and Auto panel sizing are independent, including for Custom paper. Do not clamp or derive Auto maximum/minimum settings from the manual sliders. When exporting an automatic layout, pass its independently derived long/short panel dimensions to the GUI server and CLI rather than the manual dimensions.
- Whenever a new image is loaded, reset Manual Panel width and Panel height to the selected paper profile and orientation's maximum values, including the configured Custom-paper maximums.
- Whenever Paper size changes, update the Maximum panel side slider maximum and reset its current value to the new paper profile's longest printable dimension.
- Maximum panel side uses 0.01-inch slider precision so paper limits that are not quarter-inch increments, including 9.26 and 11.84 inches, remain selectable exactly.
- For Custom paper, keep Auto paneling Maximum panel side's slider maximum at 100 inches but reset its selected/default value to 9.26 inches when Custom is chosen. Keep it independent of the Manual panel width/height limits.
- Auto paneling constraint failures must be caught in the GUI, shown inline beneath the minimum-size sliders, and leave the previous valid grid unchanged. Do not expose them as uncaught browser-console errors.
- Disable and collapse the entire **Manual paneling** subsection while Auto paneling is active: both orientation buttons and the width/height sliders. Use the same short slide/fade behavior as the Auto options disclosure, synchronize `aria-hidden`/`aria-disabled`, and restore the subsection when Auto paneling is turned off, except that Custom paper continues to keep orientation disabled.
- `Shift+A` toggles **Auto paneling** unless focus is in an editable control or the export modal is open.
- `Shift+F` toggles **Floating preview**, `Shift+N` toggles **Print Panel Numbers**, `Shift+O` starts or finishes assembly-order editing, and `Ctrl+Enter` on Windows/Linux or `Cmd+Enter` on macOS starts ZIP export. Ignore Shift-based action shortcuts while focus is in an editable control. Keep the modified-Enter export shortcut active from settings controls, including sliders and number fields. Ignore every action shortcut while the export modal is open, and never invoke a disabled action.
- The **Print Panel Numbers** GUI control is a switch-style toggle directly below **Auto paneling**. Enabled numbers are zero-based plain text with a white outline, use the selected visible-size preset and grid-line color, and derive the corresponding export-pixel font size from the output-to-displayed-preview scale so preview and export have the same relative artwork size in uniform and automatic layouts.
- Panel-number size presets are X-Small (10 visible px), Small (14 visible px), Medium (20 visible px, default), and Large (28 visible px). Persist the selected preset and derive its proportional output-pixel size for export.
- Each enabled preview number is independently draggable and clamped inside its panel. Export must receive the complete source-coordinate anchor list, validate it against the final panel crops, place each number at the matching local coordinate, and record the anchors in the assembly guide.
- When GUI panel numbering is enabled, `original-with-grid.png` must include every number at the same final source-canvas anchor as the browser preview and corresponding exported panel.
- For GUI centered/manual numbers, composite grid lines and all numbers into `original-with-grid.png` in one initial direct-to-disk Sharp pipeline. Do not reopen and recomposite the full-resolution grid after the last panel; 4000 mm posters can otherwise appear stuck at the final generation count.
- Number panels in natural spatial reading order: cluster automatic panels whose top edges differ by no more than 25% of the median full printable page height—not the variable trimmed crop height—into a visual row, sort that row left-to-right, then process rows top-to-bottom. Apply the identical ordering in browser and CLI before creating or consuming anchor arrays so every output stays synchronized.
- Manual assembly ordering starts from automatic spatial order. In Edit Assembly Order mode, each unique panel click assigns the next number; finishing early appends unclicked panels in their previous relative order, and Reset Order restores automatic order. Export the complete permutation, validate it contains every panel exactly once, preserve each layout entry's original physical canvas index through CLI spatial normalization and custom reordering, and resolve number anchors by that immutable physical index so all output artifacts remain synchronized.
- While editing assembly order, panels already selected use a preview-only translucent green fill and dark-green frame in addition to their emphasized number. Do not include this selection feedback in exported artwork.
- Preserve granular GUI export phases for decoding, scaling, layout calculation, full-grid preview rendering, per-panel generation, ZIP creation, and download. Emit the panel count before full-grid rendering so large 4000 mm exports do not sit behind a generic preparation status.
- Preview numbers use 50% opacity and regular weight normally, then full opacity and bold weight while hovered or actively dragged so the affected number is visually explicit. Exported plain numbers remain at 50% opacity.
- The GUI unit selector switches only panel width/height, panel limits, and assembled-poster preview dimensions between centimeters and inches. Poster height and grid width inputs always remain in millimeters; the server contract remains panel inches plus poster/grid millimeters.
- Imperial (`in`) is selected by default in the GUI unit selector.
- Paper size, unit-system selection, Poster height in millimeters, the Auto paneling toggle with its maximum and minimum sides, Floating preview, the Print Panel Numbers toggle, and its size preset persist in browser local storage under ronyka-panel-splitter.display-settings.v1. Restore the Auto paneling preference immediately, then generate its artwork-aware layout after an image loads. Other GUI settings, number positions, and uploaded image data remain transient.
- The assembled-poster preview summary places poster dimensions on a separate line ending with `(W × H)`.
- Keep the live uniform-grid/Auto-layout panel count and poster-dimension summary inside the **Panel Layout** settings group.
- Keep the **Panel Labels** settings group immediately below **Poster Settings** in the GUI settings column.
- Keep loaded artwork horizontally and vertically centered when the preview fits without scrolling. When the preview area exceeds its available viewport height or has internal overflow, retain horizontal centering but top-align the artwork.
- Before an image is loaded, keep the original empty-canvas preview graphic centered within a viewport-height preview panel; do not replace it with instructional text or a second card.
- Provide a **Floating preview** toggle in a dedicated Preview settings group. Default it on, persist it in browser local storage, and use sticky positioning to keep the preview panel visible while the settings column scrolls. Turning it off must restore the preview to normal document flow; the empty preview may remain viewport-centered.
- GUI ZIP export uses a modal progress bar, a unique export ID, and polling through /api/export-progress/:id; preserve actual per-panel progress plus preparing, zipping, completion, cancellation, and error phases.
- Pressing Escape during an active export must abort the browser request, call DELETE /api/export/:id, terminate the matching CLI process, and remove partial temporary output. A second Escape press dismisses the modal without allowing the asynchronous cancellation result to reopen it.
- Keep all export status feedback inside the modal; do not restore a status-text area beneath the Export panels ZIP button.
- Keep the selected-image filename and original pixel dimensions in the dedicated label beneath the image picker.
- The modal hint reads "Press Esc to cancel generation." while active and "Press Esc to close" after completion, cancellation, or failure.
- The CLI and GUI server share src/logger.js. Winston defaults to debug unless LOG_LEVEL overrides it; keep CLI diagnostics on stderr so stdout progress parsing remains stable.
- scripts/install-update.mjs supports Windows/macOS installs and updates from GitHub archives without Git; preserve its safe archive extraction and npm ci behavior.
- `scripts/windows/ronyka-launcher.bat` is the single Windows GUI launcher. It resolves the project root relative to itself, compares the installed version with GitHub, runs `npm run update` only for a newer published version, starts `npm run gui` in a separate terminal, polls the local server until it responds, and then opens the default browser. Do not reintroduce a second companion launcher.
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
