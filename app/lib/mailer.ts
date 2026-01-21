// app/lib/mailer.ts
import nodemailer from "nodemailer";

let _transporter: nodemailer.Transporter | null = null;
let _verified = false;

function getTransporter() {
  if (_transporter) return _transporter;

  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT || 587);
  const secure = port === 465; // SSL solo en 465
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!host || !user || !pass) {
    throw new Error(
      "[MAIL] Missing SMTP env vars. Need SMTP_HOST, SMTP_USER, SMTP_PASS (and optionally SMTP_PORT, SMTP_FROM)."
    );
  }

  _transporter = nodemailer.createTransport({
    host,
    port,
    secure,
    auth: { user, pass },
  });

  // Verificación útil SOLO en desarrollo (una sola vez)
  if (process.env.NODE_ENV !== "production" && !_verified) {
    _verified = true;
    _transporter
      .verify()
      .then(() => {
        console.log(
          `[MAIL] ready host=${host}:${port} secure=${secure} user=${user}`
        );
      })
      .catch((err) => {
        console.error("[MAIL] verify FAILED:", err);
      });
  }

  return _transporter;
}

export async function sendMail(opts: {
  to: string;
  subject: string;
  html: string;
  text?: string;

  // opcionales
  from?: string;    // si quieres sobreescribir el SMTP_FROM
  replyTo?: string; // para que al responder vaya al usuario del formulario
}) {
  const transporter = getTransporter();

  const from = opts.from || process.env.SMTP_FROM || "Moja Szafa <no-reply@localhost>";
  const to = opts.to || process.env.DEV_FALLBACK_TO || "";

  if (!to) {
    throw new Error("[MAIL] Empty recipient: missing 'to' and DEV_FALLBACK_TO");
  }

  console.log(`[MAIL] sending → to="${to}" subject="${opts.subject}"`);

  try {
    const info = await transporter.sendMail({
      from,
      to,
      subject: opts.subject,
      html: opts.html,
      text: opts.text,
      ...(opts.replyTo ? { replyTo: opts.replyTo } : {}),
    });

    console.log("[MAIL] sent OK id:", info.messageId);
    return info;
  } catch (err) {
    console.error("[MAIL] send ERROR:", err);
    // ✅ IMPORTANTÍSIMO: no tragar el error
    throw err;
  }
}
export { sendMail as sendEmail };
