export async function onRequestPost({ request, env }) {
  try {
    const body = await request.json();
    const { name, email, message, turnstileToken } = body;

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
        from: env.MAIL_FROM,
        to: "bumpkerson@gmail.com",
        subject: `Bumpky recommendation from ${name}`,
        text: `Name: ${name}\nEmail: ${email}\n\n${message}`
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
