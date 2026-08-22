"""
Demonstrates the 3-attendee-plus-duplicate-scan requirement from the
terminal, without needing the browser.
"""
import requests

BASE = "http://localhost:5004"

print("--- Checking in ATT001, ATT002, ATT003 ---")
for att_id in ["ATT001", "ATT002", "ATT003"]:
    r = requests.post(f"{BASE}/scan/{att_id}")
    print(att_id, "->", r.json())

print("\n--- Duplicate scan: ATT001 again ---")
r = requests.post(f"{BASE}/scan/ATT001")
print("ATT001 (duplicate) ->", r.json())

print("\n--- Final status ---")
print(requests.get(f"{BASE}/status").json())
