export interface MagicLinkEmailTemplateProps {
  magicLink: string
  userName?: string
  appName?: string
  expiryTime?: string
}

/**
 * Dependency-free HTML email template, based on
 * `packages/auth/auth-plugin/src/email/sign-in.tsx`.
 */
export function buildMagicLinkEmailHtml({
  magicLink,
  userName = '',
  appName = 'Our App',
  expiryTime = '1 hour',
}: MagicLinkEmailTemplateProps): string {
  const greeting = userName ? `Hello, ${escapeHtml(userName)}` : 'Hello'
  const safeAppName = escapeHtml(appName)
  const safeLink = escapeHtml(magicLink)

  return `<!doctype html>
<html>
  <head>
    <meta http-equiv="Content-Type" content="text/html; charset=utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Your magic link</title>
  </head>
  <body style="margin:0;padding:0;background-color:#f6f9fc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Oxygen-Sans,Ubuntu,Cantarell,'Helvetica Neue',sans-serif;">
    <div style="padding:60px 0;">
      <div style="background-color:#ffffff;border:1px solid #eee;border-radius:5px;box-shadow:0 5px 10px rgba(20,50,70,0.2);margin:0 auto;max-width:600px;">
        <div style="padding:20px 0;border-bottom:1px solid #eaeaea;text-align:center;">
          <h1 style="font-size:32px;font-weight:700;color:#000;margin:0;">${safeAppName}</h1>
        </div>
        <div style="padding:40px 30px;">
          <h2 style="font-size:22px;font-weight:700;margin:0 0 20px;">${greeting}</h2>
          <p style="font-size:16px;line-height:1.5;margin:0 0 20px;color:#444;">
            Someone requested a magic link to sign in to your ${safeAppName} account. Click the button below to sign in.
            This link expires in ${escapeHtml(expiryTime)}.
          </p>
          <div style="margin:15px 0 30px;">
            <a href="${safeLink}" style="background-color:#5570f6;border-radius:5px;color:#fff;display:inline-block;font-weight:700;text-decoration:none;text-align:center;padding:10px 20px;">
              Sign in to ${safeAppName}
            </a>
          </div>
          <p style="font-size:16px;line-height:1.5;margin:0 0 20px;color:#444;">
            If you didn't request this link, you can safely ignore this email.
          </p>
          <hr style="border:none;border-top:1px solid #eaeaea;margin:30px 0;" />
          <p style="font-size:14px;color:#6c757d;margin:0 0 10px;">
            If the button above doesn't work, paste this link into your browser:
          </p>
          <p style="font-size:14px;line-height:1.4;margin:0 0 20px;word-break:break-all;">
            <a href="${safeLink}" style="color:#5570f6;text-decoration:none;">${safeLink}</a>
          </p>
        </div>
      </div>
    </div>
  </body>
</html>`
}

function escapeHtml(input: string): string {
  return input
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}


