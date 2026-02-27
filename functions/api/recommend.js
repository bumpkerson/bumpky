export async function onRequestPost({ request, env }) {
  try {

    // Allow only requests coming from your site (browser-originated)
    const origin = request.headers.get("Origin") || "";
    const referer = request.headers.get("Referer") || "";

    const ct = request.headers.get("Content-Type") || "";
    if (!ct.toLowerCase().includes("application/json")) {
      return new Response("Unsupported content type", { status: 415 });
    }

    const len = Number(request.headers.get("Content-Length") || "0");
    if (len && len > 20_000) {
      return new Response("Payload too large", { status: 413 });
    }

    const allowedOrigins = new Set([
      "https://bumpky.com",
      "https://www.bumpky.com",
      "https://bumpky.pages.dev",
    ]);

    const allowed =
      (origin && origin !== "null" && allowedOrigins.has(origin)) ||
      ((origin === "" || origin === "null") &&
        referer &&
        [...allowedOrigins].some((o) => referer.startsWith(o)));


    if (!allowed) {
      return new Response("Forbidden origin", { status: 403 });
    }

    const body = await request.json();
    const { name, email, message, turnstileToken } = body;

    const norm = (v) => String(v ?? "").trim();

    const company = norm(body.company);
    if (company) return new Response("Forbidden", { status: 403 });

    const nameN = norm(name);
    const emailN = norm(email);
    const messageN = norm(message);

    if (nameN.length < 1 || nameN.length > 80) return new Response("Invalid name", { status: 400 });
    if (emailN.length < 5 || emailN.length > 254) return new Response("Invalid email", { status: 400 });
    if (messageN.length < 1 || messageN.length > 2000) return new Response("Invalid message", { status: 400 });

    // Simple email format check (good enough)
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailN)) {
      return new Response("Invalid email", { status: 400 });
    }

    const esc = (s) =>
      String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

    if (!turnstileToken) {
      return new Response("Missing Turnstile token", { status: 400 });
    }

    // Turnstile server-side verification
    const ip = request.headers.get("CF-Connecting-IP") || "";
    const verifyResp = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        secret: env.TURNSTILE_SECRET,
        response: turnstileToken,
        ...(ip ? { remoteip: ip } : {}),
      }),
    });

    const verify = await verifyResp.json();
    if (!verify.success) {
      return new Response(
        "Turnstile failed: " + JSON.stringify(verify["error-codes"] || []),
        { status: 403 }
      );
    }

    const ac = new AbortController();
    const t = setTimeout(() => ac.abort(), 8000);

    let resendResponse;
    try {
      resendResponse = await fetch("https://api.resend.com/emails", {
        method: "POST",
        signal: ac.signal,
        headers: {
          "Authorization": `Bearer ${env.RESEND_API_KEY}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          from: env.MAIL_FROM,
          to: "contact@bumpky.com",
          reply_to: emailN,
          subject: `Input for Bumpky from ${emailN}`,
          text: `nameN: ${nameN}\nemailN: ${emailN}\n\n${messageN}`,
          html: `
            <div style="font-family: system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif; line-height:1.4">
              <p style="margin:0 0 6px"><b>nameN:</b> ${esc(nameN)}</p>
              <p style="margin:0 0 12px"><b>emailN:</b> <a href="mailto:${esc(emailN)}">${esc(emailN)}</a></p>
              <p style="margin:0 0 6px"><b>messageN:</b></p>
              <div style="white-space:pre-wrap; border:1px solid #e5e7eb; padding:12px; border-radius:8px;">
                ${esc(messageN)}
              </div>
            </div>
          `
        })
      });
    } finally {
      clearTimeout(t);
    }

    if (!resendResponse.ok) {
      const errorText = await resendResponse.text();
      return new Response("Resend error: " + errorText, { status: 500 });
    }

    return new Response("Sent", { status: 200 });

  } catch (err) {
    return new Response("Server exception: " + err.message, { status: 500 });
  }
}
