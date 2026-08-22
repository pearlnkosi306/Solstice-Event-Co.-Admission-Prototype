"""
Test client for the inventory service's query endpoint.
Run this after inventory_service.py has been running a few seconds,
so the first poll has had time to complete.
"""
import requests

response = requests.get("http://localhost:5002/stock")
print(response.status_code, response.json())
