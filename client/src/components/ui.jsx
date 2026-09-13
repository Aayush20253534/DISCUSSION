import * as Dialog from '@radix-ui/react-dialog'
import { motion } from 'motion/react'
import {
  ArrowRight,
  BookOpen,
  Brain,
  Dumbbell,
  Flame,
  Heart,
  Palette,
  X,
} from 'lucide-react'
import { Link } from 'react-router-dom'
import { ATTRIBUTES } from '@atlasborn/shared'

import { useInteractionFeedback } from '../interactions/interaction-context.js'

const attributeIcons = {
  INTELLECT: Brain,
  STRENGTH: Dumbbell,
  DISCIPLINE: Flame,
  CREATIVITY: Palette,
  VITALITY: Heart,
}

export function AttributeIcon({
  attribute,
  size = 19,
  ...props
}) {
  const Icon = attributeIcons[attribute] || BookOpen

  return (
    <Icon
      size={size}
      aria-hidden="true"
      {...props}
    />
  )
}

export function AttributeTag({ attribute }) {
  const normalizedAttribute =
    typeof attribute === 'string'
      ? attribute.toUpperCase()
      : ''

  const attributeDefinition = ATTRIBUTES.find(
    ({ key }) => key === normalizedAttribute,
  )

  return (
    <span
      className={[
        'attribute-tag',
        normalizedAttribute
          ? normalizedAttribute.toLowerCase()
          : 'unknown',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <AttributeIcon
        attribute={normalizedAttribute}
        size={13}
      />

      {attributeDefinition?.name || attribute || 'Attribute'}
    </span>
  )
}

export function Modal({
  open,
  onOpenChange,
  title,
  description,
  children,
  returnFocusRef,
  returnFocusSelector,
  className = '',
  eyebrow = 'THE ADVENTURE JOURNAL',
}) {
  const interactionFeedback = useInteractionFeedback()

  const moving = interactionFeedback?.moving ?? true

  const handleCloseAutoFocus = (event) => {
    const referencedElement = returnFocusRef?.current

    const fallbackElement =
      returnFocusSelector &&
      typeof document !== 'undefined'
        ? document.querySelector(returnFocusSelector)
        : null

    const target =
      referencedElement?.isConnected
        ? referencedElement
        : fallbackElement

    if (!target || typeof target.focus !== 'function') {
      return
    }

    event.preventDefault()

    requestAnimationFrame(() => {
      target.focus()
    })
  }

  return (
    <Dialog.Root
      open={open}
      onOpenChange={onOpenChange}
    >
      <Dialog.Portal>
        <Dialog.Overlay asChild>
          <motion.div
            className="dialog-overlay"
            initial={
              moving
                ? {
                    opacity: 0,
                  }
                : false
            }
            animate={{
              opacity: 1,
            }}
            exit={
              moving
                ? {
                    opacity: 0,
                  }
                : undefined
            }
            transition={{
              duration: moving ? 0.16 : 0,
              ease: 'easeOut',
            }}
          />
        </Dialog.Overlay>

        <Dialog.Content
          asChild
          onCloseAutoFocus={handleCloseAutoFocus}
        >
          <motion.div
            className={[
              'dialog-content',
              className,
            ]
              .filter(Boolean)
              .join(' ')}
            initial={
              moving
                ? {
                    opacity: 0,
                    y: 14,
                    scale: 0.985,
                  }
                : false
            }
            animate={{
              opacity: 1,
              y: 0,
              scale: 1,
            }}
            exit={
              moving
                ? {
                    opacity: 0,
                    y: 8,
                    scale: 0.99,
                  }
                : undefined
            }
            transition={
              moving
                ? {
                    type: 'spring',
                    stiffness: 330,
                    damping: 29,
                    mass: 0.7,
                  }
                : {
                    duration: 0,
                  }
            }
          >
            <Dialog.Close
              className="icon-button dialog-close"
              aria-label="Close dialog"
            >
              <X
                size={20}
                aria-hidden="true"
              />
            </Dialog.Close>

            {eyebrow ? (
              <span className="eyebrow">
                {eyebrow}
              </span>
            ) : null}

            <Dialog.Title className="dialog-title">
              {title}
            </Dialog.Title>

            {description ? (
              <Dialog.Description className="dialog-description">
                {description}
              </Dialog.Description>
            ) : (
              <Dialog.Description className="sr-only">
                {title}
              </Dialog.Description>
            )}

            {children}
          </motion.div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

export function PageHeading({
  eyebrow,
  title,
  description,
  children,
}) {
  return (
    <div className="page-heading">
      <div className="page-heading-copy">
        {eyebrow ? (
          <p className="eyebrow">
            {eyebrow}
          </p>
        ) : null}

        <h1>{title}</h1>

        {description ? (
          <p className="page-description">
            {description}
          </p>
        ) : null}
      </div>

      {children ? (
        <div className="page-heading-actions">
          {children}
        </div>
      ) : null}
    </div>
  )
}

export function PreviewNotice() {
  return (
    <div className="preview-notice">
      <span
        className="preview-dot"
        aria-hidden="true"
      />

      <p>
        <strong>
          A glimpse of your adventure.
        </strong>{' '}
        You’re exploring sample progress.
        Personal accounts are now open.
      </p>

      <span className="preview-label">
        WORLD PREVIEW
      </span>
    </div>
  )
}

export function SectionLink({
  to,
  children,
  className = '',
}) {
  return (
    <Link
      className={[
        'text-link',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
      to={to}
    >
      <span>{children}</span>

      <ArrowRight
        size={15}
        aria-hidden="true"
      />
    </Link>
  )
}

export function PageSkeleton() {
  return (
    <div
      className="page-skeleton"
      role="status"
      aria-live="polite"
      aria-label="Loading page"
    >
      <span className="sr-only">
        Loading page…
      </span>

      <div
        className="skeleton skeleton-heading"
        aria-hidden="true"
      />

      <div
        className="skeleton skeleton-hero"
        aria-hidden="true"
      />

      <div
        className="skeleton skeleton-body"
        aria-hidden="true"
      />
    </div>
  )
}