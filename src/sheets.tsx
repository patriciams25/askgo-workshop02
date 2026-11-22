import { useState, type FormEvent } from 'react'
import { CATEGORIES, TODAY, iso, money, type CardColor, type CategoryId, type Transaction } from './data'
import { uid, useStore } from './store'
import { CATEGORY_ICON, Icon } from './components/Icon'
import { Field, GhostButton, PrimaryButton, Sheet, inputCls, parseMoney } from './components/ui'
import { supabase } from './lib/supabase'

export type SheetState =
  | { kind: 'add' }
  | { kind: 'edit'; tx: Transaction }
  | { kind: 'card'; cardId?: string }
  | { kind: 'goal'; goalId?: string }
  | { kind: 'save'; goalId: string }
  | { kind: 'budget'; category: CategoryId }
  | { kind: 'account' }
  | { kind: 'monthBudget' }
  | { kind: 'balance' }

type Done = (msg: string) => void

export function Sheets({ sheet, close, done }: { sheet: SheetState | null; close: () => void; done: Done }) {
  if (!sheet) return null
  switch (sheet.kind) {
    case 'add': return <ExpenseSheet close={close} done={done} />
    case 'edit': return <ExpenseSheet close={close} done={done} tx={sheet.tx} />
    case 'card': return <CardSheet key={sheet.cardId ?? 'new'} close={close} done={done} cardId={sheet.cardId} />
    case 'goal': return <GoalSheet key={sheet.goalId ?? 'new'} close={close} done={done} goalId={sheet.goalId} />
    case 'save': return <SaveSheet close={close} done={done} goalId={sheet.goalId} />
    case 'budget': return <BudgetSheet close={close} done={done} category={sheet.category} />
    case 'balance': return <BalanceSheet close={close} done={done} />
    case 'monthBudget': return <MonthBudgetSheet close={close} done={done} />
    case 'account': return <AccountSheet close={close} done={done} />
  }
}

/* ---------- Adicionar / editar gasto ---------- */
function ExpenseSheet({ close, done, tx }: { close: () => void; done: Done; tx?: Transaction }) {
  const { state, dispatch } = useStore()
  const [value, setValue] = useState(tx ? String(tx.value).replace('.', ',') : '')
  const [name, setName] = useState(tx?.name ?? '')
  const [category, setCategory] = useState<CategoryId>(tx?.category ?? 'alimentacao')
  const [method, setMethod] = useState(tx?.method ?? (state.frontCardId || state.cards[0]?.id || 'pix'))
  const [date, setDate] = useState(tx?.date ?? iso(TODAY))
  const [error, setError] = useState('')
  const [confirmDelete, setConfirmDelete] = useState(false)

  const submit = (e: FormEvent) => {
    e.preventDefault()
    const v = parseMoney(value)
    if (v <= 0) return setError('Digite um valor válido para a compra.')
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(new Date(date).getTime())) return setError('Informe uma data válida.')
    const data: Transaction = {
      ...tx,
      id: tx?.id ?? uid(),
      name: name.trim() || CATEGORIES.find((c) => c.id === category)!.label,
      category, method, date, value: v,
    }
    dispatch(tx ? { type: 'tx/update', tx: data } : { type: 'tx/add', tx: data })
    done(tx ? 'Gasto atualizado' : `${money(v, true)} registrado`)
  }

  const methods = [...state.cards.map((c) => ({ id: c.id, label: `${c.name} •• ${c.last4}` })), { id: 'pix', label: 'Pix' }, { id: 'dinheiro', label: 'Dinheiro' }]

  return (
    <Sheet title={tx ? 'Detalhe da compra' : 'Adicionar gasto'} onClose={close}>
      <form onSubmit={submit} className="flex flex-col gap-5" noValidate>
        <Field label="Valor da compra" error={error}>
          <div className="flex items-baseline gap-2 border-b border-esk-track pb-2 focus-within:border-esk-lime">
            <span className="text-[24px] text-esk-muted">R$</span>
            <input
              inputMode="decimal" placeholder="0,00" value={value}
              onChange={(e) => { setValue(e.target.value); setError('') }}
              className="num w-full bg-transparent text-[44px] font-medium leading-none text-esk-text outline-none placeholder:text-esk-track"
              aria-invalid={!!error}
            />
          </div>
        </Field>

        <Field label="Descrição (opcional)">
          <input className={inputCls} placeholder="Ex.: Mercado" value={name} onChange={(e) => setName(e.target.value)} />
        </Field>

        <fieldset className="flex flex-col gap-2">
          <legend className="mb-2 text-[13px] text-esk-text-2">Categoria</legend>
          <div className="grid grid-cols-3 gap-2">
            {CATEGORIES.map((c) => (
              <button
                type="button" key={c.id} onClick={() => setCategory(c.id)} aria-pressed={category === c.id}
                className={`flex h-[64px] flex-col items-start justify-between rounded-[16px] px-3 py-2.5 text-[12px] transition
                  ${category === c.id ? 'bg-esk-lime text-esk-ink' : 'bg-esk-elevated text-esk-text hover:bg-esk-row'}`}
              >
                <Icon name={CATEGORY_ICON[c.id]} size={18} strokeWidth={1.6} />
                {c.label}
              </button>
            ))}
          </div>
        </fieldset>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Cartão">
            <select className={inputCls} value={method} onChange={(e) => setMethod(e.target.value)}>
              {methods.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
            </select>
          </Field>
          <Field label="Data">
            <input type="date" className={inputCls} value={date} onChange={(e) => setDate(e.target.value)} />
          </Field>
        </div>

        <PrimaryButton type="submit">{tx ? 'Salvar alterações' : 'Salvar'}</PrimaryButton>

        {tx && !confirmDelete && (
          <button type="button" onClick={() => setConfirmDelete(true)} className="flex items-center justify-center gap-2 text-[14px] text-esk-text-2 hover:text-esk-text">
            <Icon name="trash" size={16} /> Apagar gasto
          </button>
        )}
        {tx && confirmDelete && (
          <div className="flex flex-col gap-3 rounded-[20px] bg-esk-bg-2 p-4">
            <span className="text-[14px]">Apagar {tx.name} ({money(tx.value, true)})? O saldo volta.</span>
            <div className="grid grid-cols-2 gap-2">
              <GhostButton type="button" onClick={() => setConfirmDelete(false)}>Cancelar</GhostButton>
              <PrimaryButton type="button" onClick={() => { dispatch({ type: 'tx/delete', id: tx.id }); done('Gasto apagado') }}>Apagar</PrimaryButton>
            </div>
          </div>
        )}
      </form>
    </Sheet>
  )
}

/* ---------- Novo cartão ---------- */
function CardSheet({ close, done, cardId }: { close: () => void; done: Done; cardId?: string }) {
  const { state, dispatch } = useStore()
  const card = state.cards.find((item) => item.id === cardId)
  const [name, setName] = useState(card?.name ?? '')
  const [last4, setLast4] = useState(card?.last4 ?? '')
  const [limit, setLimit] = useState(card ? String(card.limit).replace('.', ',') : '')
  const [invoice, setInvoice] = useState(card ? String(card.invoice).replace('.', ',') : '')
  const [dueDays, setDueDays] = useState(String(card?.dueDays ?? 10))
  const [color, setColor] = useState<CardColor>(card?.color ?? 'gradient')
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [confirmDelete, setConfirmDelete] = useState(false)

  const submit = (e: FormEvent) => {
    e.preventDefault()
    const errs: Record<string, string> = {}
    if (!name.trim()) errs.name = 'Dê um apelido ao cartão.'
    if (!/^\d{4}$/.test(last4)) errs.last4 = 'Os 4 últimos dígitos.'
    if (parseMoney(limit) <= 0) errs.limit = 'Informe o limite.'
    if (invoice.trim() && parseMoney(invoice) <= 0 && !/^0(?:,0{1,2})?$/.test(invoice.trim())) errs.invoice = 'Informe um valor válido, igual ou maior que zero.'
    if (Number(dueDays) < 1 || Number(dueDays) > 31) errs.dueDays = 'Use de 1 a 31 dias.'
    setErrors(errs)
    if (Object.keys(errs).length) return
    dispatch({ type: card ? 'card/update' : 'card/add', card: { id: card?.id ?? uid(), name: name.trim(), last4, color, limit: parseMoney(limit), invoice: parseMoney(invoice), dueDays: Number(dueDays) || 10 } })
    done(card ? 'Cartão atualizado' : 'Cartão adicionado')
  }

  const swatches: { id: CardColor; cls: string; label: string }[] = [
    { id: 'gradient', cls: 'bg-wallet', label: 'Gradiente' },
    { id: 'lilac', cls: 'bg-esk-lilac-strong', label: 'Lilás' },
    { id: 'offwhite', cls: 'bg-esk-offwhite', label: 'Off-white' },
  ]

  return (
    <Sheet title={card ? 'Editar cartão' : 'Novo cartão'} onClose={close}>
      <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
        <Field label="Apelido" error={errors.name}><input className={inputCls} placeholder="Ex.: Principal" value={name} onChange={(e) => setName(e.target.value)} /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Final" error={errors.last4}><input className={inputCls} inputMode="numeric" maxLength={4} placeholder="4552" value={last4} onChange={(e) => setLast4(e.target.value.replace(/\D/g, ''))} /></Field>
          <Field label="Vence em (dias)" error={errors.dueDays}><input className={inputCls} inputMode="numeric" value={dueDays} onChange={(e) => setDueDays(e.target.value.replace(/\D/g, ''))} /></Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Limite (R$)" error={errors.limit}><input className={inputCls} inputMode="decimal" placeholder="3.000" value={limit} onChange={(e) => setLimit(e.target.value)} /></Field>
          <Field label="Fatura atual (R$)" error={errors.invoice}><input className={inputCls} inputMode="decimal" placeholder="0" value={invoice} onChange={(e) => setInvoice(e.target.value)} /></Field>
        </div>
        <fieldset>
          <legend className="mb-2 text-[13px] text-esk-text-2">Cor</legend>
          <div className="flex gap-3">
            {swatches.map((s) => (
              <button type="button" key={s.id} aria-label={s.label} aria-pressed={color === s.id} onClick={() => setColor(s.id)}
                className={`${s.cls} size-11 rounded-full ring-offset-2 ring-offset-esk-sheet transition ${color === s.id ? 'ring-2 ring-esk-lime' : ''}`} />
            ))}
          </div>
        </fieldset>
        <PrimaryButton type="submit" className="mt-2">{card ? 'Salvar cartão' : 'Adicionar cartão'}</PrimaryButton>
        {card && !confirmDelete && <button type="button" onClick={() => setConfirmDelete(true)} className="py-2 text-[14px] text-esk-text-2 hover:text-esk-lilac">Remover cartão</button>}
        {card && confirmDelete && (
          <div className="flex flex-col gap-3 rounded-[20px] bg-esk-bg-2 p-4">
            <span className="text-[14px]">Remover {card.name}? As compras registradas serão mantidas no histórico.</span>
            <div className="grid grid-cols-2 gap-2">
              <GhostButton type="button" onClick={() => setConfirmDelete(false)}>Cancelar</GhostButton>
              <PrimaryButton type="button" onClick={() => { dispatch({ type: 'card/delete', id: card.id }); done('Cartão removido') }}>Remover</PrimaryButton>
            </div>
          </div>
        )}
      </form>
    </Sheet>
  )
}

/* ---------- Nova meta ---------- */
function GoalSheet({ close, done, goalId }: { close: () => void; done: Done; goalId?: string }) {
  const { state, dispatch } = useStore()
  const goal = state.goals.find((item) => item.id === goalId)
  const [name, setName] = useState(goal?.name ?? '')
  const [target, setTarget] = useState(goal ? String(goal.target).replace('.', ',') : '')
  const [date, setDate] = useState(goal?.date ?? '')
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [confirmDelete, setConfirmDelete] = useState(false)

  const submit = (e: FormEvent) => {
    e.preventDefault()
    const errs: Record<string, string> = {}
    if (!name.trim()) errs.name = 'Dê um nome à meta.'
    if (parseMoney(target) <= 0) errs.target = 'Quanto você quer juntar?'
    if (goal && parseMoney(target) < goal.saved) errs.target = `O valor alvo não pode ser menor que o já guardado (${money(goal.saved)}).`
    setErrors(errs)
    if (Object.keys(errs).length) return
    const updated = { id: goal?.id ?? uid(), name: name.trim(), saved: goal?.saved ?? 0, target: parseMoney(target), date: date.trim() || undefined, icon: goal?.icon ?? 'star' }
    dispatch(goal ? { type: 'goal/update', goal: updated } : { type: 'goal/add', goal: updated })
    done(goal ? 'Objetivo atualizado' : 'Objetivo criado')
  }

  return (
    <Sheet title={goal ? 'Editar objetivo' : 'Novo objetivo'} onClose={close}>
      <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
        <Field label="Nome" error={errors.name}><input className={inputCls} placeholder="Ex.: Viagem ao Japão" value={name} onChange={(e) => setName(e.target.value)} /></Field>
        <Field label="Valor alvo (R$)" error={errors.target}><input className={inputCls} inputMode="decimal" placeholder="20.000" value={target} onChange={(e) => setTarget(e.target.value)} /></Field>
        <Field label="Quando (opcional)"><input className={inputCls} placeholder="Dez 2027" value={date} onChange={(e) => setDate(e.target.value)} /></Field>
        <PrimaryButton type="submit" className="mt-2">{goal ? 'Salvar alterações' : 'Criar objetivo'}</PrimaryButton>
        {goal && !confirmDelete && <button type="button" onClick={() => setConfirmDelete(true)} className="py-2 text-[14px] text-esk-text-2 hover:text-esk-lilac">Excluir objetivo</button>}
        {goal && confirmDelete && <div className="flex flex-col gap-3 rounded-[20px] bg-esk-bg-2 p-4">
          <span className="text-[14px]">Excluir {goal.name}? Os {money(goal.saved)} guardados voltarão ao saldo disponível.</span>
          <div className="grid grid-cols-2 gap-2">
            <GhostButton type="button" onClick={() => setConfirmDelete(false)}>Cancelar</GhostButton>
            <PrimaryButton type="button" onClick={() => { dispatch({ type: 'goal/delete', id: goal.id }); done('Objetivo excluído; valor devolvido ao saldo') }}>Excluir</PrimaryButton>
          </div>
        </div>}
      </form>
    </Sheet>
  )
}

/* ---------- Guardar valor ---------- */
function SaveSheet({ close, done, goalId }: { close: () => void; done: Done; goalId: string }) {
  const { state, dispatch } = useStore()
  const goal = state.goals.find((g) => g.id === goalId)
  const [value, setValue] = useState('500')
  const [error, setError] = useState('')
  if (!goal) return null

  const submit = (e: FormEvent) => {
    e.preventDefault()
    const v = parseMoney(value)
    if (v <= 0) return setError('Digite quanto guardou.')
    if (v > state.balance) return setError('Seu saldo disponível é ' + money(state.balance, true) + '.')
    dispatch({ type: 'goal/save', id: goal.id, amount: v })
    done(`${money(v)} guardado em ${goal.name}`)
  }

  return (
    <Sheet title={`Guardar · ${goal.name}`} onClose={close}>
      <form onSubmit={submit} className="flex flex-col gap-5" noValidate>
        <span className="text-[14px] text-esk-text-2">Já guardado {money(goal.saved)} de {money(goal.target)}</span>
        <Field label="Quanto você guardou" error={error}>
          <div className="flex items-baseline gap-2 border-b border-esk-track pb-2 focus-within:border-esk-lime">
            <span className="text-[24px] text-esk-muted">R$</span>
            <input inputMode="decimal" value={value} onChange={(e) => { setValue(e.target.value); setError('') }}
              className="num w-full bg-transparent text-[44px] font-medium leading-none outline-none" />
          </div>
        </Field>
        <div className="flex gap-2">
          {[100, 250, 500, 1000].map((n) => (
            <button type="button" key={n} onClick={() => setValue(String(n))} className="h-10 flex-1 rounded-full bg-esk-elevated text-[13px] hover:bg-esk-row">{money(n)}</button>
          ))}
        </div>
        <PrimaryButton type="submit">Guardar</PrimaryButton>
      </form>
    </Sheet>
  )
}

/* ---------- Ajustar teto ---------- */
function BudgetSheet({ close, done, category }: { close: () => void; done: Done; category: CategoryId }) {
  const { state, dispatch } = useStore()
  const label = CATEGORIES.find((c) => c.id === category)!.label
  const [value, setValue] = useState(String(state.budgets[category]).replace('.', ','))
  const [error, setError] = useState('')
  const [confirmDelete, setConfirmDelete] = useState(false)
  const submit = (e: FormEvent) => {
    e.preventDefault()
    const v = parseMoney(value)
    if (v <= 0) return setError('Informe um teto maior que zero.')
    dispatch({ type: 'budget/set', category, cap: v })
    done(`Teto de ${label}: ${money(v)}`)
  }
  return (
    <Sheet title={`Teto · ${label}`} onClose={close}>
      <form onSubmit={submit} className="flex flex-col gap-5" noValidate>
        <Field label="Quanto pode gastar no mês" error={error}>
          <div className="flex items-baseline gap-2 border-b border-esk-track pb-2 focus-within:border-esk-lime">
            <span className="text-[24px] text-esk-muted">R$</span>
            <input inputMode="decimal" value={value} onChange={(e) => setValue(e.target.value)}
              className="num w-full bg-transparent text-[44px] font-medium leading-none outline-none" />
          </div>
        </Field>
        <PrimaryButton type="submit">Salvar teto</PrimaryButton>
        {state.budgets[category] > 0 && !confirmDelete && <button type="button" onClick={() => setConfirmDelete(true)} className="py-2 text-[14px] text-esk-text-2 hover:text-esk-lilac">Remover teto da categoria</button>}
        {state.budgets[category] > 0 && confirmDelete && <div className="flex flex-col gap-3 rounded-[20px] bg-esk-bg-2 p-4">
          <span className="text-[14px]">Remover o teto de {label}? Os gastos continuarão registrados.</span>
          <div className="grid grid-cols-2 gap-2">
            <GhostButton type="button" onClick={() => setConfirmDelete(false)}>Cancelar</GhostButton>
            <PrimaryButton type="button" onClick={() => { dispatch({ type: 'budget/delete', category }); done(`Teto de ${label} removido`) }}>Remover</PrimaryButton>
          </div>
        </div>}
      </form>
    </Sheet>
  )
}

/* ---------- Conta ---------- */
function AccountSheet({ close, done }: { close: () => void; done: Done }) {
  const { state, dispatch } = useStore()
  const [confirm, setConfirm] = useState(false)
  return (
    <Sheet title="Conta" onClose={close}>
      <div className="flex flex-col gap-5">
        <div className="flex items-center gap-4">
          <span className="bg-hero grid size-14 place-items-center rounded-full text-[22px] font-bold text-esk-ink">{state.user.name[0]}</span>
          <span className="flex flex-col">
            <span className="text-[18px] font-medium">{state.user.name}</span>
            <span className="text-[14px] text-esk-text-2">{state.user.email}</span>
          </span>
        </div>
        <button onClick={() => dispatch({ type: 'balance/toggle' })} className="flex items-center justify-between rounded-[20px] bg-esk-elevated px-5 py-4 text-left" role="switch" aria-checked={state.hideBalance}>
          <span className="text-[15px]">Ocultar saldo</span>
          <span className={`flex h-7 w-12 items-center rounded-full p-1 transition ${state.hideBalance ? 'bg-esk-lime' : 'bg-esk-track'}`}>
            <span className={`size-5 rounded-full transition ${state.hideBalance ? 'translate-x-5 bg-esk-ink' : 'bg-esk-text-2'}`} />
          </span>
        </button>
        <button onClick={() => dispatch({ type: 'plus/toggle' })} className="flex items-center justify-between gap-4 rounded-[20px] bg-esk-elevated px-5 py-4 text-left" role="switch" aria-checked={!!state.plus}>
          <span className="flex flex-col gap-0.5">
            <span className="text-[15px]">Eskgo Plus · IA</span>
            <span className="text-[12px] text-esk-muted">Fatura e Assistente (estágio 2)</span>
          </span>
          <span className={`flex h-7 w-12 shrink-0 items-center rounded-full p-1 transition ${state.plus ? 'bg-esk-lilac-strong' : 'bg-esk-track'}`}>
            <span className={`size-5 rounded-full transition ${state.plus ? 'translate-x-5 bg-esk-ink' : 'bg-esk-text-2'}`} />
          </span>
        </button>
        {!confirm ? (
          <GhostButton onClick={() => setConfirm(true)} className="flex items-center justify-center gap-2">
            <Icon name="logout" size={18} /> Sair
          </GhostButton>
        ) : (
          <div className="flex flex-col gap-3 rounded-[20px] bg-esk-bg-2 p-4">
            <span className="text-[15px]">Deseja sair?</span>
            <div className="grid grid-cols-2 gap-2">
              <GhostButton onClick={() => setConfirm(false)}>Cancelar</GhostButton>
              <PrimaryButton onClick={async () => {
                if (supabase) {
                  const { error } = await supabase.auth.signOut()
                  if (error) { done('Não foi possível sair. Tente novamente.'); return }
                }
                dispatch({ type: 'session/set', signedOut: true })
                done('Você saiu deste dispositivo.')
              }}>Sair</PrimaryButton>
            </div>
          </div>
        )}
      </div>
    </Sheet>
  )
}

function MonthBudgetSheet({ close, done }: { close: () => void; done: Done }) {
  const { state, dispatch } = useStore()
  const [value, setValue] = useState(String(state.monthCap).replace('.', ','))
  const [error, setError] = useState('')
  const [confirmDelete, setConfirmDelete] = useState(false)
  return <Sheet title="Teto do mês" onClose={close}>
    <form className="flex flex-col gap-5" noValidate onSubmit={(event) => {
      event.preventDefault()
      const cap = parseMoney(value)
      if (cap <= 0) return setError('Informe um teto maior que zero.')
      dispatch({ type: 'monthCap/set', cap })
      done('Teto do mês atualizado')
    }}>
      <Field label="Quanto você pode gastar no mês (R$)" error={error}>
        <input className={inputCls} inputMode="decimal" value={value} onChange={(event) => { setValue(event.target.value); setError('') }} />
      </Field>
      <PrimaryButton type="submit">Salvar teto</PrimaryButton>
      {state.monthCap > 0 && !confirmDelete && <button type="button" onClick={() => setConfirmDelete(true)} className="py-2 text-[14px] text-esk-text-2 hover:text-esk-lilac">Remover teto mensal</button>}
      {state.monthCap > 0 && confirmDelete && <div className="flex flex-col gap-3 rounded-[20px] bg-esk-bg-2 p-4">
        <span className="text-[14px]">Remover o teto mensal? Os gastos continuarão registrados.</span>
        <div className="grid grid-cols-2 gap-2">
          <GhostButton type="button" onClick={() => setConfirmDelete(false)}>Cancelar</GhostButton>
          <PrimaryButton type="button" onClick={() => { dispatch({ type: 'monthCap/delete' }); done('Teto mensal removido') }}>Remover</PrimaryButton>
        </div>
      </div>}
    </form>
  </Sheet>
}

function BalanceSheet({ close, done }: { close: () => void; done: Done }) {
  const { state, dispatch } = useStore()
  const [value, setValue] = useState(String(state.balance).replace('.', ','))
  const [error, setError] = useState('')
  return <Sheet title="Registrar saldo" onClose={close}>
    <form className="flex flex-col gap-5" noValidate onSubmit={(event) => {
      event.preventDefault()
      const amount = parseMoney(value)
      if (amount <= 0 && !/^0(?:,0{1,2})?$/.test(value.trim())) return setError('Informe um saldo válido, igual ou maior que zero.')
      dispatch({ type: 'balance/set', value: amount })
      done('Saldo atualizado')
    }}>
      <p className="text-[14px] text-esk-text-2">Informe o dinheiro disponível para começar. Ajustar o saldo não cria um gasto.</p>
      <Field label="Saldo disponível (R$)" error={error}><input inputMode="decimal" className={inputCls} value={value} onChange={(event) => { setValue(event.target.value); setError('') }} /></Field>
      <PrimaryButton type="submit">Salvar saldo</PrimaryButton>
    </form>
  </Sheet>
}
