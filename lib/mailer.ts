import nodemailer from 'nodemailer';
import { createServerClient } from '@/lib/supabase/server';

// ─── Load SMTP config from app_settings ──────────────────────

async function getSmtpConfig() {
  const db = createServerClient();
  const { data } = await db
    .from('app_settings')
    .select('key, value')
    .in('key', [
      'smtp_host', 'smtp_port', 'smtp_secure',
      'smtp_user', 'smtp_password',
      'smtp_from_name', 'smtp_from_email',
      'app_name', 'app_logo_url',
    ]);

  const s: Record<string, string> = {};
  (data || []).forEach((row) => { s[row.key] = row.value; });
  return s;
}

function makeTransporter(s: Record<string, string>) {
  if (!s.smtp_host || !s.smtp_user || !s.smtp_password) return null;
  return nodemailer.createTransport({
    host: s.smtp_host,
    port: parseInt(s.smtp_port || '587', 10),
    secure: s.smtp_secure === 'ssl',
    auth: { user: s.smtp_user, pass: s.smtp_password },
  });
}

// ─── Shared HTML wrapper ──────────────────────────────────────

function htmlWrapper(appName: string, logoUrl: string, content: string) {
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${appName}</title></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:system-ui,-apple-system,sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:40px 16px">
    <tr><td align="center">
      <table width="100%" style="max-width:520px;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,.08)">

        <!-- Header -->
        <tr>
          <td style="background:linear-gradient(135deg,#4f46e5 0%,#7c3aed 100%);padding:28px 32px;text-align:center">
            ${logoUrl
              ? `<img src="${logoUrl}" alt="${appName}" style="height:40px;max-width:160px;object-fit:contain;margin-bottom:12px;display:block;margin-left:auto;margin-right:auto">`
              : `<div style="display:inline-flex;align-items:center;justify-content:center;width:44px;height:44px;border-radius:12px;background:rgba(255,255,255,.15);margin-bottom:12px">
                  <span style="font-size:20px">🪪</span>
                </div>`
            }
            <p style="margin:0;font-size:18px;font-weight:700;color:#ffffff">${appName}</p>
          </td>
        </tr>

        <!-- Body -->
        <tr>
          <td style="padding:32px">
            ${content}
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="padding:20px 32px;border-top:1px solid #e2e8f0;text-align:center">
            <p style="margin:0;font-size:11px;color:#94a3b8">${appName} · This is an automated message, please do not reply.</p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

// ─── Welcome email ────────────────────────────────────────────

export interface WelcomeEmailOptions {
  to: string;
  name: string;
  email: string;
  password: string;
  role: 'admin' | 'manager' | 'gate_staff';
  designation?: string | null;
}

const ROLE_LABEL: Record<string, string> = {
  admin: 'Administrator',
  manager: 'Manager',
  gate_staff: 'Gate Staff',
};

const ROLE_COLOR: Record<string, string> = {
  admin: '#7c3aed',
  manager: '#d97706',
  gate_staff: '#2563eb',
};

const PORTAL_PATH: Record<string, string> = {
  admin: '/admin',
  manager: '/manager/dashboard',
  gate_staff: '/staff/dashboard',
};

export async function sendWelcomeEmail(opts: WelcomeEmailOptions): Promise<void> {
  const s = await getSmtpConfig();
  const transporter = makeTransporter(s);

  const appName = s.app_name || 'Visitor Pass';
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  const loginUrl = `${appUrl}/login`;
  const roleName = ROLE_LABEL[opts.role] || opts.role;
  const roleColor = ROLE_COLOR[opts.role] || '#4f46e5';

  if (!transporter) {
    // Dev fallback — log credentials to server console
    console.log(`
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
[DEV] Welcome email not sent (SMTP not configured)
Name:     ${opts.name}
Email:    ${opts.email}
Password: ${opts.password}
Role:     ${roleName}
Login:    ${loginUrl}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    return;
  }

  const content = `
    <h2 style="margin:0 0 6px;font-size:20px;font-weight:700;color:#0f172a">Welcome to ${appName}! 👋</h2>
    <p style="margin:0 0 24px;font-size:14px;color:#64748b;line-height:1.6">
      Hi ${opts.name}, your account has been created. Here are your login credentials.
    </p>

    <!-- Role badge -->
    <div style="margin-bottom:24px">
      <span style="display:inline-block;background:${roleColor}1a;color:${roleColor};font-size:12px;font-weight:600;padding:4px 12px;border-radius:100px;border:1px solid ${roleColor}33">
        ${roleName}${opts.designation ? ` · ${opts.designation}` : ''}
      </span>
    </div>

    <!-- Credentials box -->
    <table width="100%" cellpadding="0" cellspacing="0"
      style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;margin-bottom:28px">
      <tr>
        <td style="padding:20px 24px">
          <table width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <td style="padding:8px 0;border-bottom:1px solid #e2e8f0">
                <p style="margin:0;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.06em;color:#94a3b8">Login URL</p>
                <a href="${loginUrl}" style="font-size:14px;color:#4f46e5;text-decoration:none;font-weight:500">${loginUrl}</a>
              </td>
            </tr>
            <tr>
              <td style="padding:8px 0;border-bottom:1px solid #e2e8f0">
                <p style="margin:0;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.06em;color:#94a3b8">Email</p>
                <p style="margin:0;font-size:14px;color:#0f172a;font-weight:500">${opts.email}</p>
              </td>
            </tr>
            <tr>
              <td style="padding:8px 0">
                <p style="margin:0;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.06em;color:#94a3b8">Password</p>
                <p style="margin:0;font-size:15px;color:#0f172a;font-weight:700;font-family:monospace;letter-spacing:.05em">${opts.password}</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>

    <!-- CTA -->
    <div style="text-align:center;margin-bottom:28px">
      <a href="${loginUrl}"
        style="display:inline-block;background:#4f46e5;color:#ffffff;font-size:14px;font-weight:600;padding:12px 32px;border-radius:10px;text-decoration:none">
        Sign in to ${appName} →
      </a>
    </div>

    <!-- Security note -->
    <div style="background:#fff7ed;border:1px solid #fed7aa;border-radius:10px;padding:14px 16px">
      <p style="margin:0;font-size:12px;color:#92400e;line-height:1.6">
        <strong>⚠️ Important:</strong> Please change your password after signing in for the first time.
        Go to <strong>My Profile → Change Password</strong>.
      </p>
    </div>`;

  await transporter.sendMail({
    from: `"${s.smtp_from_name || appName}" <${s.smtp_from_email || s.smtp_user}>`,
    to: opts.to,
    subject: `Your ${appName} account is ready — Welcome, ${opts.name}!`,
    html: htmlWrapper(appName, s.app_logo_url || '', content),
  });
}
