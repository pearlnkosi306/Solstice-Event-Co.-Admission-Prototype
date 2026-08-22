"""
Mock badge-printer vendor - the ORIGINAL synchronous API.
Stands in for the real vendor system this simulation doesn't give access to.

This version responds synchronously and gets replaced by an async,
message-queue-based version in the Day 4 pivot.
"""
from flask import Flask, jsonify, request
import time

app = Flask(__name__)


@app.route("/print", methods=["POST"])
def print_badge():
    attendee_id = request.json.get("attendee_id")
    time.sleep(1.5)  # simulate the time a real printer takes
    return jsonify({"attendee_id": attendee_id, "status": "success"}), 200


if __name__ == "__main__":
    app.run(port=5003, debug=True)
