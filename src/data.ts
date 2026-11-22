// Mocks tipados — no estágio 1, tratados como se a pessoa tivesse digitado.

export type CategoryId = 'moradia' | 'alimentacao' | 'transporte' | 'lazer' | 'saude' | 'outros'
export type PayMethod = string // id do cartão | 'pix' | 'dinheiro'

export interface Transaction {
  id: string
  name: string
  category: CategoryId
  method: PayMethod
  date: string // YYYY-MM-DD
  value: number
  source?: 'manual' | 'invoice'
  invoiceId?: string
  subscription?: boolean
}

export type CardColor = 'offwhite' | 'lilac' | 'gradient'

export interface Card {
  id: string
  name: string
  last4: string
  color: CardColor
  limit: number
  invoice: number
  dueDays: number
}

export interface Goal {
  id: string
  name: string
  saved: number
  target: number
  date?: string // "Dez 2027"
  icon: 'plane' | 'shield' | 'book' | 'car' | 'star'
}

export interface State {
  user: { name: string; email: string }
  balance: number
  hideBalance: boolean
  signedOut?: boolean
  /** Estágio 2 (Fatura + Assistente) visível. */
  plus?: boolean
  importedInvoices?: string[]
  monthCap: number
  lastMonthTotal: number
  budgets: Record<CategoryId, number>
  transactions: Transaction[]
  cards: Card[]
  frontCardId: string
  goals: Goal[]
}

export const CATEGORIES: { id: CategoryId; label: string }[] = [
  { id: 'moradia', label: 'Moradia' },
  { id: 'alimentacao', label: 'Alimentação' },
  { id: 'transporte', label: 'Transporte' },
  { id: 'lazer', label: 'Lazer' },
  { id: 'saude', label: 'Saúde' },
  { id: 'outros', label: 'Outros' },
]

export const catLabel = (id: CategoryId) => CATEGORIES.find((c) => c.id === id)?.label ?? id

export const TODAY = new Date()
export const iso = (d: Date) => {
  const z = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}`
}
const daysAgo = (n: number) => {
  const d = new Date(TODAY)
  d.setDate(d.getDate() - n)
  return iso(d)
}
const dayOfMonth = (day: number) => iso(new Date(TODAY.getFullYear(), TODAY.getMonth(), day))

export const initialState: State = {
  user: { name: 'Lucas', email: 'lucas@eskgo.app' },
  balance: 14500,
  hideBalance: false,
  signedOut: true,
  plus: true,
  monthCap: 3200,
  lastMonthTotal: 2660,
  budgets: { moradia: 1200, alimentacao: 1200, transporte: 1000, lazer: 400, saude: 300, outros: 300 },
  transactions: [
    { id: 't1', name: 'Mercado', category: 'alimentacao', method: 'principal', date: daysAgo(0), value: 260 },
    { id: 't2', name: 'Restaurante', category: 'alimentacao', method: 'principal', date: daysAgo(1), value: 480 },
    { id: 't3', name: 'Uber', category: 'transporte', method: 'salario', date: dayOfMonth(8), value: 400 },
    { id: 't4', name: 'Aluguel', category: 'moradia', method: 'pix', date: dayOfMonth(1), value: 1200 },
  ],
  cards: [
    { id: 'viagem', name: 'Viagem', last4: '1180', color: 'offwhite', limit: 2000, invoice: 98, dueDays: 27 },
    { id: 'salario', name: 'Salário', last4: '6917', color: 'lilac', limit: 2500, invoice: 640, dueDays: 12 },
    { id: 'principal', name: 'Principal', last4: '4552', color: 'gradient', limit: 3000, invoice: 1284, dueDays: 8 },
  ],
  frontCardId: 'principal',
  goals: [
    { id: 'g1', name: 'Viagem ao Japão', saved: 13600, target: 20000, date: 'Dez 2027', icon: 'plane' },
    { id: 'g2', name: 'Reserva', saved: 7200, target: 10000, icon: 'shield' },
    { id: 'g3', name: 'Curso', saved: 2700, target: 3000, icon: 'book' },
    { id: 'g4', name: 'Carro novo', saved: 9600, target: 40000, icon: 'car' },
  ],
}

/** Conta nova (cadastro): começa vazia, para a pessoa digitar o próprio dinheiro. */
export const emptyState = (name: string, email: string): State => ({
  ...initialState,
  user: { name, email },
  balance: 0,
  lastMonthTotal: 0,
  transactions: [],
  cards: [],
  frontCardId: '',
  goals: [],
  signedOut: false,
})

// ---------- formatação ----------
const brl0 = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
const brl2 = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
export const money = (v: number, cents = v % 1 !== 0) => `R$ ${(cents ? brl2 : brl0).format(v)}`
export const pct = (a: number, b: number) => (b <= 0 ? 0 : Math.round((a / b) * 100))

const MONTHS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']
export const MONTHS_FULL = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro']

export function relDate(d: string) {
  const today = iso(TODAY)
  const y = new Date(TODAY)
  y.setDate(y.getDate() - 1)
  if (d === today) return 'Hoje'
  if (d === iso(y)) return 'Ontem'
  const [, m, day] = d.split('-')
  return `${day} ${MONTHS[Number(m) - 1]}`
}

export const isThisMonth = (d: string) => d.slice(0, 7) === iso(TODAY).slice(0, 7)
