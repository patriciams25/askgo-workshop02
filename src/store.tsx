import { createContext, useContext, useEffect, useMemo, useReducer, useRef, type ReactNode } from 'react'
import { archiveAccount, dataSource } from './services/dataSource'
import { supabase } from './lib/supabase'
import { loadSupabaseState, saveSupabaseState } from './services/supabaseDataSource'
import {
  CATEGORIES, emptyState, initialState, isThisMonth, pct,
  type Card, type CategoryId, type Goal, type State, type Transaction,
} from './data'

type Action =
  | { type: 'tx/add'; tx: Transaction }
  | { type: 'tx/update'; tx: Transaction }
  | { type: 'tx/delete'; id: string }
  | { type: 'card/add'; card: Card }
  | { type: 'card/update'; card: Card }
  | { type: 'card/delete'; id: string }
  | { type: 'card/front'; id: string }
  | { type: 'goal/add'; goal: Goal }
  | { type: 'goal/update'; goal: Goal }
  | { type: 'goal/delete'; id: string }
  | { type: 'goal/save'; id: string; amount: number }
  | { type: 'budget/set'; category: CategoryId; cap: number }
  | { type: 'budget/delete'; category: CategoryId }
  | { type: 'monthCap/delete' }
  | { type: 'balance/toggle' }
  | { type: 'monthCap/set'; cap: number }
  | { type: 'session/set'; signedOut: boolean }
  | { type: 'reset' }
  | { type: 'invoice/import'; txs: Transaction[]; cardId: string; fingerprint: string; total?: number }
  | { type: 'plus/toggle' }
  | { type: 'balance/set'; value: number }
  | { type: 'auth/signIn'; account?: State }
  | { type: 'auth/signUp'; name: string; email: string }
  | { type: 'auth/hydrate'; account: State }

const roundMoney = (value: number) => Math.round(value * 100) / 100

const isCard = (s: State, method: string) => s.cards.some((c) => c.id === method)

/** Aplica (+1) ou desfaz (−1) o efeito de um gasto no saldo e na fatura do cartão. */
function applyTx(s: State, tx: Transaction, sign: 1 | -1): State {
  return {
    ...s,
    balance: roundMoney(s.balance - sign * tx.value),
    cards: isCard(s, tx.method)
      ? s.cards.map((c) => (c.id === tx.method ? { ...c, invoice: Math.max(0, roundMoney(c.invoice + sign * tx.value)) } : c))
      : s.cards,
  }
}

export function reducer(s: State, a: Action): State {
  switch (a.type) {
    case 'tx/add':
      return { ...applyTx(s, a.tx, 1), transactions: [a.tx, ...s.transactions] }
    case 'tx/update': {
      const old = s.transactions.find((t) => t.id === a.tx.id)
      if (!old) return s
      const reverted = applyTx(s, old, -1)
      return { ...applyTx(reverted, a.tx, 1), transactions: s.transactions.map((t) => (t.id === a.tx.id ? a.tx : t)) }
    }
    case 'tx/delete': {
      const old = s.transactions.find((t) => t.id === a.id)
      if (!old) return s
      const transactions = s.transactions.filter((t) => t.id !== a.id)
      const invoiceId = old.invoiceId ?? s.importedInvoices?.find((key) => old.id.startsWith(`${key}:`))
      const stillImported = invoiceId && transactions.some((tx) => tx.invoiceId === invoiceId || tx.id.startsWith(`${invoiceId}:`))
      return { ...applyTx(s, old, -1), transactions, ...(invoiceId && !stillImported ? { importedInvoices: s.importedInvoices?.filter((key) => key !== invoiceId) } : {}) }
    }
    case 'card/add':
      return { ...s, cards: [...s.cards, a.card], frontCardId: a.card.id }
    case 'card/update':
      return { ...s, cards: s.cards.map((card) => card.id === a.card.id ? a.card : card) }
    case 'card/delete': {
      const cards = s.cards.filter((card) => card.id !== a.id)
      if (cards.length === s.cards.length) return s
      return { ...s, cards, frontCardId: s.frontCardId === a.id ? cards[cards.length - 1]?.id ?? '' : s.frontCardId }
    }
    case 'card/front':
      return { ...s, frontCardId: a.id }
    case 'goal/add':
      return { ...s, goals: [...s.goals, a.goal] }
    case 'goal/update':
      return { ...s, goals: s.goals.map((goal) => goal.id === a.goal.id ? a.goal : goal) }
    case 'goal/delete': {
      const goal = s.goals.find((item) => item.id === a.id)
      if (!goal) return s
      return { ...s, balance: roundMoney(s.balance + goal.saved), goals: s.goals.filter((item) => item.id !== a.id) }
    }
    case 'goal/save':
      if (!Number.isFinite(a.amount) || a.amount <= 0 || a.amount > s.balance || !s.goals.some((g) => g.id === a.id)) return s
      return {
        ...s,
        balance: roundMoney(s.balance - a.amount),
        goals: s.goals.map((g) => (g.id === a.id ? { ...g, saved: roundMoney(g.saved + a.amount) } : g)),
      }
    case 'monthCap/set':
      return { ...s, monthCap: a.cap }
    case 'monthCap/delete':
      return { ...s, monthCap: 0 }
    case 'session/set':
      return { ...s, signedOut: a.signedOut }
    case 'budget/set':
      return { ...s, budgets: { ...s.budgets, [a.category]: a.cap } }
    case 'budget/delete':
      return { ...s, budgets: { ...s.budgets, [a.category]: 0 } }
    case 'balance/toggle':
      return { ...s, hideBalance: !s.hideBalance }
    case 'reset':
      return initialState
    case 'invoice/import': {
      if (s.importedInvoices?.includes(a.fingerprint) || !a.txs.length) return s
      const added = a.txs.reduce((state, tx) => applyTx(state, tx, 1), s)
      // A fatura lida é a fonte da verdade: substitui o valor digitado à mão no cartão (evita contar duas vezes).
      const cards = a.total == null ? added.cards : added.cards.map((c) => (c.id === a.cardId ? { ...c, invoice: roundMoney(a.total!) } : c))
      return { ...added, cards, transactions: [...a.txs, ...s.transactions], importedInvoices: [...(s.importedInvoices ?? []), a.fingerprint] }
    }
    case 'balance/set':
      return { ...s, balance: a.value }
    case 'plus/toggle':
      return { ...s, plus: !s.plus }
    case 'auth/signIn':
      return { ...(a.account ?? s), signedOut: false }
    case 'auth/signUp':
      return emptyState(a.name, a.email)
    case 'auth/hydrate':
      return a.account
  }
}

const load = (): State => supabase ? { ...emptyState('', ''), signedOut: true } : dataSource.load(initialState)

/** ViewModel derivado — o que a home e as metas mostram. */
export function useMonth(s: State) {
  return useMemo(() => {
    const monthTx = s.transactions.filter((t) => isThisMonth(t.date))
    const total = roundMoney(monthTx.reduce((n, t) => n + t.value, 0))
    const byCat = CATEGORIES.map((c) => {
      const spent = monthTx.filter((t) => t.category === c.id).reduce((n, t) => n + t.value, 0)
      return { ...c, spent, cap: s.budgets[c.id], share: pct(spent, total), used: pct(spent, s.budgets[c.id]) }
    })
    const top = [...byCat].filter((c) => c.spent > 0).sort((a, b) => b.spent - a.spent)
    const diff = s.lastMonthTotal > 0 ? Math.round(((total - s.lastMonthTotal) / s.lastMonthTotal) * 100) : 0
    return { total, byCat, top, diff, available: s.monthCap > 0 ? roundMoney(s.monthCap - total) : null }
  }, [s.transactions, s.budgets, s.monthCap, s.lastMonthTotal])
}

const Ctx = createContext<{ state: State; dispatch: React.Dispatch<Action> } | null>(null)

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, undefined, load)
  const activeUser = useRef<import('@supabase/supabase-js').User | null>(null)
  const hydratedUser = useRef<string | null>(null)
  const previousRemoteState = useRef<State | null>(null)
  const saveQueue = useRef<Promise<void>>(Promise.resolve())
  useEffect(() => {
    if (!supabase) return
    let active = true
    const hydrate = async (user: import('@supabase/supabase-js').User) => {
      if (hydratedUser.current === user.id) return
      activeUser.current = user
      hydratedUser.current = null
      try {
        const account = await loadSupabaseState(user)
        if (!active) return
        previousRemoteState.current = account
        hydratedUser.current = user.id
        dispatch({ type: 'auth/hydrate', account })
      } catch (error) {
        console.error('Falha ao carregar dados do Supabase:', error)
        if (active) dispatch({ type: 'session/set', signedOut: true })
      }
    }
    void supabase.auth.getSession().then(({ data, error }) => {
      if (error) throw error
      if (active && data.session) void hydrate(data.session.user)
    }).catch((error) => console.error('Falha ao recuperar sessão Supabase:', error))
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!active) return
      if (session) {
        // Não faça consultas Supabase dentro do callback síncrono do Auth.
        queueMicrotask(() => { if (active) void hydrate(session.user) })
      } else {
        activeUser.current = null
        hydratedUser.current = null
        previousRemoteState.current = null
        dispatch({ type: 'session/set', signedOut: true })
      }
    })
    return () => { active = false; subscription.unsubscribe() }
  }, [])
  useEffect(() => {
    if (!supabase) {
      dataSource.save(state)
      archiveAccount(state)
      return
    }
    const user = activeUser.current
    const previous = previousRemoteState.current
    if (!user || hydratedUser.current !== user.id || !previous || state.signedOut) return
    if (JSON.stringify(previous) === JSON.stringify(state)) return
    previousRemoteState.current = state
    saveQueue.current = saveQueue.current.then(() => saveSupabaseState(user, state, previous)).catch((error) => {
      console.error('Falha ao salvar dados no Supabase:', error)
      if (previousRemoteState.current === state) previousRemoteState.current = previous
    })
  }, [state])
  return <Ctx.Provider value={{ state, dispatch }}>{children}</Ctx.Provider>
}

export function useStore() {
  const v = useContext(Ctx)
  if (!v) throw new Error('useStore fora do StoreProvider')
  return v
}

export const uid = () => Math.random().toString(36).slice(2, 10)
