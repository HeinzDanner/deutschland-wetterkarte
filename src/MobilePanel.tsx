import { useEffect, useId, useRef, type ReactNode } from 'react'
import { useLanguage } from './i18n'

export type PanelName = 'search' | 'layers' | 'forecast' | 'warning' | 'menu'

export function MobilePanel({ enabled, open, title, onClose, children, initialFocus }: {
  enabled: boolean
  open: boolean
  title: string
  onClose: () => void
  children: ReactNode
  initialFocus?: string
}) {
  const { mobileText } = useLanguage()
  const id = useId()
  const root = useRef<HTMLDivElement>(null)
  const returnFocus = useRef<HTMLElement | null>(null)
  const close = useRef(onClose)
  close.current = onClose
  const touch = useRef<{ x: number; y: number } | null>(null)

  useEffect(() => {
    if (!enabled || open) return
    const remember = () => {
      if (document.activeElement instanceof HTMLElement && !root.current?.contains(document.activeElement)) {
        returnFocus.current = document.activeElement
      }
    }
    remember()
    document.addEventListener('focusin', remember)
    return () => document.removeEventListener('focusin', remember)
  }, [enabled, open])

  useEffect(() => {
    if (!enabled || !open) return
    const previous = returnFocus.current
    const panel = root.current!
    const body = panel.querySelector('.mobile-panel-body')
    if (body) body.scrollTop = 0
    const focusable = () => [...panel.querySelectorAll<HTMLElement>(
      'button:not(:disabled), a[href], input:not(:disabled), select:not(:disabled), summary, [tabindex="0"]',
    )].filter((element) => element.getClientRects().length > 0 && !element.closest('[inert]'))
    const focus = panel.querySelector<HTMLElement>(initialFocus ?? '[data-panel-back]')
    const frame = window.requestAnimationFrame(() => focus?.focus({ preventScroll: true }))
    const timer = window.setTimeout(() => {
      if (!panel.contains(document.activeElement)) focus?.focus({ preventScroll: true })
    }, 270)
    const keydown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        event.stopPropagation()
        close.current()
      }
      if (event.key !== 'Tab') return
      const items = focusable()
      const first = items[0]
      const last = items[items.length - 1]
      if (!first) { event.preventDefault(); return }
      if (event.shiftKey && (document.activeElement === first || !panel.contains(document.activeElement))) {
        event.preventDefault(); last.focus()
      } else if (!event.shiftKey && (document.activeElement === last || !panel.contains(document.activeElement))) {
        event.preventDefault(); first.focus()
      }
    }
    document.addEventListener('keydown', keydown, true)
    return () => {
      window.cancelAnimationFrame(frame)
      window.clearTimeout(timer)
      document.removeEventListener('keydown', keydown, true)
      if (previous?.isConnected && !previous.closest('[inert]')) previous.focus({ preventScroll: true })
    }
  }, [enabled, open, initialFocus, title])

  return <div ref={root} className={enabled ? `mobile-panel${open ? ' is-open' : ''}` : 'desktop-panel'}
    inert={enabled && !open} aria-hidden={enabled && !open ? true : undefined}>
    <div className="mobile-panel-scrim" onClick={onClose} aria-hidden="true" />
    <section className="mobile-panel-surface" role={enabled ? 'dialog' : undefined}
      aria-modal={enabled && open ? true : undefined} aria-labelledby={enabled ? id : undefined}>
      <header className="mobile-panel-header"
        onTouchStart={(event) => {
          if (event.touches.length !== 1) { touch.current = null; return }
          touch.current = { x: event.touches[0].clientX, y: event.touches[0].clientY }
        }}
        onTouchCancel={() => { touch.current = null }}
        onTouchEnd={(event) => {
          const end = event.changedTouches[0]
          if (touch.current && end && end.clientY - touch.current.y > 70 &&
            Math.abs(end.clientX - touch.current.x) < 70) onClose()
          touch.current = null
        }}>
        <button data-panel-back type="button" onClick={onClose} aria-label={mobileText('back')}>←</button>
        <h2 id={id}>{title}</h2>
      </header>
      <div className="mobile-panel-body">{children}</div>
    </section>
  </div>
}
