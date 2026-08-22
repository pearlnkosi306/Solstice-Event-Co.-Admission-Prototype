# Solstice Events Co. — Asynchronous Check-In Kiosk

A working prototype of Solstice's badge check-in kiosk, rebuilt around the
badge-printer vendor's new **asynchronous, message-queue + webhook** model
instead of the deprecated synchronous "call and wait" API.

Read [`PIVOT_NOTES.md`](./PIVOT_NOTES.md) for how each requirement in the
brief maps onto the code.

---

## 1. What this prototype actually does

- Staff check an attendee in two ways: **scanning a QR code** (camera, or a
  no-camera "Simulate Scan" button) or **typing the attendee ID** by hand.
- Checking in **never calls a printer and waits**. It publishes a print job
  onto an in-app simulated vendor message queue and immediately returns a
  **pending** state.
- A simulated vendor worker "prints" the badge after a realistic randomized
  delay (1.5s–4.5s) and then calls back to this app's own
  **`POST /api/webhook/print-complete`** endpoint — a real HTTP call, not a
  direct function call — exactly like an external vendor would.
- The UI only shows **"Checked In"** once that webhook confirmation arrives.
  Until then it shows a pending state driven by the animated arc indicator.
- **Duplicate-scan protection holds even with out-of-order/duplicate
  webhook delivery.** The vendor simulator randomly redelivers ~25% of
  confirmations (modeling "at least once" message queue delivery) and the
  webhook handler safely ignores anything that isn't the attendee's current,
  still-pending job.
- Three mock attendees are seeded, one of which (`ATT-2003`) starts already
  checked in, so the duplicate-scan test case works immediately.
- After a successful check-in, a receipt appears on screen with a **Job ID**
  and confirmation time, and buttons to simulate sending that receipt by
  **email** or **text message**.

---

## 2. Requirements

- Node.js **18 or later** (built-in `fetch` is used by the vendor simulator).
  Node 20/22 both work fine.
- A modern browser (Chrome, Edge, Firefox, Safari).
- No database, Docker, or paid API keys needed.

Check your Node version:

```bash
node -v
```

---

## 3. Folder structure

```
solstice-checkin/
├── package.json
├── README.md
├── PIVOT_NOTES.md
├── server/
│   ├── index.js            # Express app: all routes
│   ├── store.js             # In-memory attendee data + status machine
│   ├── vendorSimulator.js   # Simulated async printer vendor (queue + webhook)
│   └── sse.js                # Server-Sent Events hub for live UI updates
└── public/
    ├── index.html
    ├── css/style.css
    └── js/app.js
```

---

## 4. Installation

```bash
# from the project root (the folder containing package.json)
npm install
```

This installs: `express`, `cors`, `qrcode` (generates the badge QR images),
and `uuid` (generates print job IDs). No native/binary dependencies, so this
installs cleanly in GitHub Codespaces or any local machine.

---

## 5. Running it

```bash
npm start
```

You should see:

```
Solstice Events Co. check-in kiosk running at http://localhost:3000
```

Open **http://localhost:3000** in your browser.

### Running in GitHub Codespaces

1. Push/open this folder in a Codespace.
2. Run `npm install` then `npm start` in the integrated terminal.
3. Codespaces will pop up a toast to forward port `3000` — click **Open in
   Browser**. If it doesn't appear automatically, open the **Ports** tab,
   find port 3000, and set visibility to **Public** (or **Private** if you're
   signed in) before opening it.
4. Camera-based QR scanning requires the forwarded URL to be HTTPS, which
   Codespaces provides automatically — if the camera still won't start (some
   sandboxed browsers block camera permissions inside an iframe preview),
   use the **Staff Badge Preview** tab's "Simulate Scan" buttons instead;
   they exercise the exact same check-in code path.

---

## 6. Testing the three required scenarios

Open the **Staff Badge Preview** tab first — it shows all three attendees
with real QR codes and their live status, and is the fastest way to test
without a camera.

### Scenario 1 — a normal first-time check-in (Alice, `ATT-2001`)

1. Click **Simulate Scan** on Alice's badge (or enter `ATT-2001` on the
   Manual tab, or scan her QR with a camera).
2. You'll immediately see a **pending** message and the arc fill turn
   marigold — this is the "print job queued" state. The badge status chip
   changes to **Printing…**.
3. Within a few seconds, the **Live Activity** feed shows a confirmation
   event, the arc turns teal, and a **receipt** appears with a Job ID and
   confirmation time. The badge chip changes to **Checked in**.
4. Try the **Email me** / **Text me** buttons on the receipt — each shows a
   clearly-labeled simulated delivery message.

### Scenario 2 — a second attendee (Bram, `ATT-2002`)

Repeat the same steps with `ATT-2002`. You can trigger both Alice's and
Bram's check-ins back-to-back and watch the Live Activity feed interleave
their pending/confirmed events — a visible demonstration that the app isn't
blocking on one print job before accepting the next scan.

### Scenario 3 — the required duplicate-scan case (Priya, `ATT-2003`)

`ATT-2003` is **seeded as already checked in** specifically so this test
needs no setup:

1. Click **Simulate Scan** on Priya's badge, or enter `ATT-2003`.
2. The app immediately returns a rejection (no new print job is queued) with
   the message *"Priya Devendran is already checked in. No badge will be
   printed again."* The Live Activity feed logs this as a **blocked
   duplicate**.
3. You can also create a duplicate live: check Alice in, then immediately
   click Simulate Scan on her badge again *while it still says
   "Printing…"*. You'll get a different (but still blocked) message —
   *"badge is already printing"* — proving the guard also covers rapid
   double-scans during the pending window, not just already-completed ones.

### Bonus: watching out-of-order/duplicate webhook delivery get ignored

Open the terminal running `npm start`. About one time in four, after a job
completes you'll see a second log line like:

```
[vendor-simulator] redelivering (duplicate) completion for job <id> -- this should be ignored
[webhook] ignoring duplicate confirmation for job <id> (attendee ATT-2001 already CHECKED_IN)
```

That's the message queue's "at least once delivery" behavior being handled
correctly — the second confirmation is a no-op instead of double-printing or
corrupting state.

### Resetting between test runs

Refreshing the browser does **not** reset attendee state (the server holds
it). To reset all three attendees back to their seed state without
restarting the server, run:

```bash
curl -X POST http://localhost:3000/api/admin/reset
```

or simply stop (`Ctrl+C`) and re-run `npm start`.

---

## 7. API reference (for anyone extending or testing this directly)

| Method | Path | Purpose |
|---|---|---|
| `GET`  | `/api/attendees` | List all attendees and their status |
| `GET`  | `/api/attendees/:id` | Get one attendee |
| `GET`  | `/api/attendees/:id/qrcode` | PNG data URL of that attendee's badge QR |
| `POST` | `/api/checkin` | `{ attendeeId, method }` → queues a print job, or blocks a duplicate |
| `POST` | `/api/webhook/print-complete` | Called by the simulated vendor when a print job finishes |
| `POST` | `/api/receipt/deliver` | `{ attendeeId, method }` → simulated email/SMS delivery |
| `POST` | `/api/admin/reset` | Resets all attendees to their seeded state |
| `GET`  | `/api/events` | Server-Sent Events stream of live status changes |

---

## 8. Known scope limits (intentional)

- **Email/SMS delivery is simulated on-screen only.** Wiring a real
  provider (SendGrid, Twilio, etc.) needs real accounts and API keys that
  don't belong in a local prototype, and the brief doesn't require it — it
  only requires the async check-in/printing flow itself.
- **Data is in-memory**, not a database. Restarting the server resets
  everything to the three seeded attendees (use `npm start` again, or the
  reset endpoint above, between test sessions).
- **The "vendor" is simulated** inside this same app (`server/vendorSimulator.js`)
  rather than a real external printer service, since the brief only
  specifies "a message queue" and "a new technology" without naming a
  specific vendor product to integrate against.

---

## 9. Troubleshooting

**`npm install` fails / times out**
Make sure you have network access and are using Node 18+. Delete
`node_modules` and `package-lock.json` and try again:
```bash
rm -rf node_modules package-lock.json
npm install
```

**Port 3000 already in use**
Run on a different port:
```bash
PORT=4000 npm start
```
Then open `http://localhost:4000`.

**Camera won't start for QR scanning**
This is almost always a browser permissions issue, or that the page isn't
served over `https://` or `localhost` (camera access requires one of those).
Use the **Staff Badge Preview** tab's "Simulate Scan" button instead — it is
functionally identical from the server's point of view.

**The receipt never appears / status stays "pending" forever**
Check the terminal running the server for errors. If the browser lost its
connection to the server (see the "Reconnecting…" indicator top-right), the
underlying check-in still completed server-side — refresh the Staff Badge
Preview tab to see the attendee's real current status.

**I want to see the raw print/webhook events as they happen**
Watch the terminal running `npm start` — every queue publish, webhook
delivery (including simulated duplicate redeliveries), and status change is
logged there in plain text.
