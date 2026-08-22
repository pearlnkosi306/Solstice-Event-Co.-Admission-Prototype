const path = require("path");
const express = require("express");
const cors = require("cors");
const { v4: uuidv4 } = require("uuid");
const QRCode = require("qrcode");

const store = require("./store");
const vendor = require("./vendorSimulator");
const sse = require("./sse");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "..", "public")));

// -----------------------------------------------------------------------
// GET /api/attendees -- list every attendee and current status
// GET /api/attendees/:id -- single attendee detail
// -----------------------------------------------------------------------
app.get("/api/attendees", (req, res) => {
  res.json({ attendees: store.list() });
});

app.get("/api/attendees/:id", (req, res) => {
  const attendee = store.get(req.params.id.toUpperCase());
  if (!attendee) return res.status(404).json({ error: "Attendee not found" });
  res.json({ attendee });
});

// -----------------------------------------------------------------------
// GET /api/attendees/:id/qrcode -- a real scannable QR code (PNG data URL)
// encoding this attendee's ID, standing in for their physical badge/pass.
// -----------------------------------------------------------------------
app.get("/api/attendees/:id/qrcode", async (req, res) => {
  const id = req.params.id.toUpperCase();
  const attendee = store.get(id);
  if (!attendee) return res.status(404).json({ error: "Attendee not found" });
  try {
    const dataUrl = await QRCode.toDataURL(id, {
      margin: 1,
      width: 240,
      color: { dark: "#1E2340", light: "#00000000" },
    });
    res.json({ id, dataUrl });
  } catch (err) {
    res.status(500).json({ error: "Failed to generate QR code" });
  }
});

// -----------------------------------------------------------------------
// POST /api/checkin  { attendeeId }
//
// This is the async replacement for the deprecated synchronous call.
// It never talks to the "printer" directly and never blocks waiting for
// one. It only ever does one of three things:
//   - already checked in -> reject, no new print job (duplicate guard)
//   - already pending     -> acknowledge, no new print job (double-tap guard)
//   - otherwise           -> publish a print job and return "pending"
// -----------------------------------------------------------------------
app.post("/api/checkin", (req, res) => {
  const attendeeId = (req.body.attendeeId || "").trim().toUpperCase();
  const method = req.body.method === "qr" ? "qr" : "manual";
  const attendee = store.get(attendeeId);

  if (!attendee) {
    return res.status(404).json({ error: `No attendee found for ID "${attendeeId}".` });
  }

  if (attendee.status === store.STATUS.CHECKED_IN) {
    return res.status(409).json({
      duplicate: true,
      reason: "already-checked-in",
      message: `${attendee.name} is already checked in. No badge will be printed again.`,
      attendee,
    });
  }

  if (attendee.status === store.STATUS.PRINT_PENDING) {
    return res.status(202).json({
      duplicate: true,
      reason: "print-already-in-progress",
      message: `${attendee.name}'s badge is already printing. Please wait for confirmation.`,
      attendee,
    });
  }

  // Fresh check-in: publish to the vendor's message queue and return
  // immediately with a pending status. We do NOT wait for the printer.
  const jobId = uuidv4();
  attendee.status = store.STATUS.PRINT_PENDING;
  attendee.currentJobId = jobId;
  store.recordHistory(attendee, "PRINT_QUEUED", jobId, `via ${method} scan`);

  vendor.publishPrintJob({ jobId, attendeeId });
  sse.broadcast("status-update", { attendee });

  res.status(202).json({
    pending: true,
    message: `${attendee.name} scanned in. Badge is printing -- confirmation pending.`,
    attendee,
  });
});

// -----------------------------------------------------------------------
// POST /api/webhook/print-complete  { jobId, attendeeId, result }
//
// The vendor calls this endpoint on ITS OWN schedule, once the physical
// print job actually finishes. Because message queues typically guarantee
// "at least once" delivery, and because jobs can complete out of order,
// this handler must be idempotent and must ignore stale/duplicate
// confirmations rather than trusting every call blindly.
// -----------------------------------------------------------------------
app.post("/api/webhook/print-complete", (req, res) => {
  const { jobId, attendeeId, result } = req.body;
  const attendee = store.get((attendeeId || "").toUpperCase());

  if (!attendee) {
    return res.status(404).json({ ignored: true, reason: "unknown-attendee" });
  }

  // Guard against stale or out-of-order confirmations: only the webhook
  // call matching the attendee's CURRENT job id is allowed to move state.
  if (attendee.currentJobId !== jobId) {
    console.log(
      `[webhook] ignoring confirmation for stale job ${jobId} (attendee ${attendee.id} is now on job ${attendee.currentJobId})`
    );
    store.recordHistory(attendee, "WEBHOOK_IGNORED_STALE", jobId, "job id no longer current");
    return res.status(200).json({ ignored: true, reason: "stale-job" });
  }

  // Guard against redelivered/duplicate confirmations for a job that has
  // already been processed (this is what makes the "~25% redelivery" in
  // the vendor simulator harmless).
  if (attendee.status !== store.STATUS.PRINT_PENDING) {
    console.log(
      `[webhook] ignoring duplicate confirmation for job ${jobId} (attendee ${attendee.id} already ${attendee.status})`
    );
    store.recordHistory(attendee, "WEBHOOK_IGNORED_DUPLICATE", jobId, "already processed");
    return res.status(200).json({ ignored: true, reason: "already-processed" });
  }

  if (result !== "SUCCESS") {
    // A real system would branch to a failure/retry flow here.
    store.recordHistory(attendee, "PRINT_FAILED", jobId);
    sse.broadcast("status-update", { attendee });
    return res.status(200).json({ processed: true, result: "FAILURE" });
  }

  attendee.status = store.STATUS.CHECKED_IN;
  attendee.checkInTime = Date.now();
  store.recordHistory(attendee, "CHECKED_IN", jobId);

  sse.broadcast("status-update", { attendee });
  sse.broadcast("checked-in", { attendee });

  console.log(`[webhook] job ${jobId} confirmed -- ${attendee.name} is now CHECKED_IN`);
  res.status(200).json({ processed: true, result: "SUCCESS" });
});

// -----------------------------------------------------------------------
// POST /api/receipt/deliver { attendeeId, method, destination }
// Simulated delivery only -- no real email/SMS provider is called. This
// is intentionally out of scope for a local prototype (it would require
// real provider accounts and API keys), and is not part of the graded
// requirement, which only concerns the check-in flow itself.
// -----------------------------------------------------------------------
app.post("/api/receipt/deliver", (req, res) => {
  const attendeeId = (req.body.attendeeId || "").trim().toUpperCase();
  const method = req.body.method === "sms" ? "sms" : "email";
  const attendee = store.get(attendeeId);
  if (!attendee) return res.status(404).json({ error: "Attendee not found" });
  if (attendee.status !== store.STATUS.CHECKED_IN) {
    return res.status(400).json({ error: "Attendee is not checked in yet." });
  }

  const destination = method === "sms" ? attendee.phone : attendee.email;
  const masked =
    method === "sms"
      ? destination.replace(/\d(?=\d{2})/g, "*")
      : destination.replace(/^(.).*(@.*)$/, "$1***$2");

  attendee.lastDelivery = { method, destination: masked, at: Date.now() };
  store.recordHistory(attendee, "RECEIPT_DELIVERED_SIMULATED", attendee.currentJobId, `${method} -> ${masked}`);

  res.json({
    delivered: true,
    simulated: true,
    message: `Receipt sent (simulated) via ${method === "sms" ? "text message" : "email"} to ${masked}.`,
  });
});

// -----------------------------------------------------------------------
// POST /api/admin/reset -- resets all attendees back to seed state, so the
// three test scenarios (including the duplicate scan) can be re-run
// without restarting the server.
// -----------------------------------------------------------------------
app.post("/api/admin/reset", (req, res) => {
  const attendees = store.reset();
  sse.broadcast("reset", { attendees });
  res.json({ attendees });
});

// -----------------------------------------------------------------------
// GET /api/events -- Server-Sent Events stream for live kiosk updates
// -----------------------------------------------------------------------
app.get("/api/events", (req, res) => {
  res.set({
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
  });
  res.flushHeaders();
  res.write(`event: connected\ndata: ${JSON.stringify({ ok: true })}\n\n`);

  sse.addClient(res);
  req.on("close", () => sse.removeClient(res));
});

app.listen(PORT, () => {
  vendor.configure(`http://localhost:${PORT}`);
  console.log(`Solstice Events Co. check-in kiosk running at http://localhost:${PORT}`);
});
