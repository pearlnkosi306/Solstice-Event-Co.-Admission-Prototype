"""
Day 3 - Inventory Sync Service (original, pre-pivot spec).

Polls the warehouse API every 5 minutes, caches the result, and exposes
a query endpoint the support tool can call for a fast, always-available
answer to "is this in stock?" - without hitting the warehouse directly
on every question.
"""
from flask import Flask, jsonify
import threading
import time
import requests

app = Flask(__name__)

WAREHOUSE_URL = "http://localhost:5001/inventory"
POLL_INTERVAL_SECONDS = 300  # 5 minutes, per spec - lower temporarily for testing
MAX_POLL_ATTEMPTS = 3

stock_cache = {}
cache_lock = threading.Lock()
last_updated = None


def fetch_with_retry(url, max_attempts=MAX_POLL_ATTEMPTS):
    """One poll cycle's worth of attempts, with exponential backoff between them."""
    for attempt in range(1, max_attempts + 1):
        try:
            response = requests.get(url, timeout=5)
            response.raise_for_status()
            return response.json()
        except requests.exceptions.RequestException as e:
            print(f"[poller] attempt {attempt}/{max_attempts} failed: {e}")
            if attempt < max_attempts:
                delay = 2 ** (attempt - 1)  # 1s, 2s, 4s...
                time.sleep(delay)
    return None


def poll_warehouse():
    """Runs forever in the background, refreshing the cache on a fixed interval."""
    global last_updated
    while True:
        data = fetch_with_retry(WAREHOUSE_URL)
        if data is not None:
            with cache_lock:
                stock_cache.clear()
                stock_cache.update(data)
                last_updated = time.time()
            print(f"[poller] cache refreshed: {data}")
        else:
            print("[poller] warehouse unreachable this cycle - serving stale cache")
        time.sleep(POLL_INTERVAL_SECONDS)


@app.route("/stock/<sku>", methods=["GET"])
def get_stock(sku):
    with cache_lock:
        if sku not in stock_cache:
            return jsonify({"error": "unknown SKU"}), 404
        return jsonify({
            "sku": sku,
            "quantity": stock_cache[sku],
            "cache_age_seconds": round(time.time() - last_updated) if last_updated else None,
        })


@app.route("/stock", methods=["GET"])
def get_all_stock():
    with cache_lock:
        return jsonify({
            "stock": dict(stock_cache),
            "cache_age_seconds": round(time.time() - last_updated) if last_updated else None,
        })


if __name__ == "__main__":
    poll_thread = threading.Thread(target=poll_warehouse, daemon=True)
    poll_thread.start()
    app.run(port=5002, debug=True, use_reloader=False)
