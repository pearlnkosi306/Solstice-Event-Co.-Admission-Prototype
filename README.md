# Northstar Inventory Sync — Day 3 (Original Spec)

Assignment 2, original pre-pivot build: poll a warehouse API every 5 minutes, cache the result, expose a query endpoint for the support tool.

## Architecture

```
Warehouse API (mock)          Inventory Service              Support Tool
   :5001/inventory                :5002                       (you, testing)
        |                           |                              |
        |<---- poll every 5 min ----|                              |
        |      (retry + backoff     |                              |
        |       if it fails)        |                              |
        |                           v                              |
        |                     Stock Cache                          |
        |                    (in-memory)                           |
        |                           |                              |
        |                           |---- GET /stock/<sku> ------->|
        |                           +---- GET /stock ------------->|
```

## Files
- `warehouse_api.py` — mock external warehouse system. Scaffolding, not the graded part — stands in for the real API this simulation doesn't give you access to.
- `inventory_service.py` — **this is the actual Day 3 deliverable.** Polls the warehouse every 5 minutes, caches stock levels, retries with backoff if a poll fails, and serves the cache through its own endpoint.
- `query_client.py` — a small script to test the query endpoint.
- `requirements.txt` — flask + requests.

## Setup
```bash
pip install -r requirements.txt
```

## Running it (three terminals)

**Terminal 1 — the mock warehouse:**
```bash
python3 warehouse_api.py
```

**Terminal 2 — the inventory service:**
```bash
python3 inventory_service.py
```
Watch this terminal — it prints a line every time it polls, so you can see it working instead of guessing.

**Terminal 3 — query it:**
```bash
python3 query_client.py
```
Or directly: `curl http://localhost:5002/stock/SKU001`

## Testing without waiting 5 real minutes
`POLL_INTERVAL_SECONDS` at the top of `inventory_service.py` is set to 300 (5 minutes), matching the spec. While testing, it's fine to temporarily drop it to something like 10 so you're not sitting around — **set it back to 300 before treating this as done**, since the spec is explicit about the interval.

## Simulating a stock change
Both Flask apps run in debug mode, so they auto-restart on save. Edit a value in the `inventory` dict in `warehouse_api.py` and save — it restarts, and the next poll picks up the new number.

## What's already handled
- **Stale-but-available reads:** if a poll fails, the cache keeps its last good value instead of wiping — the support tool always gets *something*, even if it's a few minutes old.
- **Poll failures:** each cycle retries up to 3 times with exponential backoff before giving up until the next scheduled poll.

## Next step
This is the "before" half of your Assignment 2 delta. Once this is running and you're comfortable with it, we build the Day 4 pivot on top of it — same repo, new files, old ones stay in place.
