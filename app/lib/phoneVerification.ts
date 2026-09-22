const PHONE_PATTERN = /^\+[1-9]\d{7,14}$/;

export function normalizePhone(value: string) {
  const compact = value.trim().replace(/[\s().-]/g, "");
  const international = compact.startsWith("00") ? `+${compact.slice(2)}` : compact;
  const normalized = /^\d{9}$/.test(international) ? `+48${international}` : international;
  if (!PHONE_PATTERN.test(normalized)) {
    throw new Error("Podaj prawidłowy numer telefonu z kodem kraju, np. +48 123 456 789.");
  }
  return normalized;
}

export function maskPhone(phone: string | null) {
  if (!phone) return "—";
  return phone.length > 6 ? `${phone.slice(0, 3)}••••${phone.slice(-3)}` : "••••••";
}

type VerifyResponse = { status?: string };

async function verifyRequest(path: string, body: URLSearchParams): Promise<VerifyResponse> {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const serviceSid = process.env.TWILIO_VERIFY_SERVICE_SID;
  if (!accountSid || !authToken || !serviceSid) throw new Error("Weryfikacja telefonu jest chwilowo niedostępna.");
  const response = await fetch(`https://verify.twilio.com/v2/Services/${encodeURIComponent(serviceSid)}/${path}`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
    cache: "no-store",
  });
  const result = await response.json().catch(() => ({})) as VerifyResponse;
  if (!response.ok) throw new Error("Nie udało się wysłać lub sprawdzić kodu. Spróbuj ponownie później.");
  return result;
}

export async function sendPhoneCode(phone: string) {
  await verifyRequest("Verifications", new URLSearchParams({ To: phone, Channel: "sms" }));
}

export async function checkPhoneCode(phone: string, code: string) {
  if (!/^\d{4,10}$/.test(code)) return false;
  const result = await verifyRequest("VerificationCheck", new URLSearchParams({ To: phone, Code: code }));
  return result.status === "approved";
}
