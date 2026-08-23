# Solstice Pivot Journal

## Entry 1 — Pivot Decision and Repository Transition

### Date
23 August 2026

### Project State Before the Pivot
The North Star baseline is confirmed and preserved in this repository on the `northstar-true-baseline` branch (tag: `northstar-baseline`). It consists of a Python-based inventory synchronisation prototype:

- `warehouse_api.py`
- `inventory_service.py`
- `query_client.py`
- `requirements.txt`
- `README.md`

This confirms the North Star system was built around inventory synchronisation with a simulated warehouse API — polling, stock data handling, and stock queries.

### Pivot
Project requirements changed during the sprint, requiring the system to move from the North Star inventory-sync problem to an event-admission prototype for Solstice Event Co.

### Decision Made
The Solstice repository became the working repository for the pivot and eventual final deliverable. The North Star work was preserved rather than discarded, and — after an initial tagging error (see Entry 3) — correctly linked into this repository's history as a distinct, verifiable baseline branch.

### Technical Consequences
The project moved from:

Warehouse API → scheduled polling → inventory data → stock cache → stock query

to:

Attendee → check-in → duplicate protection → badge print request → simulated printer → pending/confirmed state → webhook update → browser interface

### Development Environment
Developed using GitHub Codespaces. Node.js/Express server, started via `npm run dev`, exposed through the Codespaces forwarded-port system.

---

## Entry 2 — Codespace Setup, Port Blocker, and Resolution

### Date & Time
23 August 2026 — 16:19 SAST

### Objective
Verify the existing Solstice project structure and confirm the development server before making further modifications.

### Development Environment
Working directory: `/workspaces/Solstice-Event-Co.-Admission-Prototype`
Components present: `package.json`, `public/`, `server/index.js`, `server/store.js`, `server/sse.js`, `server/vendorSimulator.js`, `README.md`, `PIVOT_NOTES.md`.

### Blocker
`npm run dev` returned:
Error: listen EADDRINUSE: address already in use :::3000

### Investigation
Ran `lsof -i :3000`, `ps aux | grep "server/index.js"`, `ps -fp <PID>`, `ps -o pid,ppid,cmd -p <PID>`, and `pstree -p <PID>` to trace the process hierarchy rather than immediately killing anything.

### Finding
`lsof -i :3000` confirmed a Node process (PID 32725) already listening on port 3000. The server had continued running independently of whether the browser tab was open or closed.

### Resolution
Rather than terminating the process and starting a duplicate server, the existing process was recognized as already live and functional. No restart was needed — the correct action was to use the already-running server via the Codespaces forwarded port instead of attempting a second `npm run dev`.

### Status
RESOLVED — by recognizing the existing process rather than by killing and restarting.

### Learning
Closing the browser does not stop the Node.js server running inside a Codespace. Checking `lsof -i :3000` before restarting prevents unnecessary port conflicts.



## Entry 3 — Discovery of a Baseline Tagging Error

### Date
23 August 2026

### Context
After tagging commit `b972839` (`Add files via upload`) as `northstar-baseline`, a comparison was run to confirm what had actually changed since that baseline:
git diff --stat northstar-baseline HEAD

### Finding
The diff showed only documentation and static asset changes (`.md` files, `package-lock.json`, two file renames). None of the core server files (`server/index.js`, `server/store.js`, `server/vendorSimulator.js`, `server/sse.js`) appeared in the diff at all — meaning they were identical between the tagged baseline and the current Solstice code.

### Verification
Running:
git show b972839:server/index.js | head -40

confirmed that the commit tagged as `northstar-baseline` already contained the Solstice check-in architecture (`/api/checkin`, `PRINT_PENDING`, async job handling) — not North Star inventory code.

### Conclusion
The `northstar-baseline` tag had been placed on the wrong commit. The repository's initial upload already contained post-pivot Solstice code, so no accurate pre-pivot snapshot existed in this repository's history at that point. The true North Star source needed to be located and imported separately.

### Pivot Relevance
This discovery was made *because* the pivot documentation was being verified against real git history rather than assumed — directly supporting the accuracy of the evidence trail for Assignment 2.

---

## Entry 4 — Correcting the Baseline: Importing the Real North Star Source

### Date
23 August 2026

### Objective
Replace the mistagged baseline with a verifiable, accurate North Star snapshot, without disturbing the existing `main` branch history.

### Steps Taken

1. Created an orphan branch with no shared history:
git checkout --orphan northstar-true-baseline
git rm -rf .

2. First import attempt failed: an uploaded zip file turned out to contain only `node_modules` dependency packages, not actual North Star source code. This was identified by inspecting `ls -la` and finding only dependency folders (e.g. `mime-db`, `qs`, `yargs`, `pngjs`) with no application logic.

3. Corrected by removing the erroneous import:
git rm -rf .
git commit -m "Remove incorrect node_modules import"

4. The real North Star source (already hosted in a separate GitHub repository) was pulled in directly:
git remote add northstar-origin <north-star-repo-url>
git fetch northstar-origin
git merge northstar-origin/main --allow-unrelated-histories

5. Verified the merge brought in genuine North Star files:
warehouse_api.py
inventory_service.py
query_client.py
requirements.txt
README.md

6. Retagged the baseline to the corrected commit:
git tag -d northstar-baseline
git push origin :refs/tags/northstar-baseline
git tag -a northstar-baseline HEAD -m "Corrected: North Star baseline (actual pre-pivot source)"
git push origin northstar-baseline

### Result
`git show northstar-baseline --stat` confirmed the tag now points to the merge commit containing the real North Star files (185 insertions across 6 files), correctly linked into this repository's history via `--allow-unrelated-histories`.

### Learning
A tag or baseline reference should always be verified against actual file contents (`git show <ref>:<path>`), not assumed correct from the commit message alone. An incorrect baseline was caught and corrected before being relied upon for the final deliverable narrative.

---

## Entry 5 — End-to-End Solstice Check-In Test

### Status: NOT YET PERFORMED

This entry is intentionally left incomplete. The planned test (per the existing Solstice code in `server/index.js`) is:

- **Test 1 — Normal check-in:** `ATT-2001` → `POST /api/checkin` → `PRINT_PENDING` → vendor simulator delay → `POST /api/webhook/print-complete` → `CHECKED_IN` → SSE broadcast observed in browser.
- **Test 2 — Duplicate protection:** `ATT-2003` (pre-seeded as `CHECKED_IN`) → expect `409` rejection, no new print job.
- **Test 3 — Double-tap/pending protection:** Check in `ATT-2001`, then attempt a second check-in before the printer completes → expect `202`, no duplicate print job.

No test has actually been run yet, so no results, timestamps, or observed behavior can honestly be recorded here. This entry should be completed once the tests are actually executed, with real observed status codes and timing filled in — not predicted or assumed outcomes.