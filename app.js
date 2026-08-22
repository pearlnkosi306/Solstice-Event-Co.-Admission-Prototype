(() => {
  "use strict";

  const els = {
    tabs: document.querySelectorAll(".tab"),
    panels: document.querySelectorAll(".tab-panel"),
    statusWell: document.getElementById("statusWell"),
    feedList: document.getElementById("feedList"),
    badgeGrid: document.getElementById("badgeGrid"),
    manualForm: document.getElementById("manualForm"),
    manualId: document.getElementById("manualId"),
    connIndicator: document.getElementById("connIndicator"),
    arcFill: document.getElementById("arcFill"),
    toggleCamera: document.getElementById("toggleCamera"),
  };

  const receiptTemplate = document.getElementById("receiptTemplate");

  // Tracks the attendee ID currently being watched for a check-in
  // confirmation, so the status well knows which SSE event to render as
  // a receipt versus which ones just update the background badge grid.
  let watchedAttendeeId = null;
  let html5QrInstance = null;
  let cameraRunning = false;

  // ---------------------------------------------------------------- tabs
  els.tabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      els.tabs.forEach((t) => { t.classList.remove("is-active"); t.setAttribute("aria-selected", "false"); });
      els.panels.forEach((p) => p.classList.remove("is-active"));
      tab.classList.add("is-active");
      tab.setAttribute("aria-selected", "true");
      const panel = document.querySelector(`.tab-panel[data-panel="${tab.dataset.tab}"]`);
      panel.classList.add("is-active");
      if (tab.dataset.tab !== "scan" && cameraRunning) stopCamera();
    });
  });

  // ---------------------------------------------------------------- arc
  function setArcState(state) {
    els.arcFill.classList.remove("state-pending", "state-confirmed");
    if (state === "pending") els.arcFill.classList.add("state-pending");
    if (state === "confirmed") els.arcFill.classList.add("state-confirmed");
  }

  // ------------------------------------------------------------- status well
  function renderStatusMessage(tone, message) {
    els.statusWell.innerHTML = `<div class="status-message tone-${tone}">${escapeHtml(message)}</div>`;
  }

  function renderReceipt(attendee) {
    const node = receiptTemplate.content.cloneNode(true);
    node.querySelector('[data-field="name"]').textContent = attendee.name;
    node.querySelector('[data-field="id"]').textContent = attendee.id;
    node.querySelector('[data-field="jobId"]').textContent = attendee.currentJobId || "—";
    const checkInTime = attendee.checkInTime ? new Date(attendee.checkInTime) : new Date();
    node.querySelector('[data-field="time"]').textContent = checkInTime.toLocaleTimeString();
    node.querySelector('[data-field="confirmedLabel"]').textContent = checkInTime.toLocaleString();

    const wrapper = document.createElement("div");
    wrapper.appendChild(node);
    const card = wrapper.firstElementChild;

    card.querySelectorAll("[data-deliver]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        btn.disabled = true;
        const method = btn.dataset.deliver;
        try {
          const res = await fetch("/api/receipt/deliver", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ attendeeId: attendee.id, method }),
          });
          const data = await res.json();
          card.querySelector('[data-field="deliveryResult"]').textContent = data.message || "Delivery simulated.";
        } catch (err) {
          card.querySelector('[data-field="deliveryResult"]').textContent = "Could not simulate delivery right now.";
        } finally {
          btn.disabled = false;
        }
      });
    });

    els.statusWell.innerHTML = "";
    els.statusWell.appendChild(card);
  }

  function escapeHtml(str) {
    const div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
  }

  // -------------------------------------------------------------- feed
  function pushFeedItem(kind, title, meta) {
    const li = document.createElement("li");
    li.className = `feed-item ev-${kind}`;
    li.innerHTML = `<div class="feed-title">${escapeHtml(title)}</div><div class="feed-meta">${escapeHtml(meta)}</div>`;
    els.feedList.prepend(li);
    while (els.feedList.children.length > 40) els.feedList.removeChild(els.feedList.lastChild);
  }

  // -------------------------------------------------------------- badges
  const STATUS_LABEL = {
    NOT_CHECKED_IN: { text: "Not checked in", cls: "st-not" },
    PRINT_PENDING: { text: "Printing…", cls: "st-pending" },
    CHECKED_IN: { text: "Checked in", cls: "st-checked" },
  };

  async function loadBadges() {
    const res = await fetch("/api/attendees");
    const { attendees } = await res.json();
    els.badgeGrid.innerHTML = "";
    for (const attendee of attendees) {
      const qrRes = await fetch(`/api/attendees/${attendee.id}/qrcode`);
      const { dataUrl } = await qrRes.json();
      const card = document.createElement("div");
      card.className = "badge-card";
      card.dataset.attendeeId = attendee.id;
      const status = STATUS_LABEL[attendee.status];
      card.innerHTML = `
        <img src="${dataUrl}" alt="QR badge for ${escapeHtml(attendee.name)}" />
        <p class="badge-name">${escapeHtml(attendee.name)}</p>
        <p class="badge-id">${escapeHtml(attendee.id)}</p>
        <span class="badge-status ${status.cls}" data-status-chip>${status.text}</span>
        <div><button class="btn btn-ghost btn-sm" data-simulate="${attendee.id}" type="button">Simulate Scan</button></div>
      `;
      els.badgeGrid.appendChild(card);
    }
    els.badgeGrid.querySelectorAll("[data-simulate]").forEach((btn) => {
      btn.addEventListener("click", () => attemptCheckIn(btn.dataset.simulate, "qr"));
    });
  }

  function updateBadgeCardStatus(attendee) {
    const card = els.badgeGrid.querySelector(`[data-attendee-id="${attendee.id}"]`);
    if (!card) return;
    const chip = card.querySelector("[data-status-chip]");
    const status = STATUS_LABEL[attendee.status];
    chip.className = `badge-status ${status.cls}`;
    chip.textContent = status.text;
  }

  // -------------------------------------------------------------- check-in
  async function attemptCheckIn(rawId, method) {
    const attendeeId = rawId.trim().toUpperCase();
    if (!attendeeId) return;

    watchedAttendeeId = attendeeId;
    renderStatusMessage("pending", `Looking up ${attendeeId}…`);

    try {
      const res = await fetch("/api/checkin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ attendeeId, method }),
      });
      const data = await res.json();

      if (res.status === 202 && data.pending) {
        setArcState("pending");
        renderStatusMessage("pending", data.message);
        pushFeedItem("pending", `${data.attendee.name} scanned in`, `${attendeeId} · badge printing · job ${data.attendee.currentJobId}`);
      } else if (data.duplicate) {
        setArcState(data.reason === "already-checked-in" ? "confirmed" : "pending");
        renderStatusMessage("error", data.message);
        pushFeedItem("duplicate", `Duplicate scan blocked`, `${attendeeId} · ${data.reason}`);
      } else if (res.status === 404) {
        renderStatusMessage("error", data.error || "Attendee not found.");
      } else {
        renderStatusMessage("error", data.error || "Something went wrong.");
      }
    } catch (err) {
      renderStatusMessage("error", "Could not reach the check-in service. Is the server running?");
    }
  }

  els.manualForm.addEventListener("submit", (e) => {
    e.preventDefault();
    attemptCheckIn(els.manualId.value, "manual");
    els.manualId.value = "";
  });

  document.querySelectorAll("[data-quickid]").forEach((chip) => {
    chip.addEventListener("click", () => attemptCheckIn(chip.dataset.quickid, "manual"));
  });

  // -------------------------------------------------------------- camera
  function startCamera() {
    if (typeof Html5Qrcode === "undefined") {
      renderStatusMessage("error", "Camera library failed to load. Check your internet connection or use Manual / Staff Preview instead.");
      return;
    }
    html5QrInstance = new Html5Qrcode("qrReader");
    html5QrInstance
      .start(
        { facingMode: "environment" },
        { fps: 10, qrbox: 220 },
        (decodedText) => attemptCheckIn(decodedText, "qr"),
        () => {}
      )
      .then(() => {
        cameraRunning = true;
        els.toggleCamera.textContent = "Stop camera";
      })
      .catch(() => {
        renderStatusMessage("error", "Could not access a camera on this device. Try Manual entry or Staff Badge Preview instead.");
      });
  }

  function stopCamera() {
    if (html5QrInstance && cameraRunning) {
      html5QrInstance.stop().catch(() => {});
    }
    cameraRunning = false;
    els.toggleCamera.textContent = "Start camera";
  }

  els.toggleCamera.addEventListener("click", () => (cameraRunning ? stopCamera() : startCamera()));

  // -------------------------------------------------------------- SSE
  function connectEvents() {
    const source = new EventSource("/api/events");

    source.addEventListener("connected", () => {
      els.connIndicator.dataset.state = "connected";
      els.connIndicator.querySelector(".conn-label").textContent = "Connected to venue systems";
    });

    source.addEventListener("status-update", (e) => {
      const { attendee } = JSON.parse(e.data);
      updateBadgeCardStatus(attendee);
      if (attendee.id === watchedAttendeeId && attendee.status === "PRINT_PENDING") {
        setArcState("pending");
      }
    });

    source.addEventListener("checked-in", (e) => {
      const { attendee } = JSON.parse(e.data);
      updateBadgeCardStatus(attendee);
      pushFeedItem("checked", `${attendee.name} confirmed`, `${attendee.id} · job ${attendee.currentJobId} · webhook received`);
      if (attendee.id === watchedAttendeeId) {
        setArcState("confirmed");
        renderReceipt(attendee);
      }
    });

    source.addEventListener("reset", () => {
      loadBadges();
      renderStatusMessage("pending", "All attendees reset to Not Checked In.");
      setArcState(null);
    });

    source.onerror = () => {
      els.connIndicator.dataset.state = "error";
      els.connIndicator.querySelector(".conn-label").textContent = "Reconnecting…";
    };
  }

  // -------------------------------------------------------------- boot
  loadBadges();
  connectEvents();
})();
