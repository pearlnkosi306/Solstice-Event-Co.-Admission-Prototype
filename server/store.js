// In-memory data store for the prototype.
// A real deployment would replace this with a database; for this prototype,
// an in-memory Map is enough to demonstrate the async check-in flow.

const STATUS = {
  NOT_CHECKED_IN: "NOT_CHECKED_IN",
  PRINT_PENDING: "PRINT_PENDING",
  CHECKED_IN: "CHECKED_IN",
};

// Seed data: three mock attendees as required by the brief.
// ATT-2003 is pre-seeded as already CHECKED_IN so the duplicate-scan
// test case is available immediately, with no setup steps required.
const seedAttendees = () => {
  const now = Date.now();
  return new Map([
    [
      "ATT-2001",
      {
        id: "ATT-2001",
        name: "Alice Marlowe",
        role: "Attendee",
        email: "alice.marlowe@example.com",
        phone: "+1 555-0101",
        status: STATUS.NOT_CHECKED_IN,
        currentJobId: null,
        checkInTime: null,
        lastDelivery: null,
        history: [],
      },
    ],
    [
      "ATT-2002",
      {
        id: "ATT-2002",
        name: "Bram Okafor",
        role: "Attendee",
        email: "bram.okafor@example.com",
        phone: "+1 555-0102",
        status: STATUS.NOT_CHECKED_IN,
        currentJobId: null,
        checkInTime: null,
        lastDelivery: null,
        history: [],
      },
    ],
    [
      "ATT-2003",
      {
        id: "ATT-2003",
        name: "Priya Devendran",
        role: "Attendee",
        email: "priya.devendran@example.com",
        phone: "+1 555-0103",
        status: STATUS.CHECKED_IN,
        currentJobId: "seed-job-0000",
        checkInTime: now - 1000 * 60 * 12,
        lastDelivery: null,
        history: [
          {
            jobId: "seed-job-0000",
            event: "CHECKED_IN",
            at: now - 1000 * 60 * 12,
            note: "Pre-seeded so the duplicate-scan test case works immediately.",
          },
        ],
      },
    ],
  ]);
};

let attendees = seedAttendees();

function list() {
  return Array.from(attendees.values());
}

function get(id) {
  return attendees.get(id) || null;
}

function reset() {
  attendees = seedAttendees();
  return list();
}

function recordHistory(attendee, event, jobId, note) {
  attendee.history.push({ jobId, event, at: Date.now(), note: note || null });
  // Keep history bounded for a long-running demo session.
  if (attendee.history.length > 25) attendee.history.shift();
}

module.exports = { STATUS, list, get, reset, recordHistory };
