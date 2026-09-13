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

function firstMailjetError(result) {
  const failedMessage = result?.Messages?.find((message) => message?.Status !== 'success')
  const nested = failedMessage?.Errors?.[0]
  const error = nested || result
  if (!error || typeof error !== 'object') return null

  return {
    statusCode: Number(error.StatusCode) || undefined,
    code: typeof error.ErrorCode === 'string' ? error.ErrorCode : undefined,
    identifier:
      typeof error.ErrorIdentifier === 'string' ? error.ErrorIdentifier.slice(0, 100) : undefined,
    message: typeof error.ErrorMessage === 'string' ? error.ErrorMessage.slice(0, 300) : undefined,
    relatedTo: Array.isArray(error.ErrorRelatedTo)
      ? error.ErrorRelatedTo.filter((value) => typeof value === 'string').slice(0, 8)
      : undefined,
  }
}

function deliveryError(httpStatus, providerError) {
  const status = providerError?.statusCode || httpStatus
  const code = providerError?.code

  if (status === 401) {
    return new AppError(
      503,
      'EMAIL_UNAVAILABLE',
      'Email verification is temporarily unavailable. The mail service rejected its credentials.',
    )
  }
  if (status === 403 && code === 'send-0008') {
    return new AppError(
      503,
      'EMAIL_UNAVAILABLE',
      'Email verification is temporarily unavailable. The configured sender is not authorized.',
    )
  }
  if (status === 403) {
    return new AppError(
      503,
      'EMAIL_UNAVAILABLE',
      'Email verification is temporarily unavailable. The mail service rejected this sender.',
    )
  }
  if (status === 429) {
    return new AppError(
      503,
      'EMAIL_UNAVAILABLE',
      'Email verification is temporarily busy. Please try again shortly.',
    )
  }
  return new AppError(
    503,
    'EMAIL_UNAVAILABLE',
    'Verification email could not be sent. Please try again.',
  )
}

function passwordResetDeliveryError(httpStatus, providerError) {
  const status = providerError?.statusCode || httpStatus
  const code = providerError?.code
  if (status === 401) {
    return new AppError(
      503,
      'EMAIL_UNAVAILABLE',
      'Password recovery is temporarily unavailable. The mail service rejected its credentials.',
    )
  }
  if (status === 403 && code === 'send-0008') {
    return new AppError(
      503,
      'EMAIL_UNAVAILABLE',
      'Password recovery is temporarily unavailable. The configured sender is not authorized.',
    )
  }
  if (status === 403) {
    return new AppError(
      503,
      'EMAIL_UNAVAILABLE',
      'Password recovery is temporarily unavailable. The mail service rejected this sender.',
    )
  }
  if (status === 429) {
    return new AppError(
      503,
      'EMAIL_UNAVAILABLE',
      'Password recovery is temporarily busy. Please try again shortly.',
    )
  }
  return new AppError(
    503,
    'EMAIL_UNAVAILABLE',
    'Password reset email could not be sent. Please try again.',
  )
}

export function createMailjetMailer(config, { logger = () => {} } = {}) {
  return {
    async sendEmailVerification({ email, displayName, otp, expiresInMinutes, requestId }) {
      if (!configured(config)) {
        logger('error', 'email.configuration_missing', {
          requestId,
          provider: 'mailjet',
          hasApiKey: Boolean(config.MAILJET_API_KEY),
          hasSecretKey: Boolean(config.MAILJET_SECRET_KEY),
          hasFromEmail: Boolean(config.MAILJET_FROM_EMAIL),
          hasFromName: Boolean(config.MAILJET_FROM_NAME),
        })
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
        const timedOut = error?.name === 'AbortError'
        logger('error', 'email.delivery_failed', {
          requestId,
          provider: 'mailjet',
          failure: timedOut ? 'timeout' : 'network',
          errorName: error?.name,
          errorCode: error?.code,
        })
        if (timedOut) {
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
      const providerError = firstMailjetError(result)
      const rejectedMessage = result?.Messages?.some((message) => message?.Status !== 'success')
      if (!response.ok || rejectedMessage) {
        logger('error', 'email.provider_rejected', {
          requestId,
          provider: 'mailjet',
          httpStatus: response.status,
          providerStatus: providerError?.statusCode,
          providerCode: providerError?.code,
          providerIdentifier: providerError?.identifier,
          providerMessage: providerError?.message,
          relatedTo: providerError?.relatedTo,
        })
        throw deliveryError(response.status, providerError)
      }
    },
    async sendPasswordReset({ email, displayName, resetUrl, expiresInMinutes, requestId }) {
      if (!configured(config)) {
        logger('error', 'email.configuration_missing', {
          requestId,
          provider: 'mailjet',
          purpose: 'password-reset',
          hasApiKey: Boolean(config.MAILJET_API_KEY),
          hasSecretKey: Boolean(config.MAILJET_SECRET_KEY),
          hasFromEmail: Boolean(config.MAILJET_FROM_EMAIL),
          hasFromName: Boolean(config.MAILJET_FROM_NAME),
        })
        throw new AppError(
          503,
          'EMAIL_NOT_CONFIGURED',
          'Password recovery is temporarily unavailable. Please try again later.',
        )
      }

      const safeName = escapeHtml(displayName)
      const safeUrl = escapeHtml(resetUrl)
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
                Subject: 'Reset your Life RPG password',
                TextPart: `Hi ${displayName},\n\nUse this link to choose a new Life RPG password: ${resetUrl}\n\nThe link expires in ${expiresInMinutes} minutes and can be used once. If you did not request this, you can ignore this email.`,
                HTMLPart: `<!doctype html><html><body style="margin:0;background:#07131a;color:#f4eddf;font-family:Arial,sans-serif"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="padding:32px 16px;background:#07131a"><tr><td align="center"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;border:1px solid #b98d43;background:#0b1d25"><tr><td style="padding:36px;text-align:center"><div style="color:#ddb86a;font-size:12px;letter-spacing:3px">LIFE RPG · THE ADVENTURER'S ATLAS</div><h1 style="margin:18px 0 8px;color:#fff8e9;font-family:Georgia,serif;font-size:30px">Recover your path</h1><p style="margin:0 0 24px;color:#bdc7c7;line-height:1.6">Hi ${safeName}, a password reset was requested for your Life RPG account.</p><a href="${safeUrl}" style="display:inline-block;padding:14px 22px;border:1px solid #e6bd70;background:#dcb86e;color:#07131a;text-decoration:none;font-weight:700">Choose a new password</a><p style="margin:24px 0 0;color:#93a1a3;font-size:13px;line-height:1.6">This link expires in ${expiresInMinutes} minutes and works once. If you did not request it, ignore this message.</p></td></tr></table></td></tr></table></body></html>`,
                CustomID: 'life-rpg-password-reset',
              },
            ],
          }),
        })
      } catch (error) {
        const timedOut = error?.name === 'AbortError'
        logger('error', 'email.delivery_failed', {
          requestId,
          provider: 'mailjet',
          purpose: 'password-reset',
          failure: timedOut ? 'timeout' : 'network',
          errorName: error?.name,
          errorCode: error?.code,
        })
        if (timedOut) {
          throw new AppError(
            503,
            'EMAIL_TIMEOUT',
            'Password reset email delivery timed out. Please try again.',
          )
        }
        throw new AppError(
          503,
          'EMAIL_UNAVAILABLE',
          'Password reset email could not be sent. Please try again.',
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
      const providerError = firstMailjetError(result)
      const rejectedMessage = result?.Messages?.some((message) => message?.Status !== 'success')
      if (!response.ok || rejectedMessage) {
        logger('error', 'email.provider_rejected', {
          requestId,
          provider: 'mailjet',
          purpose: 'password-reset',
          httpStatus: response.status,
          providerStatus: providerError?.statusCode,
          providerCode: providerError?.code,
          providerIdentifier: providerError?.identifier,
          providerMessage: providerError?.message,
          relatedTo: providerError?.relatedTo,
        })
        throw passwordResetDeliveryError(response.status, providerError)
      }
    },
  }
}
