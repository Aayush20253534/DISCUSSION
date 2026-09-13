export function createTestMailer() {
  const resetLinks = new Map()
  return {
    async sendPasswordReset({ email, resetUrl }) {
      resetLinks.set(email, resetUrl)
    },
    resetUrlFor(email) {
      const resetUrl = resetLinks.get(email)
      if (!resetUrl) throw new Error(`No password reset link captured for ${email}`)
      return resetUrl
    },
  }
}
