export class AppError extends Error {
  constructor(status, code, message, fields) {
    super(message)
    this.status = status
    this.code = code
    this.fields = fields
  }
}

export function validate(schema, body) {
  const result = schema.safeParse(body)
  if (result.success) return result.data
  const fields = {}
  for (const issue of result.error.issues) {
    const field = issue.path[0]
    if (field && !fields[field]) fields[field] = issue.message
  }
  throw new AppError(422, 'VALIDATION_ERROR', 'Please check the highlighted fields.', fields)
}
