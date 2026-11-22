import { TODAY, iso, type CategoryId } from '../data'
import type { InvoiceItem, InvoiceResult } from './ai'

/**
 * Leitura de fatura simulada (front-end apenas).
 * Devolve o mesmo formato da rota /api/invoice: 34 compras,
 * 6 assinaturas, total R$ 1.284 — dados do briefing.
 */
const SUBS: [string, number][] = [
  ['Netflix', 55.9], ['Spotify', 21.9], ['iCloud', 10.9],
  ['Academia', 119.9], ['YouTube Premium', 24.9], ['Amazon Prime', 19.9],
]
const BUYS: [string, CategoryId][] = [
  ['iFood', 'alimentacao'], ['Mercado', 'alimentacao'], ['Uber', 'transporte'], ['Padaria', 'alimentacao'],
  ['Farmácia', 'saude'], ['Posto', 'transporte'], ['Cinema', 'lazer'], ['Rappi', 'alimentacao'],
  ['99', 'transporte'], ['Livraria', 'lazer'], ['Restaurante', 'alimentacao'], ['Loja', 'outros'],
  ['Café', 'alimentacao'], ['Estacionamento', 'transporte'],
]

export function mockInvoice(): InvoiceResult {
  const total = 1284
  const y = TODAY.getFullYear()
  const m = TODAY.getMonth()
  const day = (d: number) => iso(new Date(y, m, Math.min(d, 28)))

  const items: InvoiceItem[] = SUBS.map(([name, value], i) => ({
    name, value, date: day(2 + i * 3), category: name === 'Academia' ? 'saude' : 'lazer', subscription: true,
  }))
  const subsTotal = items.reduce((n, i) => n + i.value, 0)
  const rest = total - subsTotal
  const weights = Array.from({ length: 28 }, (_, i) => 1 + ((i * 7) % 5))
  const wsum = weights.reduce((a, b) => a + b, 0)
  let acc = 0
  weights.forEach((w, i) => {
    const [name, category] = BUYS[i % BUYS.length]
    const value = i === weights.length - 1 ? Math.round((rest - acc) * 100) / 100 : Math.round((rest * w / wsum) * 100) / 100
    acc += value
    items.push({ name, value, date: day(1 + (i % 27)), category, subscription: false })
  })
  return { total, items }
}

/** Simula o progresso de leitura (0 → 100) chamando onProgress. */
export function simulateReading(onProgress: (p: number) => void, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) { reject(new DOMException('aborted', 'AbortError')); return }
    let p = 0
    const cancel = () => { window.clearInterval(id); reject(new DOMException('aborted', 'AbortError')) }
    const id = window.setInterval(() => {
      p = Math.min(100, p + 8)
      onProgress(p)
      if (p >= 100) { window.clearInterval(id); signal.removeEventListener('abort', cancel); resolve() }
    }, 140)
    signal.addEventListener('abort', cancel, { once: true })
  })
}
