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

### Finding
The diff showed only documentation and static asset changes (`.md` files, `package-lock.json`, two file renames). None of the core server files (`server/index.js`, `server/store.js`, `server/vendorSimulator.js`, `server/sse.js`) appeared in the diff at all — meaning they were identical between the tagged baseline and the current Solstice code.

### Verification
Running: