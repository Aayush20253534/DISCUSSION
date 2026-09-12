import { useState } from 'react'
import { Eye, EyeOff } from 'lucide-react'

export default function FormField({ name, label, icon, error, hint, type = 'text', ...props }) {
  const [visible, setVisible] = useState(false)
  const password = type === 'password'
  return (
    <div className="form-field">
      <label htmlFor={name}>
        <span className="form-label-content">
          {icon && <span className="form-label-icon">{icon}</span>}
          <span>{label}</span>
        </span>
      </label>
      <div className="field-input-wrap">
        <input
          id={name}
          name={name}
          type={password && visible ? 'text' : type}
          aria-invalid={Boolean(error)}
          aria-describedby={
            [error && `${name}-error`, hint && `${name}-hint`].filter(Boolean).join(' ') ||
            undefined
          }
          {...props}
        />
        {password && (
          <button
            type="button"
            className="password-toggle"
            aria-label={visible ? 'Hide password' : 'Show password'}
            aria-pressed={visible}
            onClick={() => setVisible(!visible)}
          >
            {visible ? <EyeOff size={18} /> : <Eye size={18} />}
          </button>
        )}
      </div>
      {hint && (
        <p className="field-hint" id={`${name}-hint`}>
          {hint}
        </p>
      )}
      {error && (
        <p className="field-error" id={`${name}-error`}>
          {error}
        </p>
      )}
    </div>
  )
}
