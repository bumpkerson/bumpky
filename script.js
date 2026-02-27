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

let tsWidgetId = null;

function ensureTurnstileRendered() {
  const el = document.getElementById("ts-recommend");
  if (!el) return;

  // Wait for Cloudflare Turnstile library
  if (!window.turnstile || typeof window.turnstile.render !== "function") {
    setTimeout(ensureTurnstileRendered, 100);
    return;
  }

  // If we already rendered once, reset it
  if (tsWidgetId !== null) {
    try {
      window.turnstile.reset(tsWidgetId);
      return;
    } catch (e) {
      // If reset fails, fall through to re-render
      tsWidgetId = null;
      el.innerHTML = "";
    }
  }

  // Render fresh
  try {
    tsWidgetId = window.turnstile.render(el, {
      sitekey: "0x4AAAAAACjIK7o8Ze7Zt8UQ",
    });
  } catch (e) {
    // Retry if render happens too early
    setTimeout(ensureTurnstileRendered, 200);
  }
}

function getTurnstileToken() {
  const tokenInput = document.querySelector('input[name="cf-turnstile-response"]');
  return tokenInput?.value || "";
}

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

    // Render/reset Turnstile when modal becomes visible
    setTimeout(() => ensureTurnstileRendered(), 0);

    // Clear status text each time modal opens
    const statusEl = document.getElementById("recStatus");
    if (statusEl) statusEl.textContent = "";

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
      if (statusEl) statusEl.textContent = "Sending…";

      const formData = new FormData(form);
      const payload = {
        company: formData.get("company") || "",
        name: formData.get("name"),
        email: formData.get("email"),
        message: formData.get("message"),
        turnstileToken: getTurnstileToken()
      };

      try {
        const res = await fetch("/api/recommend", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        });

        if (!res.ok) {
          if (statusEl) statusEl.textContent = "Failed to send recommendation. Please try again.";
          // Reset Turnstile (tiny delay improves reliability in modals)
          setTimeout(() => ensureTurnstileRendered(), 50);
          return;
        }

        if (statusEl) statusEl.textContent = "Recommendation sent — thank you!";
        form.reset();

        // Reset Turnstile after success too
        setTimeout(() => ensureTurnstileRendered(), 50);

        setTimeout(() => modal.close(), 1200);
      } catch (err) {
        console.error(err);
        if (statusEl) statusEl.textContent = "An error occurred while sending.";
        setTimeout(() => ensureTurnstileRendered(), 50);
      }
    });
  }
  // Pre-warm Turnstile (optional)
  setTimeout(() => ensureTurnstileRendered(), 0);
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