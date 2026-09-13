import '../src/config/load-env.js'

const SEND_URL = 'https://api.mailjet.com/v3.1/send'

const apiKey = process.env.MAILJET_API_KEY || process.env.MJ_APIKEY_PUBLIC
const secretKey = process.env.MAILJET_SECRET_KEY || process.env.MJ_APIKEY_PRIVATE
const fromEmail = process.env.MAILJET_FROM_EMAIL
const fromName = process.env.MAILJET_FROM_NAME || 'Life RPG'

function fail(message) {
  console.error(`[email:check] ${message}`)
  process.exitCode = 1
}

if (!apiKey || !secretKey || !fromEmail) {
  fail('Missing MAILJET_API_KEY/MAILJET_SECRET_KEY/MAILJET_FROM_EMAIL.')
} else {
  try {
    const response = await fetch(SEND_URL, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${Buffer.from(`${apiKey}:${secretKey}`).toString('base64')}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        SandboxMode: true,
        Messages: [
          {
            From: { Email: fromEmail, Name: fromName },
            To: [{ Email: fromEmail, Name: fromName }],
            Subject: 'Life RPG email configuration check',
            TextPart: 'Mailjet sandbox validation for Life RPG.',
            CustomID: 'life-rpg-email-config-check',
          },
        ],
      }),
    })

    let body = null
    try {
      body = await response.json()
    } catch {
      // A non-JSON provider response is still reported by HTTP status below.
    }

    const failedMessage = body?.Messages?.find((message) => message?.Status !== 'success')
    const detail = failedMessage?.Errors?.[0] || body
    const rejected = !response.ok || Boolean(failedMessage)

    if (rejected) {
      console.error(`[email:check] Mailjet rejected the sandbox request (HTTP ${response.status}).`)
      if (detail?.ErrorCode) console.error(`[email:check] code: ${detail.ErrorCode}`)
      if (detail?.ErrorMessage) console.error(`[email:check] message: ${detail.ErrorMessage}`)
      if (detail?.ErrorRelatedTo)
        console.error(`[email:check] relatedTo: ${JSON.stringify(detail.ErrorRelatedTo)}`)
      process.exitCode = 1
    } else {
      console.log('[email:check] Mailjet credentials and sender were accepted in SandboxMode.')
      console.log('[email:check] No email was delivered by this check.')
    }
  } catch (error) {
    fail(`Could not reach Mailjet (${error?.name || 'network error'}).`)
  }
}
