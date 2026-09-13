import { useEffect, useRef, useState } from 'react'
import {
  Camera,
  CheckCircle2,
  ImagePlus,
  LoaderCircle,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  X,
} from 'lucide-react'
import { apiSend } from '../lib/api.js'
import { useQuestVerificationStatus } from '../quests/hooks.js'

const acceptedTypes = ['image/jpeg', 'image/png', 'image/webp']

function loadImage(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const image = new Image()
    image.onload = () => resolve({ image, url })
    image.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('This image could not be opened. Choose another image.'))
    }
    image.src = url
  })
}

async function prepareEvidenceImage(file) {
  if (!acceptedTypes.includes(file.type))
    throw new Error('Use a JPG, PNG, or WebP image for quest evidence.')
  if (file.size > 10 * 1024 * 1024)
    throw new Error('Choose an image smaller than 10 MB.')

  const { image, url } = await loadImage(file)
  try {
    const maxDimension = 1280
    const scale = Math.min(1, maxDimension / Math.max(image.naturalWidth, image.naturalHeight))
    const width = Math.max(1, Math.round(image.naturalWidth * scale))
    const height = Math.max(1, Math.round(image.naturalHeight * scale))
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const context = canvas.getContext('2d', { alpha: false })
    if (!context) throw new Error('Your browser could not prepare this image.')
    context.fillStyle = '#ffffff'
    context.fillRect(0, 0, width, height)
    context.drawImage(image, 0, 0, width, height)
    const dataUrl = canvas.toDataURL('image/webp', 0.78)
    const [header, data] = dataUrl.split(',')
    const mimeType = header.match(/^data:([^;]+);base64$/)?.[1]
    if (!data || !acceptedTypes.includes(mimeType) || data.length > 3_750_000)
      throw new Error('The evidence image is still too large after resizing. Choose a smaller image.')
    return { mimeType, data }
  } finally {
    URL.revokeObjectURL(url)
  }
}

function verdictCopy(result) {
  if (result?.verdict === 'VERIFIED') return 'Evidence verified'
  if (result?.verdict === 'REJECTED') return 'Evidence does not match'
  return 'Evidence is unclear'
}

export default function QuestVerification({ quest, disabled = false, onVerified }) {
  const status = useQuestVerificationStatus()
  const inputRef = useRef(null)
  const previewRef = useRef('')
  const [preview, setPreview] = useState('')
  const [file, setFile] = useState(null)
  const [result, setResult] = useState(null)
  const [error, setError] = useState('')
  const [verifying, setVerifying] = useState(false)

  useEffect(() => {
    return () => {
      if (previewRef.current) URL.revokeObjectURL(previewRef.current)
    }
  }, [])

  function clearImage() {
    if (previewRef.current) URL.revokeObjectURL(previewRef.current)
    previewRef.current = ''
    setPreview('')
    setFile(null)
    setResult(null)
    setError('')
    onVerified(null, null)
    if (inputRef.current) inputRef.current.value = ''
  }

  function selectImage(event) {
    const next = event.target.files?.[0]
    if (!next) return
    if (!acceptedTypes.includes(next.type)) {
      setError('Use a JPG, PNG, or WebP image for quest evidence.')
      event.target.value = ''
      return
    }
    if (next.size > 10 * 1024 * 1024) {
      setError('Choose an image smaller than 10 MB.')
      event.target.value = ''
      return
    }
    if (previewRef.current) URL.revokeObjectURL(previewRef.current)
    const nextPreview = URL.createObjectURL(next)
    previewRef.current = nextPreview
    setPreview(nextPreview)
    setFile(next)
    setResult(null)
    setError('')
    onVerified(null, null)
  }

  async function verify() {
    if (!file || verifying || disabled) return
    setVerifying(true)
    setError('')
    setResult(null)
    onVerified(null, null)
    try {
      const image = await prepareEvidenceImage(file)
      const data = await apiSend(
        `/api/v1/ai/quest-verification/${quest.id}`,
        { revision: quest.revision, image },
        'POST',
        // Keep the browser budget above the complete Groq -> Gemini server fallback flow.
        { timeoutMs: 40000 },
      )
      setResult(data)
      onVerified(data.verificationToken || null, data)
    } catch (verificationError) {
      setError(verificationError.message)
    } finally {
      setVerifying(false)
    }
  }

  if (status.isSuccess && !status.data.available)
    return (
      <section className="quest-verification quest-verification-unavailable" aria-label="AI quest verification">
        <div className="quest-verification-heading">
          <span className="quest-verification-icon"><Camera size={17} /></span>
          <div>
            <strong>AI evidence check</strong>
            <p>Add `GROQ_API_KEY` or `GEMINI_API_KEY` on the server to enable optional visual proof.</p>
          </div>
        </div>
      </section>
    )

  return (
    <section className="quest-verification" aria-label="AI quest verification">
      <div className="quest-verification-heading">
        <span className="quest-verification-icon"><Sparkles size={17} /></span>
        <div>
          <strong>Verify with AI</strong>
          <p>Optional. Add a photo or screenshot that shows what you completed.</p>
        </div>
        <span className="quest-verification-optional">OPTIONAL</span>
      </div>

      {!file ? (
        <label className={`quest-evidence-picker ${disabled ? 'disabled' : ''}`}>
          <input
            ref={inputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            disabled={disabled || verifying}
            onChange={selectImage}
          />
          <ImagePlus size={22} />
          <span>
            <strong>Add evidence image</strong>
            <small>JPG, PNG or WebP · up to 10 MB before resizing</small>
          </span>
        </label>
      ) : (
        <div className="quest-evidence-preview">
          <img src={preview} alt="Selected quest evidence preview" />
          <div className="quest-evidence-preview-copy">
            <strong>{file.name}</strong>
            <small>{Math.max(1, Math.round(file.size / 1024))} KB · resized before upload</small>
          </div>
          <button
            type="button"
            className="icon-button"
            aria-label="Remove evidence image"
            disabled={verifying || disabled}
            onClick={clearImage}
          >
            <X size={16} />
          </button>
        </div>
      )}

      {file && !result && (
        <button
          type="button"
          className="button button-outline quest-verify-button"
          disabled={verifying || disabled || status.isPending}
          onClick={verify}
        >
          {verifying ? <LoaderCircle className="spin" size={16} /> : <Camera size={16} />}
          {verifying ? 'AI is inspecting…' : 'Check evidence with AI'}
        </button>
      )}

      {result && (
        <div className={`quest-verification-result ${result.verdict.toLowerCase()}`} role="status">
          <div className="quest-verification-result-title">
            {result.verdict === 'VERIFIED' ? (
              <ShieldCheck size={19} />
            ) : result.verdict === 'REJECTED' ? (
              <ShieldAlert size={19} />
            ) : (
              <CheckCircle2 size={19} />
            )}
            <strong>{verdictCopy(result)}</strong>
            <span>{result.confidence}% confidence</span>
          </div>
          <p>{result.summary}</p>
          {result.evidence.length > 0 && (
            <ul>
              {result.evidence.map((item) => <li key={item}>{item}</li>)}
            </ul>
          )}
          {result.concerns.length > 0 && (
            <p className="quest-verification-concerns">{result.concerns.join(' · ')}</p>
          )}
          {result.verdict !== 'VERIFIED' && (
            <button type="button" className="text-link" onClick={clearImage}>
              Try another image
            </button>
          )}
        </div>
      )}

      {error && <p className="form-message" role="alert">{error}</p>}
      <p className="quest-verification-privacy">
        Life RPG does not store the evidence image. It is resized in your browser and sent to Gemini only for this check.
      </p>
    </section>
  )
}
