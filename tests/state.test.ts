import assert from 'node:assert/strict'
import { reducer } from '../src/store'
import { emptyState, initialState, iso, TODAY } from '../src/data'
import { mockInvoice } from '../src/services/invoiceMock'
import { localAnswer } from '../src/services/insights'

const before = structuredClone(initialState)
const tx = { id: 'test', name: 'Café', value: 25.5, method: 'principal', category: 'alimentacao' as const, date: iso(TODAY) }
let state = reducer(before, { type: 'tx/add', tx })
assert.equal(state.balance, 14474.5)
assert.equal(state.cards.find((card) => card.id === 'principal')?.invoice, 1309.5)
state = reducer(state, { type: 'tx/update', tx: { ...tx, value: 26.5, method: 'viagem' } })
assert.equal(state.balance, 14473.5)
assert.equal(state.cards.find((card) => card.id === 'principal')?.invoice, 1284)
assert.equal(state.cards.find((card) => card.id === 'viagem')?.invoice, 124.5)
state = reducer(state, { type: 'tx/delete', id: tx.id })
assert.deepEqual(state, before)

const invoice = mockInvoice()
assert.equal(invoice.items.length, 34)
assert.equal(invoice.items.filter((item) => item.subscription).length, 6)
assert.equal(Math.round(invoice.items.reduce((sum, item) => sum + item.value, 0) * 100), 128400)
const importAction = { type: 'invoice/import' as const, fingerprint: 'test-invoice', cardId: 'viagem', txs: [{ ...tx, value: 50, method: 'viagem', source: 'invoice' as const, invoiceId: 'test-invoice' }] }
state = reducer(before, importAction)
assert.equal(state.balance, 14450)
assert.equal(state.cards.find((card) => card.id === 'viagem')?.invoice, 148)
assert.equal(state.transactions.length, before.transactions.length + 1)
assert.equal(reducer(state, importAction), state)
state = reducer(state, { type: 'tx/delete', id: tx.id })
assert.equal(state.balance, before.balance)
assert.equal(state.importedInvoices?.includes('test-invoice'), false)
assert.equal(state.cards.find((card) => card.id === 'viagem')?.invoice, 98)

state = reducer(before, { type: 'goal/save', id: 'g1', amount: 500 })
assert.equal(state.balance, 14000)
assert.equal(state.goals[0].saved, 14100)
assert.deepEqual(state.transactions, before.transactions)
assert.equal(reducer(state, { type: 'goal/save', id: 'g1', amount: 14001 }), state)
assert.equal(reducer(state, { type: 'goal/save', id: 'missing', amount: 500 }), state)
const signedOut = reducer(state, { type: 'session/set', signedOut: true })
assert.equal(signedOut.balance, state.balance)
assert.deepEqual(signedOut.goals, state.goals)
assert.equal(reducer(signedOut, { type: 'auth/signIn' }).signedOut, false)
assert.equal(localAnswer('Quanto gastei com delivery?', before).text.includes('480'), true)
const empty = emptyState('Teste', 'teste@eskgo.local')
assert.equal(empty.transactions.length, 0)
assert.equal(empty.cards.length, 0)
assert.equal(empty.goals.length, 0)
assert.equal(localAnswer('Quando vence a fatura?', empty).text, 'Você ainda não cadastrou cartões.')
assert.deepEqual(before, initialState)
console.log('PASS: compras, troca de cartão, importação parcial, duplicidade, centavos, metas, saída, contexto e estados vazios.')

// Fatura lida substitui o valor digitado do cartão (sem contar duas vezes)
{
  const withTotal = reducer(before, { type: 'invoice/import', fingerprint: 'total-test', cardId: 'principal', total: 1284, txs: [{ ...tx, id: 'inv-1', value: 100, method: 'principal', source: 'invoice' as const, invoiceId: 'total-test' }] })
  assert.equal(withTotal.cards.find((card) => card.id === 'principal')?.invoice, 1284)
  assert.equal(withTotal.balance, 14400)
}
// Assistente: teto estourado e cumprimento
{
  const over = reducer(before, { type: 'monthCap/set', cap: 1000 })
  assert.match(localAnswer('Qual meu saldo?', over).text, /passou R\$ 1\.340 do teto/)
  assert.match(localAnswer('oi tudo bem?', before).text, /^Oi, Lucas!/)
  assert.match(localAnswer('qual a capital da França?', before).text, /Ainda não sei responder/)
}
console.log('PASS: fatura substitui total do cartão, teto estourado, cumprimento e pergunta fora do escopo.')
