// -----------------------------------------------------------------------
// Simulated badge-printer vendor.
//
// This stands in for Solstice's real third-party printer vendor, which
// (per the brief) has deprecated its synchronous "call and wait" API in
// favor of an asynchronous model:
//
//   1. We PUBLISH a print request onto the vendor's message queue.
//   2. The vendor's own systems process the queue on their own schedule
//      (physical printers are slower and less predictable than an HTTP
//      response) and, once a job is actually done, calls a WEBHOOK we
//      exposed to report completion.
//
// To make that decoupling real rather than illustrative, this module
// does not just resolve a Promise -- it performs an actual HTTP POST back
// to our own /api/webhook/print-complete endpoint after a randomized
// delay, exactly as an external vendor would. Because each job's delay is
// randomized independently, jobs queued in one order can (and sometimes
// will) complete out of order, and the queue's "at least once delivery"
// guarantee is modeled by occasionally re-sending a completion callback
// that has already been delivered.
// -----------------------------------------------------------------------

const queue = [];

let webhookBaseUrl = null;
function configure(baseUrl) {
  webhookBaseUrl = baseUrl;
}

function randomBetween(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

async function callWebhook(payload) {
  try {
    await fetch(`${webhookBaseUrl}/api/webhook/print-complete`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  } catch (err) {
    console.error("[vendor-simulator] webhook delivery failed:", err.message);
  }
}

// Publish a print job onto the vendor's message queue.
// This returns immediately -- the caller does NOT wait for the print to
// finish, unlike the deprecated synchronous API.
function publishPrintJob({ jobId, attendeeId }) {
  const job = { jobId, attendeeId, queuedAt: Date.now() };
  queue.push(job);
  console.log(
    `[vendor-simulator] queued print job ${jobId} for ${attendeeId} (queue depth: ${queue.length})`
  );

  // Simulate real, variable printer/vendor latency (1.5s - 4.5s).
  const printDelayMs = randomBetween(1500, 4500);

  setTimeout(async () => {
    console.log(
      `[vendor-simulator] job ${jobId} finished printing after ${printDelayMs}ms -> calling webhook`
    );
    await callWebhook({ jobId, attendeeId, result: "SUCCESS" });

    // ~25% of the time, simulate the message queue's "at least once"
    // delivery guarantee by redelivering the same completion event a
    // little later. A correct webhook handler must treat this as a
    // no-op instead of double-processing the check-in.
    if (Math.random() < 0.25) {
      const redeliveryDelay = randomBetween(800, 2000);
      setTimeout(() => {
        console.log(
          `[vendor-simulator] redelivering (duplicate) completion for job ${jobId} -- this should be ignored`
        );
        callWebhook({ jobId, attendeeId, result: "SUCCESS" });
      }, redeliveryDelay);
    }
  }, printDelayMs);

  return job;
}

module.exports = { configure, publishPrintJob };
