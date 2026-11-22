import { env } from '../lib/env'
import { supabase } from '../lib/supabase'
import type { CategoryId, State } from '../data'

/**
 * Cliente do estágio 2 (OpenAI). O navegador NUNCA fala com a OpenAI:
 * ele chama as rotas de servidor em /api, que guardam a chave.
 * Exemplos de rota: api/chat.ts e api/invoice.ts.
 */

export interface InvoiceItem {
  name: string
  value: number
  date: string // YYYY-MM-DD
  category: CategoryId
  subscription: boolean
}

export interface InvoiceResult {
  total: number
  items: InvoiceItem[]
}

export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

export interface ChatAttachment {
  name: string
  mimeType: string
  base64: string
}

export class AIUnavailableError extends Error {
  constructor() { super('Assistente desativado (VITE_FEATURE_AI=false).') }
}

export class AIAuthRequiredError extends Error {
  constructor() { super('Entre na sua conta para usar a IA. Configure o Supabase para ativar essa integração.') }
}

async function post<T>(path: string, body: unknown, signal?: AbortSignal): Promise<T> {
  if (!env.featureAI) throw new AIUnavailableError()
  if (!supabase) throw new AIAuthRequiredError()
  const { data, error } = await supabase.auth.getSession()
  const token = data.session?.access_token
  if (error || !token) throw new AIAuthRequiredError()
  const res = await fetch(`${env.apiBaseUrl}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
    signal,
  })
  if (!res.ok) {
    let message = `Erro ${res.status}`
    try {
      const payload = await res.json() as { error?: unknown }
      if (typeof payload.error === 'string') message = payload.error
    } catch { /* a resposta pode não ser JSON */ }
    if (res.status === 401) throw new AIAuthRequiredError()
    if (res.status === 503 && message.includes('Autenticação Supabase')) throw new AIAuthRequiredError()
    throw new Error(message)
  }
  return res.json() as Promise<T>
}

/** Resumo enxuto do app enviado como contexto para a IA (sem dados pessoais). */
export function buildContext(s: State) {
  return {
    balance: s.balance,
    monthCap: s.monthCap,
    budgets: s.budgets,
    transactions: s.transactions.slice(0, 200).map(({ name, category, date, value }) => ({ name, category, date, value })),
    cards: s.cards.map(({ name, invoice, limit, dueDays }) => ({ name, invoice, limit, dueDays })),
    goals: s.goals.map(({ name, saved, target, date }) => ({ name, saved, target, date })),
  }
}

/** Envia fatura (PDF ou foto em base64) para leitura. */
export function readInvoice(file: { name: string; mimeType: string; base64: string }, signal?: AbortSignal) {
  return post<InvoiceResult>('/invoice', file, signal)
}

/** Pergunta ao assistente com o contexto real do usuário. */
export function askAssistant(messages: ChatMessage[], state: State, signal?: AbortSignal, attachment?: ChatAttachment) {
  return post<{ reply: string }>('/chat', { messages, context: buildContext(state), ...(attachment ? { attachment } : {}) }, signal)
}

/** Converte um File do <input type="file"> em base64 (sem o prefixo data:). */
export function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve(String(r.result).split(',')[1] ?? '')
    r.onerror = () => reject(r.error)
    r.readAsDataURL(file)
  })
}
