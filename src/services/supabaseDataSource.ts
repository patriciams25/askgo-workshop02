import type { User } from '@supabase/supabase-js'
import type { Card, Goal, State, Transaction } from '../data'
import { emptyState } from '../data'
import { supabase } from '../lib/supabase'

type Row = Record<string, unknown>
const fail = (error: { message: string } | null) => { if (error) throw new Error(error.message) }
const amount = (v: unknown) => Number(v ?? 0)

// O front aceita IDs de demonstração. Estes IDs são convertidos para UUIDs do
// banco, guardando o vínculo no próprio navegador por conta e tipo de registro.
function dbId(userId: string, kind: string, id: string) {
  if (/^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(id)) return id
  const key = `eskgo:id:${userId}:${kind}:${id}`
  let value = localStorage.getItem(key)
  if (!value) { value = crypto.randomUUID(); localStorage.setItem(key, value) }
  return value
}

export async function loadSupabaseState(user: User, allowDemoSeed = true): Promise<State> {
  if (!supabase) throw new Error('Supabase não configurado.')
  const [p, c, t, b, g, i] = await Promise.all([
    supabase.from('profiles').select('*').eq('id', user.id).single(),
    supabase.from('cards').select('*').eq('user_id', user.id),
    supabase.from('transactions').select('*').eq('user_id', user.id).order('spent_on', { ascending: false }),
    supabase.from('budgets').select('*').eq('user_id', user.id),
    supabase.from('goals').select('*').eq('user_id', user.id),
    supabase.from('invoices').select('id').eq('user_id', user.id).limit(1),
  ])
  fail(p.error); fail(c.error); fail(t.error); fail(b.error); fail(g.error); fail(i.error)
  // O projeto está em fase de demonstração: contas vazias recebem o fixture
  // protegido no banco. A função recusa a operação se houver qualquer registro.
  if (allowDemoSeed && !(c.data?.length || t.data?.length || b.data?.length || g.data?.length || i.data?.length)) {
    const { error } = await supabase.rpc('seed_my_demo_data')
    fail(error)
    return loadSupabaseState(user, false)
  }
  const profile = p.data as Row
  const cards = (c.data as Row[]).map((r): Card => ({ id: String(r.id), name: String(r.name), last4: String(r.last4).trim(), color: r.color as Card['color'], limit: amount(r.credit_limit), invoice: amount(r.invoice), dueDays: amount(r.due_day) }))
  const cardIds = new Map(cards.map((card) => [card.id, card.id]))
  const transactions = (t.data as Row[]).map((r): Transaction => ({ id: String(r.id), name: String(r.name), category: r.category as Transaction['category'], method: r.method === 'card' && r.card_id ? (cardIds.get(String(r.card_id)) ?? String(r.card_id)) : String(r.method), date: String(r.spent_on), value: amount(r.value), source: r.source as Transaction['source'], invoiceId: r.invoice_id ? String(r.invoice_id) : undefined, subscription: Boolean(r.subscription) }))
  const goals = (g.data as Row[]).map((r): Goal => ({ id: String(r.id), name: String(r.name), target: amount(r.target), saved: amount(r.saved), date: r.target_label ? String(r.target_label) : undefined, icon: r.icon as Goal['icon'] }))
  const budgets = Object.fromEntries((b.data as Row[]).map((r) => [String(r.category), amount(r.cap)])) as State['budgets']
  return {
    ...emptyState(String(profile.name || user.user_metadata.name || user.email?.split('@')[0] || 'Pessoa'), user.email ?? ''),
    balance: amount(profile.balance), hideBalance: Boolean(profile.hide_balance), monthCap: amount(profile.month_cap), lastMonthTotal: amount(profile.last_month_total), plus: Boolean(profile.plus), frontCardId: profile.front_card_id ? String(profile.front_card_id) : '', budgets: { ...emptyState('', '').budgets, ...budgets }, cards, transactions, goals,
    importedInvoices: [...new Set(transactions.flatMap((tx) => tx.invoiceId ? [tx.invoiceId] : []))], signedOut: false,
  }
}

const changed = <T,>(a: T | undefined, b: T | undefined) => JSON.stringify(a) !== JSON.stringify(b)

async function syncContributions(userId: string, before: Goal | undefined, after: Goal) {
  if (!supabase) return
  const difference = Math.round((after.saved - (before?.saved ?? 0)) * 100) / 100
  if (difference > 0) {
    const { error } = await supabase.from('goal_contributions').insert({ user_id: userId, goal_id: dbId(userId, 'goal', after.id), amount: difference })
    fail(error)
  } else if (difference < 0) {
    let remaining = -difference
    const { data, error } = await supabase.from('goal_contributions').select('id,amount').eq('user_id', userId).eq('goal_id', dbId(userId, 'goal', after.id)).order('created_at', { ascending: false })
    fail(error)
    for (const row of (data ?? []) as Row[]) {
      if (remaining <= 0) break
      const current = amount(row.amount)
      if (current <= remaining) {
        const { error: removeError } = await supabase.from('goal_contributions').delete().eq('id', row.id)
        fail(removeError); remaining -= current
      } else {
        const { error: updateError } = await supabase.from('goal_contributions').update({ amount: current - remaining }).eq('id', row.id)
        fail(updateError); remaining = 0
      }
    }
    if (remaining > 0.009) throw new Error('Não foi possível reconciliar o valor guardado nesta meta.')
  }
}

/** Persiste o estado da conta usando as policies RLS e os gatilhos financeiros do banco. */
export async function saveSupabaseState(user: User, state: State, previous: State) {
  if (!supabase) return
  const uid = user.id
  const cardRows = state.cards.map((card) => ({ id: dbId(uid, 'card', card.id), user_id: uid, name: card.name, last4: card.last4, color: card.color, credit_limit: card.limit, invoice: card.invoice, due_day: card.dueDays || null }))
  if (cardRows.length) { const { error } = await supabase.from('cards').upsert(cardRows); fail(error) }

  const previousGoals = new Map(previous.goals.map((goal) => [goal.id, goal]))
  const goalRows = state.goals.map((goal) => ({ id: dbId(uid, 'goal', goal.id), user_id: uid, name: goal.name, target: goal.target, target_label: goal.date ?? null, icon: goal.icon }))
  if (goalRows.length) { const { error } = await supabase.from('goals').upsert(goalRows); fail(error) }
  for (const goal of state.goals) if (changed(previousGoals.get(goal.id)?.saved, goal.saved)) await syncContributions(uid, previousGoals.get(goal.id), goal)

  const budgetRows = Object.entries(state.budgets).filter(([, cap]) => cap > 0).map(([category, cap]) => ({ user_id: uid, category, cap }))
  if (budgetRows.length) { const { error } = await supabase.from('budgets').upsert(budgetRows, { onConflict: 'user_id,category' }); fail(error) }
  const removeBudgets = Object.entries(previous.budgets).filter(([category, cap]) => cap > 0 && !(state.budgets[category as keyof State['budgets']] > 0)).map(([category]) => category)
  if (removeBudgets.length) { const { error } = await supabase.from('budgets').delete().eq('user_id', uid).in('category', removeBudgets); fail(error) }

  const previousTx = new Map(previous.transactions.map((tx) => [tx.id, tx]))
  const txRows = state.transactions.filter((tx) => tx.source !== 'invoice' || previousTx.has(tx.id)).filter((tx) => changed(previousTx.get(tx.id), tx)).map((tx) => ({ id: dbId(uid, 'transaction', tx.id), user_id: uid, name: tx.name, category: tx.category, card_id: state.cards.some((c) => c.id === tx.method) ? dbId(uid, 'card', tx.method) : null, method: state.cards.some((c) => c.id === tx.method) ? 'card' : tx.method, value: tx.value, spent_on: tx.date, source: tx.source ?? 'manual', invoice_id: tx.invoiceId ?? null, subscription: tx.subscription ?? false }))
  if (txRows.length) { const { error } = await supabase.from('transactions').upsert(txRows); fail(error) }
  const removedTx = previous.transactions.filter((tx) => !state.transactions.some((item) => item.id === tx.id)).map((tx) => dbId(uid, 'transaction', tx.id))
  if (removedTx.length) { const { error } = await supabase.from('transactions').delete().eq('user_id', uid).in('id', removedTx); fail(error) }

  const removedGoals = previous.goals.filter((goal) => !state.goals.some((item) => item.id === goal.id)).map((goal) => dbId(uid, 'goal', goal.id))
  if (removedGoals.length) { const { error } = await supabase.from('goals').delete().eq('user_id', uid).in('id', removedGoals); fail(error) }
  const removedCards = previous.cards.filter((card) => !state.cards.some((item) => item.id === card.id)).map((card) => dbId(uid, 'card', card.id))
  if (removedCards.length) { const { error } = await supabase.from('cards').delete().eq('user_id', uid).in('id', removedCards); fail(error) }

  // Gatilhos recalculam a fatura ao gravar transações; repomos o total exato
  // editado pelo usuário para evitar diferenças entre formulário e banco.
  for (const card of state.cards) {
    if (changed(previous.cards.find((item) => item.id === card.id)?.invoice, card.invoice)) {
      const { error } = await supabase.from('cards').update({ invoice: card.invoice }).eq('id', dbId(uid, 'card', card.id)).eq('user_id', uid)
      fail(error)
    }
  }

  const { error: profileError } = await supabase.from('profiles').update({ name: state.user.name, balance: state.balance, hide_balance: state.hideBalance, month_cap: state.monthCap, last_month_total: state.lastMonthTotal, plus: Boolean(state.plus), front_card_id: state.frontCardId ? dbId(uid, 'card', state.frontCardId) : null }).eq('id', uid)
  fail(profileError)
}
