export async function onRequestPost({ request, env }) {
  try {

    // Allow only requests coming from your site (browser-originated)
    const origin = request.headers.get("Origin") || "";
    const referer = request.headers.get("Referer") || "";

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

    const esc = (s) =>
      String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

    if (!name || !email || !message) {
      return new Response("Missing fields", { status: 400 });
    }

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

    const resendResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${env.RESEND_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        from: `<${env.MAIL_FROM}>`,
        to: "contact@bumpky.com",
        reply_to: email,
        subject: `Input for Bumpky from ${email}`,
        text: `Name: ${name}\nEmail: ${email}\n\n${message}`,
        html: `
          <div style="font-family: system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif; line-height:1.4">
            <p style="margin:0 0 6px"><b>Name:</b> ${esc(name)}</p>
            <p style="margin:0 0 12px"><b>Email:</b> <a href="mailto:${esc(email)}">${esc(email)}</a></p>
            <p style="margin:0 0 6px"><b>Message:</b></p>
            <div style="white-space:pre-wrap; border:1px solid #e5e7eb; padding:12px; border-radius:8px;">
              ${esc(message)}
            </div>
          </div>
        `
      })
    });

    if (!resendResponse.ok) {
      const errorText = await resendResponse.text();
      return new Response("Resend error: " + errorText, { status: 500 });
    }

    return new Response("Sent", { status: 200 });

  } catch (err) {
    return new Response("Server exception: " + err.message, { status: 500 });
  }
}
