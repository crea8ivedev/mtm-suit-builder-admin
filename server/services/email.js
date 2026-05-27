import nodemailer from 'nodemailer'
import { config } from '../config.js'

let _transporter = null

function getTransporter() {
  if (_transporter) return _transporter
  _transporter = nodemailer.createTransport({
    host: config.email.host,
    port: config.email.port,
    secure: config.email.secure,
    auth: {
      user: config.email.user,
      pass: config.email.pass,
    },
  })
  return _transporter
}

export async function sendOtpEmail(toEmail, otp) {
  // Dev fallback: log OTP if email not configured
  if (!config.email.user || !config.email.pass) {
    console.log(`[email] OTP for ${toEmail}: ${otp}  (email not configured — check console)`)
    return
  }

  const html = `
    <div style="font-family:Arial,sans-serif;max-width:480px;margin:0 auto;padding:32px;background:#ffffff;">
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:28px;">
        <div style="width:36px;height:36px;background:#2563eb;border-radius:8px;display:flex;align-items:center;justify-content:center;">
          <span style="color:#fff;font-size:18px;">✂</span>
        </div>
        <span style="font-size:18px;font-weight:700;color:#0f172a;">SuitAdmin</span>
      </div>
      <h2 style="color:#0f172a;font-size:22px;font-weight:700;margin:0 0 8px;">Your login code</h2>
      <p style="color:#475569;font-size:15px;margin:0 0 28px;">
        Use this one-time code to sign in to SuitAdmin. It expires in <strong>10 minutes</strong>.
      </p>
      <div style="background:#f8fafc;border:2px solid #e2e8f0;border-radius:12px;padding:24px;text-align:center;margin-bottom:28px;">
        <p style="color:#2563eb;font-size:42px;font-weight:800;letter-spacing:10px;margin:0;font-family:monospace;">${otp}</p>
      </div>
      <p style="color:#94a3b8;font-size:13px;margin:0;">
        If you did not request this code, you can safely ignore this email.
      </p>
    </div>
  `

  await getTransporter().sendMail({
    from: config.email.from,
    to: toEmail,
    subject: `${otp} — SuitAdmin login code`,
    html,
  })
}
