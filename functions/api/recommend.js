export async function onRequestPost(context) {
  try {
    const { request, env } = context;

    // Read JSON body sent from the browser
    const body = await request.json();
    const { name, email, message } = body;

    // Basic validation
    if (!name || !email || !message) {
      return new Response("Missing fields", { status: 400 });
    }

    // Send email using Resend API
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${env.RESEND_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        from: env.MAIL_FROM,
        to: ["bumpkerson@gmail.com"],
        subject: `New Bumpky recommendation from ${name}`,
        text: `Name: ${name}\nEmail: ${email}\n\n${message}`
      })
    });

    if (!response.ok) {
      return new Response("Failed to send email", { status: 500 });
    }

    return new Response("Sent", { status: 200 });
  } catch (err) {
    return new Response("Server error", { status: 500 });
  }
}
