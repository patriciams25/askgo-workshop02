import { useState } from 'react'
import { MONTHS_FULL, TODAY, catLabel, money, relDate, type Transaction } from '../data'
import { useMonth, useStore } from '../store'
import { CATEGORY_ICON, Icon, type IconName } from '../components/Icon'
import { CountUp, Empty } from '../components/ui'
import type { Nav } from '../App'

const TILE_BG = ['bg-esk-lilac', 'bg-esk-lime', 'bg-esk-offwhite']
const SEG_BG = ['var(--esk-lilac)', 'var(--esk-lime)', 'var(--esk-offwhite)', 'var(--esk-lilac-strong)', '#8f8f96', '#5a5a60']

export function Home({ nav }: { nav: Nav }) {
  const { state, dispatch } = useStore()
  const m = useMonth(state)
  const [showAll, setShowAll] = useState(false)

  const sorted = [...state.transactions].sort((a, b) => b.date.localeCompare(a.date))
  const list = showAll ? sorted : sorted.slice(0, 4)
  const hidden = state.hideBalance
  const methodLabel = (t: Transaction) => {
    const c = state.cards.find((c) => c.id === t.method)
    if (c) return `${c.name} • ${c.last4}`
    if (t.method === 'pix') return 'Pix'
    if (t.method === 'dinheiro') return 'Dinheiro'
    return 'Cartão removido'
  }

  return (
    <div className="flex flex-col gap-5 lg:gap-8">
      {/* Header */}
      <header className="flex items-center justify-between">
        <button onClick={() => nav.sheet({ kind: 'account' })} className="flex items-center gap-3 text-left lg:gap-4" aria-label="Abrir conta">
          <span className="grid size-11 place-items-center rounded-full bg-hero text-[17px] font-bold text-esk-ink lg:size-12">
            {state.user.name[0]}
          </span>
          <span className="flex flex-col">
            <span className="text-[12px] text-esk-text-2 lg:text-[13px]">Seu dinheiro, com clareza</span>
            <span className="text-[18px] font-medium tracking-[-0.02em] lg:text-[20px]">Olá, {state.user.name}</span>
          </span>
        </button>
        <span className="kicker hidden lg:block">Eskgo · {MONTHS_FULL[TODAY.getMonth()]}</span>
      </header>

      {/* Hero + atalhos */}
      <section className="flex flex-col gap-5 lg:grid lg:grid-cols-12 lg:gap-5">
        <div className="bg-hero flex min-h-[238px] flex-col justify-between gap-5 rounded-hero p-6 text-esk-ink lg:col-span-8 lg:min-h-[280px] lg:px-9 lg:py-8">
          <div className="flex items-center justify-between">
            <span className="text-[20px] font-bold tracking-[-0.04em] lg:text-[24px]">Eskgo</span>
            <span className="flex items-center gap-2">
            {state.plus && (
              <button onClick={() => nav.go('assistente')} aria-label="Abrir assistente"
                className="flex h-10 items-center gap-2 rounded-full bg-esk-ink/90 px-3.5 text-[13px] font-medium text-esk-text transition hover:bg-esk-ink">
                <Icon name="sparkle" size={15} /> <span className="hidden sm:inline">Assistente</span>
              </button>
            )}
            <button
              aria-label={hidden ? 'Mostrar saldo' : 'Ocultar saldo'}
              onClick={() => dispatch({ type: 'balance/toggle' })}
              className="-m-2 grid size-11 place-items-center rounded-full transition hover:bg-black/5"
            >
              <Icon name={hidden ? 'eyeOff' : 'eye'} size={22} strokeWidth={1.8} />
            </button>
            </span>
          </div>
          <div className="flex flex-col gap-3 lg:gap-4">
            <div className="flex items-center justify-between"><span className="text-[15px]">Seu saldo</span><button className="rounded-full px-3 py-1 text-[12px] underline underline-offset-4" onClick={() => nav.sheet({ kind: 'balance' })}>Ajustar saldo</button></div>
            <span className="num text-[44px] font-medium leading-none lg:text-[66px]">
              {hidden ? 'R$ ••••••' : <CountUp value={state.balance} format={(n) => money(n, state.balance % 1 !== 0)} />}
            </span>
            <span className="flex items-center gap-2 text-[13px] lg:text-[15px]">
              <Icon name="check" size={16} strokeWidth={2} /> Tudo em um só lugar.
            </span>
          </div>
        </div>

        <div className={`grid gap-2.5 lg:col-span-4 lg:grid-cols-1 lg:gap-3 ${state.plus ? 'grid-cols-4 lg:grid-rows-4' : 'grid-cols-3 lg:grid-rows-3'}`}>
          <Shortcut icon="plus" label="Adicionar" primary onClick={() => nav.sheet({ kind: 'add' })} />
          {state.plus && <Shortcut icon="file" label="Fatura" onClick={() => nav.go('fatura')} />}
          <Shortcut icon="card" label="Cartões" onClick={() => nav.go('cartoes')} />
          <Shortcut icon="target" label="Metas" onClick={() => nav.go('metas')} />
        </div>
      </section>

      {/* Este mês + Transações */}
      <section className="flex flex-col gap-5 lg:grid lg:grid-cols-12 lg:items-start lg:gap-5">
        <div className="flex flex-col gap-5 lg:col-span-7 lg:rounded-hero lg:bg-esk-surface lg:p-8 lg:gap-6">
          <div className="mt-2 flex items-center justify-between lg:mt-0">
            <span className="kicker">Este mês</span>
            <span className="flex items-center gap-2 rounded-[12px] bg-esk-elevated px-3 py-2 text-[13px] lg:bg-esk-border lg:text-[14px]">
              {MONTHS_FULL[TODAY.getMonth()]}
            </span>
          </div>

          <div className="flex items-end justify-between gap-4">
            <span className="num text-[36px] font-medium leading-none lg:text-[48px]"><CountUp value={m.total} format={(n) => money(n, m.total % 1 !== 0)} /></span>
            <span className="flex flex-col items-end gap-0.5 text-right">
              <span className="flex items-center gap-1 text-[13px] text-esk-lime lg:text-[15px]">
                <Icon name={m.diff <= 0 ? 'arrowDownRight' : 'arrowUpRight'} size={14} />
                {Math.abs(m.diff)}% {m.diff <= 0 ? 'menos' : 'mais'}
              </span>
              <span className="text-[11px] text-esk-muted lg:text-[13px]">que em {MONTHS_FULL[(TODAY.getMonth() + 11) % 12].toLowerCase()}</span>
            </span>
          </div>

          <div className="flex flex-col gap-3">
            <div className="flex justify-between text-[12px] lg:text-[14px]">
              <span className={m.available == null || m.available >= 0 ? 'text-esk-lime' : 'text-esk-lilac-strong'}>
                {m.available == null ? 'Teto mensal não definido' : m.available >= 0 ? `${money(m.available)} ainda disponíveis` : `${money(-m.available)} acima do teto`}
              </span>
              <span className="text-esk-muted">{state.monthCap > 0 ? `Teto de ${money(state.monthCap)}` : 'Sem teto mensal'}</span>
            </div>
            <div className="flex h-[9px] gap-1 lg:h-[10px] lg:gap-1.5">
              {m.top.length === 0 && <span className="flex-1 rounded-[14px] bg-esk-track" />}
              {m.top.map((c, i) => (
                <span key={c.id} className="rounded-[14px] transition-all duration-500" style={{ flex: c.spent, background: SEG_BG[i] }} />
              ))}
            </div>
          </div>

          {m.top.length > 0 ? (
            <div className="grid grid-cols-3 gap-2.5 lg:gap-3">
              {m.top.slice(0, 3).map((c, i) => (
                <div key={c.id} className={`${TILE_BG[i]} flex h-[140px] flex-col gap-1 rounded-tile p-3.5 text-esk-ink lg:h-[160px] lg:p-5`}>
                  <Icon name={CATEGORY_ICON[c.id]} size={24} strokeWidth={1.6} />
                  <span className="mt-auto text-[11px] lg:text-[13px]">{c.label}</span>
                  <span className="num text-[18px] font-bold lg:text-[24px]">{money(c.spent)}</span>
                  <span className="text-[10px] text-[#3a3a40] lg:text-[12px]">{c.share}% do total</span>
                </div>
              ))}
            </div>
          ) : (
            <Empty title="Nenhum gasto neste mês" hint="Toque em Adicionar e digite sua primeira compra." />
          )}
        </div>

        <div className="flex flex-col rounded-hero bg-esk-surface p-5 lg:col-span-5 lg:p-8">
          <div className="mb-1 mt-2 flex items-center justify-between lg:mt-0 lg:mb-2">
            <span className="kicker">Transações</span>
            <span className="text-[11px] text-esk-muted lg:text-[13px]">Registradas por você</span>
          </div>
          {list.length === 0 && <div className="mt-3"><Empty title="Sem transações" hint="O que você digitar aparece aqui." /></div>}
          <ul className="stagger">
            {list.map((t) => (
              <li key={t.id}>
                <button
                  onClick={() => nav.sheet({ kind: 'edit', tx: t })}
                  className="flex w-full items-center gap-3 border-b border-esk-border py-4 text-left transition hover:bg-white/[0.02] lg:gap-4"
                >
                  <span className={`grid size-11 shrink-0 place-items-center rounded-[16px] text-esk-ink lg:size-12 ${TILE_BG[sorted.indexOf(t) % 3]}`}>
                    <Icon name={CATEGORY_ICON[t.category]} size={20} strokeWidth={1.6} />
                  </span>
                  <span className="flex min-w-0 flex-1 flex-col gap-1">
                    <span className="truncate text-[16px] font-medium lg:text-[17px]">{t.name}</span>
                    <span className="truncate text-[10px] text-esk-muted lg:text-[12px]">{catLabel(t.category)} · {methodLabel(t)}</span>
                  </span>
                  <span className="flex flex-col items-end gap-1">
                    <span className="num text-[13px] font-medium lg:text-[15px]">− {money(t.value, true)}</span>
                    <span className="text-[10px] text-esk-muted lg:text-[12px]">{relDate(t.date)}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
          {sorted.length > 4 && (
            <button onClick={() => setShowAll((v) => !v)} className="mt-4 self-start text-[14px] text-esk-lime">
              {showAll ? 'Ver menos' : 'Ver todas'}
            </button>
          )}
        </div>
      </section>

      <p className="mt-2 text-center text-[11px] text-esk-muted lg:text-[13px]">Seu assistente financeiro para grandes conquistas.</p>
    </div>
  )
}

function Shortcut({ icon, label, primary, onClick }: { icon: IconName; label: string; primary?: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`press group flex flex-col items-center gap-2.5 py-1 text-[13px] font-medium transition lg:hover:-translate-y-0.5
        lg:flex-row lg:gap-4 lg:rounded-tile lg:px-6 lg:py-3 lg:text-[17px]
        ${primary ? 'lg:bg-esk-lime lg:text-esk-ink' : 'lg:bg-esk-elevated lg:hover:bg-esk-row'}`}
    >
      <span className={`grid size-16 place-items-center rounded-full transition duration-300 group-hover:scale-105 group-hover:brightness-95 group-active:scale-90 lg:size-11 ${primary ? 'bg-esk-lime text-esk-ink lg:bg-black/5' : 'bg-esk-elevated text-esk-text lg:bg-esk-row'}`}><Icon name={icon} size={23} strokeWidth={1.7} /></span>
      {label}
    </button>
  )
}
