export function createTestMailer() {
  const codes = new Map()
  return {
    async sendEmailVerification({ email, otp }) {
      codes.set(email, otp)
    },
    codeFor(email) {
      const code = codes.get(email)
      if (!code) throw new Error(`No verification code captured for ${email}`)
      return code
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
