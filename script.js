// Only app1 is live. Others are coming soon.
const apps = {
  app1: {
    url: "https://pub-9094331f54d446aeafbff0e1151fcfc0.r2.dev/Bumpkys_nudger.zip",
    live: true,
    label: "Bumpky's nudger",
    info: "A simple executable that keeps your PC active"
  },
  app2: { url: "", live: false, label: "Bumpky's camera alert", info: "If at any point, your camera is forgotten on, Bumpky will tell you" },
  app3: { url: "", live: false, label: "Bumpky's comfortable screen", info: "Bumpky can make your screen warmer or less bright based on time or preference" },
  app4: { url: "", live: false, label: "Bumpky's clipboard history", info: "Bumpky will store recent clipboard entries" },
  app5: { url: "", live: false, label: "Bumpky's teams status", info: "Bumpky will allow you to manage your teams status automatically and remotely" },
  app6: { url: "", live: false, label: "Bumpky's always on-top", info: "Bumpky will pin one or more selected windows on top" },
  app7: { url: "", live: false, label: "Bumpky as an AI assistant", info: "Bumpky will be your personal assistant" },
  // app8 will open recommendation form rather than download
  app8: { url: "", live: true, label: "Recommendations", info: "Waiting for your recommendation" },
};

function triggerDownload(url) {
  const a = document.createElement("a");
  a.href = url;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
}

/* --- Modal helpers --- */
const modal = {
  node: document.getElementById("recommendModal"),
  open() {
    if (!this.node) return;
    this.node.setAttribute("aria-hidden", "false");
    // focus first input
    const first = this.node.querySelector("input, textarea, button");
    if (first) first.focus();
    // trap simple escape
    this._escHandler = (e) => { if (e.key === "Escape") this.close(); };
    document.addEventListener("keydown", this._escHandler);
  },
  close() {
    if (!this.node) return;
    this.node.setAttribute("aria-hidden", "true");
    document.removeEventListener("keydown", this._escHandler);
  }
};

document.addEventListener("click", (e) => {
  // close when clicking backdrop close elements
  const backdrop = e.target.closest('[data-close="true"]');
  if (backdrop && modal.node && modal.node.contains(backdrop)) modal.close();
});

// Close any open info tooltips when clicking elsewhere
document.addEventListener("click", (e) => {
  if (!e.target.closest(".infoWrap")) {
    document.querySelectorAll(".infoWrap.tip-open").forEach((el) => el.classList.remove("tip-open"));
  }
});

document.addEventListener("DOMContentLoaded", () => {
  // wire modal buttons
  const closeBtn = document.querySelector(".rec-close");
  if (closeBtn) closeBtn.addEventListener("click", () => modal.close());
  const cancelBtn = document.querySelector(".rec-cancel");
  if (cancelBtn) cancelBtn.addEventListener("click", () => modal.close());

  const form = document.getElementById("recForm");
  const statusEl = document.getElementById("recStatus");

  if (form) {
    form.addEventListener("submit", async (ev) => {
      ev.preventDefault();
      statusEl.textContent = "Sending…";

      const formData = new FormData(form);
      const payload = {
        name: formData.get("name"),
        email: formData.get("email"),
        message: formData.get("message"),
        turnstileToken: formData.get("cf-turnstile-response") || ""
      };

      try {
        const res = await fetch("/api/recommend", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        });

      if (!res.ok) {
        statusEl.textContent = "Failed to send recommendation. Please try again.";
        // ✅ IMPORTANT: reset Turnstile so you get a fresh token
        if (window.turnstile) window.turnstile.reset();
        return;
      }

        statusEl.textContent = "Recommendation sent — thank you!";
        form.reset();

      // ✅ IMPORTANT: reset Turnstile after a successful send too
      if (window.turnstile) window.turnstile.reset();

        setTimeout(() => modal.close(), 1200);
      } catch (err) {
        console.error(err);
        statusEl.textContent = "An error occurred while sending.";
        if (window.turnstile) window.turnstile.reset();
      }
    });
  }
});

/* --- main node wiring (preserves original behavior) --- */
document.querySelectorAll(".node").forEach((btn) => {
  const key = btn.dataset.app;
  const app = apps[key];
  if (!app) return;

  // Update normal hover label text (still exists, but hidden while hovering info icon)
  const labelEl = btn.querySelector(".label");
  if (labelEl && app.label) labelEl.textContent = app.label;

  // Update info tooltip text (use app.info if present, otherwise fall back to app.label)
  const tipEl = btn.querySelector(".infoTip");
  if (tipEl) tipEl.textContent = app.info || app.label || "";

  // Prevent info icon click from triggering the button click/download
  const infoWrap = btn.querySelector(".infoWrap");
  if (infoWrap) {
    const toggleTip = () => {
      // close any other open tooltips
      document.querySelectorAll(".infoWrap.tip-open").forEach((el) => {
        if (el !== infoWrap) el.classList.remove("tip-open");
      });
      infoWrap.classList.toggle("tip-open");
    };

    // Prevent info icon click from triggering the button click/download,
    // and toggle tooltip for touch devices.
    infoWrap.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      toggleTip();
    });

    // Keyboard support (Enter / Space)
    infoWrap.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        e.stopPropagation();
        toggleTip();
      }
    });
  }

  if (!app.live) {
    btn.classList.add("disabled");
    btn.setAttribute("aria-disabled", "true");
  }

  btn.addEventListener("click", (event) => {
    // Special case: app8 opens the modal form
    if (key === "app8") {
      event.preventDefault();
      modal.open();
      return;
    }

    if (!app.live) return;
    triggerDownload(app.url);
  });
});
