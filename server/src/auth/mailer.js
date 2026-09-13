import { AppError } from '../lib/errors.js'

const MAILJET_SEND_URL = 'https://api.mailjet.com/v3.1/send'

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;')
}

function configured(config) {
  return Boolean(
    config.MAILJET_API_KEY &&
      config.MAILJET_SECRET_KEY &&
      config.MAILJET_FROM_EMAIL &&
      config.MAILJET_FROM_NAME,
  )
}

export function createMailjetMailer(config) {
  return {
    async sendEmailVerification({ email, displayName, otp, expiresInMinutes }) {
      if (!configured(config)) {
        throw new AppError(
          503,
          'EMAIL_NOT_CONFIGURED',
          'Email verification is temporarily unavailable. Please try again later.',
        )
      }

      const safeName = escapeHtml(displayName)
      const safeOtp = escapeHtml(otp)
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 10000)
      let response
      try {
        response = await fetch(MAILJET_SEND_URL, {
          method: 'POST',
          signal: controller.signal,
          headers: {
            Authorization: `Basic ${Buffer.from(`${config.MAILJET_API_KEY}:${config.MAILJET_SECRET_KEY}`).toString('base64')}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            Messages: [
              {
                From: { Email: config.MAILJET_FROM_EMAIL, Name: config.MAILJET_FROM_NAME },
                To: [{ Email: email, Name: displayName }],
                Subject: 'Your Life RPG verification code',
                TextPart: `Hi ${displayName},\n\nYour Life RPG verification code is ${otp}. It expires in ${expiresInMinutes} minutes.\n\nIf you did not create this account, you can ignore this email.`,
                HTMLPart: `<!doctype html><html><body style="margin:0;background:#07131a;color:#f4eddf;font-family:Arial,sans-serif"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="padding:32px 16px;background:#07131a"><tr><td align="center"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;border:1px solid #b98d43;background:#0b1d25"><tr><td style="padding:36px;text-align:center"><div style="color:#ddb86a;font-size:12px;letter-spacing:3px">LIFE RPG · THE ADVENTURER'S ATLAS</div><h1 style="margin:18px 0 8px;color:#fff8e9;font-family:Georgia,serif;font-size:30px">Verify your email</h1><p style="margin:0 0 24px;color:#bdc7c7;line-height:1.6">Hi ${safeName}, enter this code to begin your adventure.</p><div style="display:inline-block;padding:16px 24px;border:1px solid #e6bd70;background:#102832;color:#f3d38d;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:32px;font-weight:700;letter-spacing:8px">${safeOtp}</div><p style="margin:24px 0 0;color:#93a1a3;font-size:13px;line-height:1.6">This code expires in ${expiresInMinutes} minutes. If you did not create this account, ignore this message.</p></td></tr></table></td></tr></table></body></html>`,
                CustomID: 'life-rpg-email-verification',
              },
            ],
          }),
        })
      } catch (error) {
        if (error?.name === 'AbortError') {
          throw new AppError(
            503,
            'EMAIL_TIMEOUT',
            'Verification email delivery timed out. Please try again.',
          )
        }
        throw new AppError(
          503,
          'EMAIL_UNAVAILABLE',
          'Verification email could not be sent. Please try again.',
        )
      } finally {
        clearTimeout(timeout)
      }

      let result
      try {
        result = await response.json()
      } catch {
        result = null
      }
      const rejectedMessage = result?.Messages?.some((message) => message.Status !== 'success')
      if (!response.ok || rejectedMessage) {
        throw new AppError(
          503,
          'EMAIL_UNAVAILABLE',
          'Verification email could not be sent. Please try again.',
        )
      }
    },
  }
}
