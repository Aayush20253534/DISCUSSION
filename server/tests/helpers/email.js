export function createTestMailer() {
  const codes = new Map()
  const resetLinks = new Map()
  return {
    async sendEmailVerification({ email, otp }) {
      codes.set(email, otp)
    },
    async sendPasswordReset({ email, resetUrl }) {
      resetLinks.set(email, resetUrl)
    },
    codeFor(email) {
      const code = codes.get(email)
      if (!code) throw new Error(`No verification code captured for ${email}`)
      return code
    },
    resetUrlFor(email) {
      const resetUrl = resetLinks.get(email)
      if (!resetUrl) throw new Error(`No password reset link captured for ${email}`)
      return resetUrl
    },
  }
}

export async function completeEmailVerification(client, mutate, signupResponse, mailer) {
  const verification = signupResponse.body.data.verification
  return mutate(client, 'post', '/auth/verify-email', {
    verificationId: verification.id,
    otp: mailer.codeFor(verification.email),
  }).expect(201)
}
