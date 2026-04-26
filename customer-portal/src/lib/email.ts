import { Resend } from 'resend';

let _resend: Resend | null = null;
function getResend(): Resend {
  if (!_resend) _resend = new Resend(process.env.RESEND_API_KEY || 'placeholder');
  return _resend;
}
const FROM_ADDRESS = process.env.EMAIL_FROM || 'noreply@yourdomain.com';
const APP_NAME = process.env.NEXT_PUBLIC_APP_NAME || 'AI API Platform';
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

export async function sendVerificationEmail(
  to: string,
  token: string
): Promise<boolean> {
  if (!process.env.RESEND_API_KEY) {
    console.log(`[Email] RESEND_API_KEY not set. Verify URL: ${APP_URL}/verify?token=${token}`);
    return true; // Dev mode: skip sending
  }

  try {
    await getResend().emails.send({
      from: `${APP_NAME} <${FROM_ADDRESS}>`,
      to,
      subject: `Verify your email — ${APP_NAME}`,
      html: emailTemplate({
        title: 'Verify your email address',
        preheader: 'Click the button below to verify your email and activate your account.',
        body: `
          <p style="margin:0 0 24px;font-size:16px;line-height:1.6;color:#94a3b8;">
            Thanks for signing up for <strong style="color:#e2e8f0;">${APP_NAME}</strong>. 
            Please verify your email address to activate your account and start making API calls.
          </p>
        `,
        cta: { text: 'Verify Email Address', url: `${APP_URL}/verify?token=${token}` },
        footer: 'This link expires in 24 hours. If you did not create an account, ignore this email.',
      }),
    });
    return true;
  } catch (err) {
    console.error('[Email] sendVerificationEmail failed:', err);
    return false;
  }
}

export async function sendPasswordResetEmail(
  to: string,
  token: string
): Promise<boolean> {
  if (!process.env.RESEND_API_KEY) {
    console.log(`[Email] RESEND_API_KEY not set. Reset URL: ${APP_URL}/reset-password?token=${token}`);
    return true;
  }

  try {
    await getResend().emails.send({
      from: `${APP_NAME} <${FROM_ADDRESS}>`,
      to,
      subject: `Reset your password — ${APP_NAME}`,
      html: emailTemplate({
        title: 'Reset your password',
        preheader: 'We received a request to reset your password.',
        body: `
          <p style="margin:0 0 24px;font-size:16px;line-height:1.6;color:#94a3b8;">
            We received a request to reset the password for your <strong style="color:#e2e8f0;">${APP_NAME}</strong> account.
            Click the button below to choose a new password.
          </p>
          <p style="margin:0 0 24px;font-size:14px;color:#64748b;">
            If you did not request a password reset, you can safely ignore this email. 
            Your password will not change.
          </p>
        `,
        cta: { text: 'Reset Password', url: `${APP_URL}/reset-password?token=${token}` },
        footer: 'This link expires in 1 hour for your security.',
      }),
    });
    return true;
  } catch (err) {
    console.error('[Email] sendPasswordResetEmail failed:', err);
    return false;
  }
}

export async function sendWelcomeEmail(to: string, name?: string): Promise<void> {
  if (!process.env.RESEND_API_KEY) return;

  try {
    await getResend().emails.send({
      from: `${APP_NAME} <${FROM_ADDRESS}>`,
      to,
      subject: `Welcome to ${APP_NAME} — Here's how to get started`,
      html: emailTemplate({
        title: `Welcome${name ? `, ${name}` : ''}! 🚀`,
        preheader: `Your account is ready. Here's how to get your first API key.`,
        body: `
          <p style="margin:0 0 16px;font-size:16px;line-height:1.6;color:#94a3b8;">
            Your <strong style="color:#e2e8f0;">${APP_NAME}</strong> account is active and ready. 
            You're on the <strong style="color:#818cf8;">Free plan</strong> — 50 requests/month total, 
            no credit card required.
          </p>
          <p style="margin:0 0 8px;font-size:15px;font-weight:600;color:#e2e8f0;">To get started:</p>
          <ol style="margin:0 0 24px;padding-left:20px;color:#94a3b8;font-size:15px;line-height:2;">
            <li>Go to your dashboard and create an API key</li>
            <li>Point your OpenAI SDK to our endpoint</li>
            <li>Start making requests to any supported model</li>
          </ol>
        `,
        cta: { text: 'Go to Dashboard', url: `${APP_URL}/dashboard` },
        footer: 'You received this because you signed up. Questions? Reply to this email.',
      }),
    });
  } catch (err) {
    console.error('[Email] sendWelcomeEmail failed:', err);
  }
}

// ── HTML Email Template ──────────────────────────────────────────────────────

interface EmailTemplateOptions {
  title: string;
  preheader: string;
  body: string;
  cta: { text: string; url: string };
  footer: string;
}

function emailTemplate({ title, preheader, body, cta, footer }: EmailTemplateOptions): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title}</title>
</head>
<body style="margin:0;padding:0;background:#0a0a0f;font-family:'Inter',system-ui,-apple-system,sans-serif;">
<span style="display:none;max-height:0;overflow:hidden;">${preheader}</span>
<table width="100%" cellpadding="0" cellspacing="0" style="background:#0a0a0f;padding:40px 20px;">
  <tr><td align="center">
    <table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;">
      <!-- Logo -->
      <tr><td style="padding-bottom:32px;text-align:center;">
        <div style="display:inline-flex;align-items:center;gap:10px;">
          <div style="width:36px;height:36px;border-radius:10px;background:linear-gradient(135deg,#6366f1,#8b5cf6);display:inline-flex;align-items:center;justify-content:center;">
            <span style="color:white;font-size:18px;">◆</span>
          </div>
          <span style="font-size:18px;font-weight:700;color:#e2e8f0;">${APP_NAME}</span>
        </div>
      </td></tr>
      <!-- Card -->
      <tr><td style="background:linear-gradient(135deg,rgba(26,26,46,0.95),rgba(18,18,26,0.98));border:1px solid #2a2a40;border-radius:16px;padding:40px;">
        <h1 style="margin:0 0 24px;font-size:24px;font-weight:700;color:#e2e8f0;line-height:1.3;">${title}</h1>
        ${body}
        <div style="text-align:center;margin:8px 0 32px;">
          <a href="${cta.url}" style="display:inline-block;background:linear-gradient(135deg,#6366f1,#8b5cf6);color:white;font-weight:600;font-size:15px;padding:14px 32px;border-radius:10px;text-decoration:none;">
            ${cta.text}
          </a>
        </div>
        <p style="margin:0;font-size:13px;color:#64748b;line-height:1.6;">${footer}</p>
      </td></tr>
      <!-- Footer -->
      <tr><td style="padding-top:24px;text-align:center;">
        <p style="margin:0;font-size:12px;color:#475569;">
          © ${new Date().getFullYear()} ${APP_NAME} · 
          <a href="${APP_URL}/privacy" style="color:#6366f1;text-decoration:none;">Privacy</a> · 
          <a href="${APP_URL}/terms" style="color:#6366f1;text-decoration:none;">Terms</a>
        </p>
      </td></tr>
    </table>
  </td></tr>
</table>
</body>
</html>`;
}
