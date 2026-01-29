export async function onRequestPost({ request, env }) {
  try {
    const body = await request.json();
    const { name, email, message } = body;

    if (!name || !email || !message) {
      return new Response("Missing fields", { status: 400 });
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
      return new Response(
        "Resend error: " + errorText,
        { status: 500 }
      );
    }

    return new Response("Sent", { status: 200 });

  } catch (err) {
    return new Response(
      "Server exception: " + err.message,
      { status: 500 }
    );
  }
}
