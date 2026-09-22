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

type VerifyResponse = { status?: string; code?: number };

function twilioErrorMessage(result: VerifyResponse, httpStatus: number) {
  const code = result.code;
  if (httpStatus === 401 || code === 20003) {
    return "Błąd konfiguracji Twilio: sprawdź Account SID i Auth Token w Vercel.";
  }
  if (httpStatus === 404 || code === 20404) {
    return "Nie znaleziono usługi Twilio Verify. Sprawdź Verify Service SID w Vercel.";
  }
  if (code === 60200) return "Numer telefonu lub kanał SMS jest nieprawidłowy. Wpisz numer z kodem kraju.";
  if (code === 60203) return "Osiągnięto limit wysyłek na ten numer. Spróbuj ponownie później.";
  if (code === 60205) return "Ten numer nie obsługuje wiadomości SMS. Użyj numeru komórkowego.";
  if (code === 60207 || httpStatus === 429) return "Osiągnięto limit wysyłek. Spróbuj ponownie później.";
  if (code === 60238 || code === 60605) {
    return "Twilio zablokowało wysyłkę. Sprawdź Fraud Guard, Blocked Verifications i Geo Permissions.";
  }
  return `Twilio odrzuciło żądanie (kod ${code ?? httpStatus}). Sprawdź logi Verify.`;
}

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
  if (!response.ok) {
    console.error("[PHONE VERIFY] Twilio request rejected", {
      action: path,
      httpStatus: response.status,
      twilioCode: result.code ?? null,
    });
    throw new Error(twilioErrorMessage(result, response.status));
  }
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
