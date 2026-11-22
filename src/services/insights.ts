import { isThisMonth, money, pct, type State } from '../data'

/**
 * Respostas e insights calculados localmente a partir dos dados do app.
 * Servem de demonstração enquanto a OpenAI (rota /api/chat) não está ligada.
 * Formato: número primeiro, consequência em uma linha.
 */

export interface Answer {
  text: string
  highlight?: { kicker: string; value: string; note: string }
}

const DELIVERY = /ifood|rappi|delivery|restaurante|uber eats/i

function facts(s: State) {
  const month = s.transactions.filter((t) => isThisMonth(t.date))
  const total = month.reduce((n, t) => n + t.value, 0)
  const delivery = month.filter((t) => DELIVERY.test(t.name)).reduce((n, t) => n + t.value, 0)
  const subs = month.filter((t) => t.subscription)
  const subsByName = new Map<string, number>()
  subs.forEach((t) => subsByName.set(t.name, Math.max(subsByName.get(t.name) ?? 0, t.value)))
  const subsSorted = [...subsByName.entries()].sort((a, b) => b[1] - a[1])
  const trip = s.goals[0]
  return { total, delivery, subsSorted, trip }
}

/** Card de insight em Metas. */
export function topInsight(s: State): string {
  const f = facts(s)
  if (f.subsSorted.length >= 2) {
    const two = f.subsSorted.slice(0, 2).reduce((n, [, v]) => n + v, 0)
    return `Cancelando 2 assinaturas, você guarda ${money(Math.round(two))} a mais por mês.`
  }
  if (f.delivery > 0) {
    return `Reduzindo delivery em 25%, você guarda ${money(Math.round(f.delivery * 0.25))} por mês.`
  }
  if (f.trip) return `Guardando ${money(500)} por mês, ${f.trip.name} chega em ${Math.ceil(Math.max(0, f.trip.target - f.trip.saved) / 500)} meses.`
  return 'Registre seus gastos para receber o primeiro insight.'
}

export function localAnswer(question: string, s: State): Answer {
  const q = question.toLowerCase()
  const f = facts(s)

  if (/delivery|ifood|restaurante|comida/.test(q)) {
    const diff = s.lastMonthTotal ? pct(f.delivery, s.lastMonthTotal) : 0
    return {
      text: `Foram ${money(f.delivery)} com delivery e restaurantes este mês${diff ? `, ${diff}% do que você gastou no mês passado inteiro` : ''}.`,
    }
  }
  if (/viagem|guardar|guardo|economizar|meta|objetivo/.test(q) && f.trip) {
    const cut = Math.round(f.delivery * 0.25 * 100) / 100
    if (cut === 0) return { text: `Faltam ${money(Math.max(0, f.trip.target - f.trip.saved))} para ${f.trip.name}. Ainda não há gastos com delivery neste mês para simular uma redução.` }
    const left = Math.max(0, f.trip.target - f.trip.saved)
    const before = Math.max(0, Math.ceil(left / 500) - Math.ceil(left / (500 + cut)))
    return {
      text: `Faltam ${money(left)} para ${f.trip.name}.`,
      highlight: { kicker: 'Reduzindo delivery, você guarda', value: `${money(cut)} / mês`, note: `Simulação: guardando R$ 500/mês + essa economia, o prazo cai de ${Math.ceil(left / 500)} para ${Math.ceil(left / (500 + cut))} meses (${before} ${before === 1 ? 'mês' : 'meses'} antes).` },
    }
  }
  if (/assinatura|netflix|spotify|recorrente/.test(q)) {
    if (!f.subsSorted.length) return { text: 'Ainda não encontrei assinaturas. Importe uma fatura para eu identificar as cobranças recorrentes.' }
    const sum = f.subsSorted.reduce((n, [, v]) => n + v, 0)
    return {
      text: `Você tem ${f.subsSorted.length} assinaturas, somando ${money(sum, true)} por mês. As maiores: ${f.subsSorted.slice(0, 2).map(([n]) => n).join(' e ')}.`,
      highlight: { kicker: 'Cancelando as 2 maiores', value: `+ ${money(Math.round(f.subsSorted.slice(0, 2).reduce((n, [, v]) => n + v, 0)))} / mês`, note: 'Esse valor pode ir direto para a sua meta.' },
    }
  }
  if (/fatura|cart[aã]o|limite/.test(q)) {
    const next = [...s.cards].sort((a, b) => a.dueDays - b.dueDays)[0]
    if (!next) return { text: 'Você ainda não cadastrou cartões.' }
    return { text: `A próxima fatura é do ${next.name}: ${money(next.invoice)}, vence em ${next.dueDays} dias. Limite usado: ${pct(next.invoice, next.limit)}%.` }
  }
  const room = s.monthCap - f.total
  const capLine = s.monthCap <= 0 ? 'nenhum teto mensal foi definido'
    : room >= 0
      ? `ainda cabem ${money(room)} no teto de ${money(s.monthCap)}`
      : `você passou ${money(-room)} do teto de ${money(s.monthCap)}`
  if (/saldo|quanto tenho/.test(q)) {
    return { text: `Seu saldo é ${money(s.balance)}. Este mês saíram ${money(f.total)} e ${capLine}.` }
  }
  if (/^(oi|ol[áa]|bom dia|boa tarde|boa noite|e a[íi]|hey)\b/.test(q.trim())) {
    return { text: `Oi, ${s.user.name}! Este mês saíram ${money(f.total)} e ${capLine}. Quer ver delivery, assinaturas, fatura ou como chegar mais rápido numa meta?` }
  }
  return {
    text: `Ainda não sei responder isso com os seus dados. Este mês saíram ${money(f.total)} e ${capLine}. Pergunte sobre delivery, assinaturas, fatura, saldo ou metas.`,
  }
}
