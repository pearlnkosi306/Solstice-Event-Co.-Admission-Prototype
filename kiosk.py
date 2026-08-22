"""
Day 3 - Solstice Events Co. check-in kiosk (ORIGINAL, pre-pivot spec).

Synchronous flow: scan -> call the badge printer -> wait -> only show
CHECKED_IN once the printer confirms success. Scanning an attendee who's
already checked in does not trigger a second print.
"""
from flask import Flask, jsonify, request, render_template
import requests

app = Flask(__name__)

PRINTER_URL = "http://localhost:5003/print"

attendees = {
    "ATT001": {"name": "Alice Example", "status": "NOT_CHECKED_IN"},
    "ATT002": {"name": "Bilal Example", "status": "NOT_CHECKED_IN"},
    "ATT003": {"name": "Chidi Example", "status": "NOT_CHECKED_IN"},
}


@app.route("/")
def index():
    return render_template("index.html", attendees=attendees)


@app.route("/scan/<attendee_id>", methods=["POST"])
def scan(attendee_id):
    if attendee_id not in attendees:
        return jsonify({"error": "unknown attendee"}), 404

    attendee = attendees[attendee_id]

    if attendee["status"] == "CHECKED_IN":
        return jsonify({
            "attendee_id": attendee_id,
            "status": "DUPLICATE",
            "message": f"{attendee['name']} is already checked in - no badge printed",
        })

    # Synchronous call to the printer - the kiosk blocks here until it responds
    response = requests.post(PRINTER_URL, json={"attendee_id": attendee_id}, timeout=10)
    response.raise_for_status()
    result = response.json()

    if result.get("status") == "success":
        attendee["status"] = "CHECKED_IN"
        return jsonify({
            "attendee_id": attendee_id,
            "status": "CHECKED_IN",
            "message": f"{attendee['name']} checked in, badge printed",
        })

    return jsonify({"attendee_id": attendee_id, "status": "PRINT_FAILED"}), 502


@app.route("/status")
def status():
    return jsonify(attendees)


if __name__ == "__main__":
    app.run(port=5004, debug=True)
