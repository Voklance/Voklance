const escapeHtml = (value: string) =>
  value.replace(
    /[&<>"']/g,
    (char) =>
      ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
      })[char] ?? char
  );

export function verificationTemplate(verificationUrl: string) {
  const safeUrl = escapeHtml(verificationUrl);
  return {
    subject: 'Verify your email address — VOKLANCE',
    text: `Welcome to VOKLANCE!\n\nPlease verify your email address to complete your account setup.\n\nVerify Email Address: ${verificationUrl}\n\nThis verification link expires in 24 hours.\n\nIf you did not create a VOKLANCE account, you can ignore this email.\n\nVOKLANCE\nConnect. Collaborate. Grow.`,
    html: `<!doctype html><html lang="en"><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0;background:#f5f2fa;color:#271b34;font-family:Arial,sans-serif"><main style="max-width:560px;margin:32px auto;padding:32px;background:#fff;border-radius:16px"><p style="font-size:22px;font-weight:700;color:#5730ad">VOKLANCE</p><h1 style="font-size:26px">Welcome to VOKLANCE!</h1><p>Please verify your email address to complete your account setup.</p><p style="margin:32px 0"><a href="${safeUrl}" style="display:inline-block;background:#5730ad;color:#fff;padding:14px 22px;border-radius:8px;text-decoration:none;font-weight:700">Verify Email Address</a></p><p>This verification link expires in 24 hours.</p><p>If you did not create a VOKLANCE account, you can ignore this email.</p><footer style="margin-top:32px;border-top:1px solid #e5ddec;padding-top:20px">VOKLANCE<br>Connect. Collaborate. Grow.</footer></main></body></html>`
  };
}
