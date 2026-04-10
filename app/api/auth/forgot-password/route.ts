export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { apiSuccess, apiError, sanitizeString } from '@/lib/utils';
import { buildAppUrl } from '@/lib/app-url';
import { createServerClient } from '@/lib/supabase/server';
import crypto from 'crypto';
import nodemailer from 'nodemailer';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const email = sanitizeString(body.email || '').toLowerCase();
    if (!email || !email.includes('@')) return apiError('Invalid email address', 400);

    const db = createServerClient();

    // Look up user — always respond success to prevent email enumeration
    const { data: user } = await db
      .from('users')
      .select('id, name, email, active')
      .eq('email', email)
      .single();

    if (!user || !user.active) {
      // Still respond success so attackers can't enumerate valid emails
      return apiSuccess({ message: 'If that email exists, a reset link has been sent.' });
    }

    // Invalidate any existing unused tokens for this user
    await db
      .from('password_reset_tokens')
      .update({ used_at: new Date().toISOString() })
      .eq('user_id', user.id)
      .is('used_at', null);

    // Create new token (1 hour expiry)
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();

    const { error: insertErr } = await db
      .from('password_reset_tokens')
      .insert({ user_id: user.id, token, expires_at: expiresAt });

    if (insertErr) {
      console.error('reset token insert error:', insertErr);
      return apiError('Failed to create reset token', 500);
    }

    // Fetch SMTP settings
    const { data: settings } = await db
      .from('app_settings')
      .select('key, value')
      .in('key', ['smtp_host', 'smtp_port', 'smtp_secure', 'smtp_user', 'smtp_password', 'smtp_from_name', 'smtp_from_email', 'app_name']);

    const s: Record<string, string> = {};
    (settings || []).forEach((row) => { s[row.key] = row.value; });

    const appName = s.app_name || 'Visitor Pass';
    const resetUrl = buildAppUrl(`/reset-password/${token}`, request.nextUrl.origin);

    // Send email if SMTP is configured
    if (s.smtp_host && s.smtp_user && s.smtp_password) {
      try {
        const transporter = nodemailer.createTransport({
          host: s.smtp_host,
          port: parseInt(s.smtp_port || '587', 10),
          secure: s.smtp_secure === 'ssl',
          auth: { user: s.smtp_user, pass: s.smtp_password },
        });

        await transporter.sendMail({
          from: `"${s.smtp_from_name || appName}" <${s.smtp_from_email || s.smtp_user}>`,
          to: user.email,
          subject: `Reset your password — ${appName}`,
          html: `
            <div style="font-family:system-ui,sans-serif;max-width:480px;margin:0 auto;padding:32px 24px;background:#ffffff">
              <div style="text-align:center;margin-bottom:32px">
                <div style="display:inline-flex;align-items:center;justify-content:center;width:52px;height:52px;border-radius:14px;background:linear-gradient(135deg,#4f46e5,#7c3aed)">
                  <span style="font-size:22px">🔑</span>
                </div>
              </div>
              <h2 style="font-size:22px;font-weight:700;color:#0f172a;margin:0 0 8px">Reset your password</h2>
              <p style="font-size:14px;color:#64748b;margin:0 0 24px;line-height:1.6">
                Hi ${user.name}, we received a request to reset the password for your ${appName} account.
                Click the button below to choose a new password.
              </p>
              <a href="${resetUrl}"
                style="display:inline-block;background:#4f46e5;color:#ffffff;font-size:14px;font-weight:600;padding:12px 28px;border-radius:10px;text-decoration:none;margin-bottom:24px">
                Reset Password
              </a>
              <p style="font-size:12px;color:#94a3b8;margin:0 0 4px">This link expires in 1 hour.</p>
              <p style="font-size:12px;color:#94a3b8;margin:0">If you didn't request this, you can safely ignore this email.</p>
              <hr style="border:none;border-top:1px solid #e2e8f0;margin:24px 0">
              <p style="font-size:11px;color:#cbd5e1;text-align:center;margin:0">${appName}</p>
            </div>
          `,
        });
      } catch (mailErr) {
        console.error('reset email send error:', mailErr);
        // Don't expose email errors to client
      }
    } else {
      // No SMTP — log the reset URL for development
      console.log(`[DEV] Password reset URL for ${email}: ${resetUrl}`);
    }

    return apiSuccess({ message: 'If that email exists, a reset link has been sent.' });
  } catch (err) {
    console.error('forgot-password error:', err);
    return apiError('Internal server error', 500);
  }
}
