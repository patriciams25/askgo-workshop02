import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { Icon } from './Icon'

const reduceMotion = () => typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

/** Folha: bottom sheet no celular, diálogo centralizado no desktop. Anima na entrada e na saída. */
export function Sheet({ title, onClose: closeNow, children }: { title: string; onClose: () => void; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null)
  const [closing, setClosing] = useState(false)
  const onClose = useCallback(() => {
    if (closing) return
    if (reduceMotion()) return closeNow()
    setClosing(true)
    window.setTimeout(closeNow, 200)
  }, [closing, closeNow])
  useEffect(() => {
    const previousFocus = document.activeElement as HTMLElement | null
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
      if (e.key !== 'Tab') return
      const elements = ref.current?.querySelectorAll<HTMLElement>('button:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex="0"]')
      if (!elements?.length) return
      const first = elements[0]
      const last = elements[elements.length - 1]
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus() }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus() }
    }
    document.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const focusTarget = ref.current?.querySelector<HTMLElement>('input, select') ?? ref.current?.querySelector<HTMLElement>('button')
    focusTarget?.focus()
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
      previousFocus?.focus()
    }
  }, [onClose])

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center lg:items-center" role="dialog" aria-modal="true" aria-label={title}>
      <button aria-label="Fechar" tabIndex={-1} className={`absolute inset-0 bg-black/70 backdrop-blur-sm ${closing ? 'animate-fade-out' : 'animate-fade'}`} onClick={onClose} />
      <div
        ref={ref}
        className={`relative max-h-[92dvh] w-full overflow-y-auto rounded-t-[32px] bg-esk-sheet px-5 pb-[max(24px,env(safe-area-inset-bottom))] pt-3 shadow-[0_-20px_60px_rgba(0,0,0,0.5)]
                   lg:max-w-[480px] lg:rounded-[32px] lg:px-8 lg:pb-8 lg:pt-6
                   ${closing ? 'animate-sheet-down lg:animate-pop-out' : 'animate-sheet-up lg:animate-pop'}`}
      >
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-esk-track lg:hidden" />
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-[22px] font-medium tracking-[-0.02em]">{title}</h2>
          <button aria-label="Fechar" onClick={onClose} className="press grid size-10 place-items-center rounded-full bg-esk-row text-esk-text transition hover:rotate-90">
            <Icon name="close" size={18} />
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

export function Field({ label, error, children }: { label: string; error?: string; children: ReactNode }) {
  return (
    <label className="flex flex-col gap-2">
      <span className="text-[13px] text-esk-text-2">{label}</span>
      {children}
      {error && <span key={error} className="animate-shake text-[12px] text-esk-lilac-strong" role="alert">{error}</span>}
    </label>
  )
}

export const inputCls =
  'h-[52px] w-full rounded-[16px] border border-esk-border bg-esk-bg-2 px-4 text-[16px] text-esk-text outline-none transition focus:border-esk-lime placeholder:text-esk-muted'

export function PrimaryButton({ children, ...rest }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...rest}
      className={`press h-14 w-full rounded-tile bg-esk-lime text-[16px] font-medium text-esk-ink transition hover:brightness-95 disabled:opacity-40 ${rest.className ?? ''}`}
    >
      {children}
    </button>
  )
}

export function GhostButton({ children, ...rest }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...rest}
      className={`press h-14 w-full rounded-tile bg-esk-elevated text-[16px] font-medium text-esk-text transition hover:bg-esk-row ${rest.className ?? ''}`}
    >
      {children}
    </button>
  )
}

/** Campo de valor em R$ — aceita "167,90" ou "1.284". */
export function parseMoney(v: string) {
  const clean = v.trim().replace(/^R\$\s*/, '').replace(/\s/g, '')
  if (!/^(?:\d+|\d{1,3}(?:\.\d{3})+)(?:,\d{1,2})?$/.test(clean)) return 0
  const n = Number(clean.replace(/\./g, '').replace(',', '.'))
  return Number.isFinite(n) && n > 0 ? Math.round(n * 100) / 100 : 0
}

export function RoundIconButton({ label, icon, onClick }: { label: string; icon: Parameters<typeof Icon>[0]['name']; onClick?: () => void }) {
  return (
    <button aria-label={label} onClick={onClick} className="press grid size-11 place-items-center rounded-full bg-esk-elevated text-esk-text transition hover:bg-esk-row">
      <Icon name={icon} size={20} />
    </button>
  )
}

export function Toast({ message }: { message: string | null }) {
  if (!message) return null
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-6 z-50 flex justify-center px-4" role="status" aria-live="polite">
      <div key={message} className="flex items-center gap-2 rounded-full bg-esk-lime px-5 py-3 text-[14px] font-medium text-esk-ink shadow-[0_18px_50px_rgba(0,0,0,0.55)] animate-toast">
        <span className="grid size-5 place-items-center rounded-full bg-esk-ink text-esk-lime"><Icon name="check" size={12} strokeWidth={2.6} /></span>
        {message}
      </div>
    </div>
  )
}

export function Empty({ title, hint }: { title: string; hint: string }) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-[26px] border border-dashed border-esk-track px-6 py-10 text-center">
      <span className="text-[16px] font-medium">{title}</span>
      <span className="text-[13px] text-esk-muted">{hint}</span>
    </div>
  )
}

/** Valor que só fica "real" depois do primeiro quadro — barras e anéis crescem ao aparecer. */
export function useMounted(delay = 60) {
  const [on, setOn] = useState(false)
  useEffect(() => { const id = window.setTimeout(() => setOn(true), delay); return () => window.clearTimeout(id) }, [delay])
  return on
}

export function Bar({ value, color = 'var(--esk-lime)', h = 4 }: { value: number; color?: string; h?: number }) {
  const on = useMounted()
  return (
    <div className="w-full overflow-hidden rounded-full bg-esk-track" style={{ height: h }} role="presentation">
      <div className="h-full rounded-full transition-[width] duration-700 ease-[cubic-bezier(.2,.8,.2,1)]" style={{ width: `${on ? Math.min(100, Math.max(0, value)) : 0}%`, background: color }} />
    </div>
  )
}

/** Número que conta até o valor (saldo, totais). Anima também quando o valor muda. */
export function CountUp({ value, format, duration = 700 }: { value: number; format: (n: number) => string; duration?: number }) {
  const [shown, setShown] = useState(reduceMotion() ? value : 0)
  const from = useRef(reduceMotion() ? value : 0)
  useEffect(() => {
    if (reduceMotion()) { setShown(value); return }
    const start = performance.now()
    const a = from.current
    let raf = 0
    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / duration)
      const eased = 1 - Math.pow(1 - p, 3)
      const n = a + (value - a) * eased
      setShown(p < 1 ? Math.round(n * 100) / 100 : value)
      if (p < 1) raf = requestAnimationFrame(tick)
      else from.current = value
    }
    raf = requestAnimationFrame(tick)
    return () => { cancelAnimationFrame(raf); from.current = value }
  }, [value, duration])
  return <span aria-label={format(value)}><span aria-hidden="true">{format(value % 1 === 0 ? Math.round(shown) : shown)}</span></span>
}
