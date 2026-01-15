function escapeHtml(input: string): string {
  return input
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

export function buildBasicAuthEmailHtml({
  appName,
  title,
  greeting,
  body,
  ctaText,
  ctaUrl,
  footer,
}: {
  appName: string
  title: string
  greeting?: string
  body: string
  ctaText?: string
  ctaUrl?: string
  footer?: string
}): string {
  const safeAppName = escapeHtml(appName)
  const safeTitle = escapeHtml(title)
  const safeGreeting = greeting ? escapeHtml(greeting) : 'Hello'
  const safeBody = escapeHtml(body).replaceAll('\n', '<br />')
  const safeFooter = footer ? escapeHtml(footer) : ''
  const safeCtaText = ctaText ? escapeHtml(ctaText) : ''
  const safeCtaUrl = ctaUrl ? escapeHtml(ctaUrl) : ''

  return `<!doctype html>
<html>
  <head>
    <meta http-equiv="Content-Type" content="text/html; charset=utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${safeTitle}</title>
  </head>
  <body style="margin:0;padding:0;background-color:#f6f9fc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Oxygen-Sans,Ubuntu,Cantarell,'Helvetica Neue',sans-serif;">
    <div style="padding:40px 0;">
      <div style="background-color:#ffffff;border:1px solid #eee;border-radius:5px;box-shadow:0 5px 10px rgba(20,50,70,0.2);margin:0 auto;max-width:600px;">
        <div style="padding:18px 0;border-bottom:1px solid #eaeaea;text-align:center;">
          <h1 style="font-size:28px;font-weight:700;color:#000;margin:0;">${safeAppName}</h1>
        </div>
        <div style="padding:28px 24px;">
          <h2 style="font-size:20px;font-weight:700;margin:0 0 16px;">${safeGreeting}</h2>
          <p style="font-size:15px;line-height:1.55;margin:0 0 18px;color:#444;">${safeBody}</p>
          ${
            ctaUrl && ctaText
              ? `<div style="margin:14px 0 22px;">
            <a href="${safeCtaUrl}" style="background-color:#5570f6;border-radius:5px;color:#fff;display:inline-block;font-weight:700;text-decoration:none;text-align:center;padding:10px 16px;">
              ${safeCtaText}
            </a>
          </div>
          <p style="font-size:13px;line-height:1.4;margin:0 0 14px;color:#6c757d;">
            If the button doesn't work, paste this link into your browser:
          </p>
          <p style="font-size:13px;line-height:1.4;margin:0 0 18px;word-break:break-all;">
            <a href="${safeCtaUrl}" style="color:#5570f6;text-decoration:none;">${safeCtaUrl}</a>
          </p>`
              : ''
          }
          ${
            safeFooter
              ? `<hr style="border:none;border-top:1px solid #eaeaea;margin:18px 0;" />
          <p style="font-size:12px;line-height:1.4;margin:0;color:#6c757d;">${safeFooter}</p>`
              : ''
          }
        </div>
      </div>
    </div>
  </body>
</html>`
}


