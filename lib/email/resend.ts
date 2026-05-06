// Thin Resend wrapper using their HTTPS API directly. Avoids pulling in
// the SDK as a build dependency; the API surface we use is small enough
// that a fetch wrapper is cheaper than the package.
//
// Required env: RESEND_API_KEY, RESEND_FROM_EMAIL.

const RESEND_API = "https://api.resend.com/emails";

export type SendEmailInput = {
  to: string;
  subject: string;
  html: string;
};

export type SendEmailResult =
  | { ok: true; id: string }
  | { ok: false; error: string };

export async function sendEmail(input: SendEmailInput): Promise<SendEmailResult> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM_EMAIL;
  if (!apiKey || !from) {
    return { ok: false, error: "resend_not_configured" };
  }

  const response = await fetch(RESEND_API, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: input.to,
      subject: input.subject,
      html: input.html,
    }),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    return { ok: false, error: `resend_${response.status}: ${text}` };
  }

  const data = (await response.json().catch(() => ({}))) as { id?: string };
  return { ok: true, id: data.id ?? "" };
}
