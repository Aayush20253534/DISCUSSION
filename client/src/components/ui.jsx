import * as Dialog from '@radix-ui/react-dialog'
import { motion } from 'motion/react'
import { ArrowRight, BookOpen, Brain, Dumbbell, Flame, Heart, Palette, X } from 'lucide-react'
import { Link } from 'react-router-dom'
import { ATTRIBUTES } from '@life-rpg/shared'
import { useInteractionFeedback } from '../interactions/interaction-context.js'

const attributeIcons = {
  INTELLECT: Brain,
  STRENGTH: Dumbbell,
  DISCIPLINE: Flame,
  CREATIVITY: Palette,
  VITALITY: Heart,
}

export function AttributeIcon({ attribute, size = 19, ...props }) {
  const Icon = attributeIcons[attribute] || BookOpen
  return <Icon size={size} aria-hidden="true" {...props} />
}

export function AttributeTag({ attribute }) {
  return (
    <span className={`attribute-tag ${attribute.toLowerCase()}`}>
      <AttributeIcon attribute={attribute} size={13} />
      {ATTRIBUTES.find(({ key }) => key === attribute)?.name}
    </span>
  )
}

export function Modal({ open, onOpenChange, title, description, children, returnFocusRef, returnFocusSelector, className = '' }) {
  const { moving } = useInteractionFeedback()
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay asChild>
          <motion.div
            className="dialog-overlay"
            initial={moving ? { opacity: 0 } : false}
            animate={{ opacity: 1 }}
            transition={{ duration: moving ? 0.16 : 0 }}
          />
        </Dialog.Overlay>
        <Dialog.Content asChild>
          <motion.div
            className={`dialog-content ${className}`.trim()}
            initial={moving ? { opacity: 0, marginTop: 14 } : false}
            animate={{ opacity: 1, marginTop: 0 }}
            transition={
              moving
                ? { type: 'spring', stiffness: 330, damping: 29, mass: 0.7 }
                : { duration: 0 }
            }
            onCloseAutoFocus={(event) => {
              const referenced = returnFocusRef?.current
              const fallback = returnFocusSelector ? document.querySelector(returnFocusSelector) : null
              const target = referenced?.isConnected ? referenced : fallback
              if (!target) return
              event.preventDefault()
              target.focus()
            }}
          >
            <Dialog.Close className="icon-button dialog-close" aria-label="Close dialog">
              <X size={20} />
            </Dialog.Close>
            <span className="eyebrow">THE ADVENTURE JOURNAL</span>
            <Dialog.Title className="dialog-title">{title}</Dialog.Title>
            <Dialog.Description className="dialog-description">{description}</Dialog.Description>
            {children}
          </motion.div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

export function PageHeading({ eyebrow, title, description, children }) {
  return (
    <div className="page-heading">
      <div>
        <p className="eyebrow">{eyebrow}</p>
        <h1>{title}</h1>
        <p className="page-description">{description}</p>
      </div>
      {children}
    </div>
  )
}

export function PreviewNotice() {
  return (
    <div className="preview-notice">
      <span className="preview-dot" />
      <p>
        <strong>A glimpse of your adventure.</strong> You’re exploring sample progress. Personal
        accounts are now open.
      </p>
      <span className="preview-label">WORLD PREVIEW</span>
    </div>
  )
}

export function SectionLink({ to, children }) {
  return (
    <Link className="text-link" to={to}>
      {children}
      <ArrowRight size={15} aria-hidden="true" />
    </Link>
  )
}

export function PageSkeleton() {
  return (
    <div className="page-skeleton" role="status" aria-label="Loading page">
      <span className="sr-only">Loading page…</span>
      <div className="skeleton skeleton-heading" />
      <div className="skeleton skeleton-hero" />
      <div className="skeleton skeleton-body" />
    </div>
  )
}
