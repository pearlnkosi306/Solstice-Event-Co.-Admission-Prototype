# Requirement Traceability — Pivot Event / Meridian Pivot Simulation

This maps every line of the client-role handout to where it's implemented.

## Original requirements (pre-pivot)

| Requirement | Status |
|---|---|
| Staff scan an attendee's QR code | Implemented — camera scan via `html5-qrcode`, plus click-to-scan on badge previews |
| App calls the badge-printer vendor | Replaced per the pivot — see below |
| App waits for a success response before doing anything else | **Deliberately removed** — this is exactly what the pivot deprecates |
| "Checked In" shown only once printing has succeeded | Preserved in spirit: the UI now shows **pending** immediately, then flips to "Checked In" only once the webhook confirms success — `public/js/app.js`, `checked-in` SSE handler |
| Handle at least 3 test attendees | `server/store.js` seeds `ATT-2001`, `ATT-2002`, `ATT-2003` |
| One duplicate-scan case; no second badge printed | `ATT-2003` is pre-seeded as already checked in; `POST /api/checkin` in `server/index.js` rejects any check-in attempt for an attendee already `CHECKED_IN` or already `PRINT_PENDING`, without ever queuing a second print job |

## The pivot itself

> "...the kiosk service now has to be rebuilt around an asynchronous model:
> instead of calling the printer and waiting for an immediate response,
> teams publish a print request onto the vendor's message queue and expose
> a webhook endpoint of their own to receive a callback once the print job
> actually completes."

Implemented as:

- **Publish to a message queue** → `vendor.publishPrintJob()` in
  `server/vendorSimulator.js`, called from `POST /api/checkin`. This
  returns immediately (HTTP 202) — the check-in request never blocks on a
  print outcome.
- **Vendor's own webhook callback** → the vendor simulator later performs a
  real, separate HTTP `POST` to this app's own
  `POST /api/webhook/print-complete`, rather than resolving a promise
  in-process. This mirrors an actual external vendor's callback, not just
  the appearance of asynchrony.

> "The UI can no longer show 'Checked In' the instant the button is pressed
> - it has to reflect a pending state until the webhook confirmation
> arrives."

Implemented as the `PRINT_PENDING` status (`server/store.js`), the marigold
"pending" arc state and status message (`public/js/app.js`,
`public/css/style.css`), and the badge-preview status chip that reads
"Printing…" until the webhook lands.

> "The duplicate-scan protection still has to hold under this new model,
> even though confirmations may now arrive out of order."

This is the part that actually required new design work, not just moving
the old check to a new place:

1. **Front door guard** (`POST /api/checkin`): an attendee who is already
   `CHECKED_IN` or already `PRINT_PENDING` is rejected before any new job
   is ever queued — covers duplicate scans both before and during printing.
2. **Back door guard** (`POST /api/webhook/print-complete`): every webhook
   call carries the `jobId` it's confirming. The handler only accepts a
   confirmation if `jobId` matches the attendee's **current** job — a stale
   or out-of-order confirmation for a job that's no longer active is
   ignored (`reason: "stale-job"`).
3. **Idempotency guard**: even a confirmation for the correct, current job
   is ignored if the attendee isn't still `PRINT_PENDING` (i.e. it was
   already processed) — `reason: "already-processed"`. This is what makes
   redelivered/duplicate webhook calls safe.
4. **Proof, not just an assertion**: `server/vendorSimulator.js`
   deliberately redelivers ~25% of completion callbacks a second time, and
   randomizes each job's delay independently so jobs can complete out of
   order relative to when they were queued — so the guards above are
   exercised on every real test run, not just in theory.

## What the brief did *not* ask for (and this prototype does not over-build)

The brief says only "a new technology" and "the vendor's message queue" —
it does not name Redis, RabbitMQ, Kafka, WebSockets, a specific database,
Docker, or an automated test suite. This prototype intentionally stays
inside that scope: an in-process simulated queue + a real webhook HTTP
call is enough to demonstrate the required architecture change without
introducing infrastructure the brief never asked for. Server-Sent Events
are used only for the live UI feed (a UX nicety, not a stand-in for the
webhook itself, which is a plain HTTP POST as specified).

## What was added beyond the brief, at the requester's explicit direction

The brief is silent on how staff pick an attendee and on receipts; the
follow-up instructions asked for these explicitly, so they were added:

- Two check-in paths: QR scan and manual attendee ID entry.
- An on-screen receipt after a successful check-in, with a **simulated**
  choice to receive it by email or text message (see README §8 for why
  real delivery is out of scope for a local prototype).
- A five-color, non-primary "Solstice" visual theme (see `public/css/style.css`
  token comments at the top of the file for the named palette).
