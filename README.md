# Solstice Events Co. — Check-in Kiosk — Day 3 (Original Spec)

Assignment 2, original pre-pivot build: synchronous badge-printer check-in, with duplicate-scan protection.

## Flow
1. Staff scans an attendee (button click, simulating a QR scan)
2. Kiosk calls the badge-printer vendor **synchronously** — it waits
3. Only once the printer confirms success does the UI show **CHECKED_IN**
4. Scanning an already-checked-in attendee shows **DUPLICATE** and does not print again

## Files
- `printer_vendor.py` — mock badge-printer vendor. Scaffolding, not the graded part — stands in for the real vendor system this simulation doesn't give access to.
- `kiosk.py` — **the actual deliverable.** Check-in logic, duplicate protection, the synchronous call to the printer.
- `templates/index.html` — a simple browser UI so you can demonstrate this visually.
- `test_checkin.py` — runs the 3-attendee-plus-duplicate scenario from the terminal, no browser needed.

## Setup
```bash
pip install -r requirements.txt
```

## Running it (two terminals)

**Terminal 1 — the printer vendor:**
```bash
python3 printer_vendor.py
```

**Terminal 2 — the kiosk:**
```bash
python3 kiosk.py
```

Then either:
- Open `http://localhost:5004` in a browser and click "Simulate scan" on each attendee, or
- In a third terminal, run `python3 test_checkin.py` for a scripted run of all 3 attendees plus a duplicate

## What to notice
Watch how long the browser button "hangs" after you click it — about 1.5 seconds, while the kiosk waits on the printer. That wait is the whole point of this version: it's exactly what Day 4's pivot removes. Worth mentioning directly in your Scope Delta Analysis.

## Next step
This is the "before" half of your Assignment 2 delta. Once you've run this and it feels solid, we build the Day 4 pivot on top of it — message queue, webhook, pending state — same repo, new files alongside these, nothing deleted, old behavior clearly marked as replaced rather than silently removed.
