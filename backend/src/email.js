export async function sendTransactionalEmail({ to, subject, html }) {
  const { RESEND_API_KEY, EMAIL_FROM } = process.env;
  if (!RESEND_API_KEY || !EMAIL_FROM) {
    const error = new Error("Transactional email is not configured.");
    error.status = 503;
    error.expose = true;
    throw error;
  }
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ from: EMAIL_FROM, to: [to], subject, html }),
    signal: AbortSignal.timeout(10000)
  });
  if (!response.ok) {
    console.error("Transactional email provider returned status:", response.status);
    const error = new Error("The email could not be sent. Please try again later.");
    error.status = 503;
    error.expose = true;
    throw error;
  }
}

export function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;"
  })[character]);
}
