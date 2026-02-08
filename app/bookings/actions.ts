const APP_NAME = "Moja Szafa";

function escapeHtml(input: string): string {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function emailSignatureHtml() {
  return `
    <hr style="border:none;border-top:1px solid #eee;margin:18px 0;" />
    <p style="margin:0; font-size:13px; color:#111827;">
      Pozdrawiamy,<br/>
      <strong>Zespół ${APP_NAME}</strong>
    </p>
    <p style="margin-top:6px; font-size:11px; color:#6b7280; line-height:1.4;">
      Ta wiadomość została wysłana automatycznie — prosimy na nią nie odpowiadać.
    </p>
  `;
}

function emailLayoutHtml(params: {
  title: string;
  intro?: string;      // textito gris debajo del título
  bodyHtml: string;    // aquí metes tus <p>...
  cta?: { label: string; href: string };
  footerNote?: string; // nota pequeña (opcional)
}): string {
  const { title, intro, bodyHtml, cta, footerNote } = params;

  // Nota: en emails, usar tablas mejora compatibilidad
  return `
  <div style="margin:0;padding:0;background:#f6f7fb;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f6f7fb;padding:24px 12px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0"
            style="max-width:600px;background:#ffffff;border-radius:16px;box-shadow:0 6px 24px rgba(0,0,0,0.08);overflow:hidden;font-family:Arial,Helvetica,sans-serif;">
            
            <tr>
              <td style="padding:18px 24px 10px 24px;">
                <div style="font-size:13px;color:#6b7280;">${APP_NAME}</div>
                <div style="font-size:22px;line-height:1.25;font-weight:700;color:#111827;margin-top:6px;">
                  ${escapeHtml(title)}
                </div>
                ${
                  intro
                    ? `<div style="font-size:13px;color:#6b7280;margin-top:8px;line-height:1.4;">
                         ${escapeHtml(intro)}
                       </div>`
                    : ""
                }
              </td>
            </tr>

            <tr>
              <td style="padding:0 24px 8px 24px;">
                <div style="font-size:14px;line-height:1.6;color:#111827;">
                  ${bodyHtml}
                </div>
              </td>
            </tr>

            ${
              cta
                ? `
                <tr>
                  <td style="padding:10px 24px 6px 24px;">
                    <table role="presentation" cellspacing="0" cellpadding="0">
                      <tr>
                        <td style="background:#2563eb;border-radius:12px;">
                          <a href="${cta.href}"
                             style="display:inline-block;padding:12px 16px;font-size:14px;font-weight:700;color:#ffffff;text-decoration:none;">
                            ${escapeHtml(cta.label)} →
                          </a>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
                `
                : ""
            }

            <tr>
              <td style="padding:12px 24px 20px 24px;">
                ${emailSignatureHtml()}
                ${
                  footerNote
                    ? `<div style="font-size:11px;color:#9ca3af;line-height:1.4;margin-top:10px;">
                         ${escapeHtml(footerNote)}
                       </div>`
                    : ""
                }
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </div>
  `;
}
