# Codex Session Prompts

## 1. Ready-to-paste prompt for a new session

Copy the text below into a new conversation and upload the latest project ZIP.

```text
I am continuing development of a Node.js project named Image Panel Splitter. I uploaded the latest project ZIP. Read CHANGES.md first, then inspect the actual source files before making changes. Treat CHANGES.md as the intended behavior, but treat the source code as the current implementation and call out any mismatch.

Project summary:
- Node.js ESM project using Sharp, Express, Multer, and Archiver.
- CLI: src/index.js.
- Browser GUI server: src/gui-server.js.
- GUI front end: public/index.html, public/app.js, public/style.css.
- It splits a large image into physical poster panels and exports PNGs plus assembly guides.
- Default --fit actual must not resize source pixels.
- --target-width-mm or --target-height-mm intentionally scales the full poster.
- Preserve source PNG alpha transparency through resizing, cropping, margins, partial panels, and previews.
- Grid lines must appear only in original-with-grid.png, never in individual poster panel PNGs.
- Letter landscape max: 9.26 in wide × 6.55 in high.
- Letter portrait max: 6.55 in wide × 9.26 in high.
- Legal landscape max: 11.84 in wide × 6.76 in high.
- Legal portrait max: 6.76 in wide × 11.84 in high.
- GUI sliders and server/CLI validation must enforce the same orientation-aware limits.
- GUI supports drag-and-drop, live grid preview, panel dimension sliders, poster-height scaling, and ZIP export.
- GUI ZIP export uses a modal progress bar, a unique export ID, and polling through /api/export-progress/:id; preserve actual per-panel progress plus preparing, zipping, completion, cancellation, and error phases.
- Pressing Escape during an active export must abort the browser request, call DELETE /api/export/:id, terminate the matching CLI process, and remove partial temporary output. A second Escape press dismisses the modal without allowing the asynchronous cancellation result to reopen it.
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
