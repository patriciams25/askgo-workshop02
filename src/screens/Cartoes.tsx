import { money, pct, type Card } from '../data'
import { useStore } from '../store'
import { Icon } from '../components/Icon'
import { Bar, RoundIconButton } from '../components/ui'
import type { Nav } from '../App'

const CARD_BG: Record<Card['color'], string> = {
  offwhite: 'bg-esk-offwhite',
  lilac: 'bg-esk-lilac-strong',
  gradient: 'bg-wallet',
}

export function Cartoes({ nav }: { nav: Nav }) {
  const { state, dispatch } = useStore()
  // a pilha: o cartão da frente vai por último
  const stack = [...state.cards.filter((c) => c.id !== state.frontCardId), ...state.cards.filter((c) => c.id === state.frontCardId)]
  const front = stack[stack.length - 1]
  const used = front ? pct(front.invoice, front.limit) : 0
  const upcoming = [...state.cards].sort((a, b) => a.dueDays - b.dueDays)
  const PEEK = 46

  return (
    <div className="flex flex-col gap-6 lg:gap-8">
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-3 lg:gap-4">
          <RoundIconButton label="Voltar" icon="back" onClick={nav.back} />
          <h1 className="text-[29px] font-medium tracking-[-0.03em]">Meus cartões</h1>
        </div>
        <RoundIconButton label="Novo cartão" icon="plus" onClick={() => nav.sheet({ kind: 'card' })} />
      </header>

      {stack.length === 0 && (
        <div className="flex flex-col items-start gap-4 rounded-wallet border border-dashed border-esk-track p-6 lg:max-w-[640px]">
          <span className="text-[18px] font-medium">Sua carteira está vazia</span>
          <span className="text-[14px] text-esk-text-2">Cadastre apelido, final e limite. A fatura atual você digita à mão.</span>
          <button onClick={() => nav.sheet({ kind: 'card' })} className="h-12 rounded-full bg-esk-lime px-5 text-[15px] font-medium text-esk-ink">Adicionar cartão</button>
        </div>
      )}

      {stack.length > 0 && <section className="flex flex-col gap-6 lg:grid lg:grid-cols-12 lg:items-start lg:gap-5">
        <div className="flex flex-col gap-6 lg:col-span-7">
          <div
            className="relative h-[calc(230px+46px*var(--n))] lg:h-[calc(300px+46px*var(--n))]"
            style={{ '--n': stack.length - 1 } as React.CSSProperties}
          >
            {stack.map((c, i) => {
              const isFront = i === stack.length - 1
              return (
                <button
                  key={c.id}
                  onClick={() => isFront ? nav.sheet({ kind: 'card', cardId: c.id }) : dispatch({ type: 'card/front', id: c.id })}
                  aria-label={isFront ? `Editar cartão ${c.name}` : `Trazer cartão ${c.name} para a frente`}
                  className={`${CARD_BG[c.color]} press absolute inset-x-0 flex h-[230px] flex-col justify-between rounded-wallet px-6 py-5 text-left text-esk-ink shadow-[0_-8px_24px_rgba(0,0,0,0.25)] transition-transform duration-500 ease-[cubic-bezier(.2,.8,.2,1)] lg:h-[300px] lg:px-7 lg:py-6`}
                  style={{ transform: `translateY(${i * PEEK}px)`, zIndex: i }}
                >
                  <span className="flex w-full justify-between text-[15px] lg:text-[16px]">
                    <span>{c.name}</span>
                    <span>•• {c.last4}</span>
                  </span>
                  {isFront && (
                    <span className="flex flex-col gap-1">
                      <span className="text-[15px]">Fatura atual</span>
                      <span className="num text-[42px] font-medium leading-none lg:text-[58px]">{money(c.invoice)}</span>
                    </span>
                  )}
                </button>
              )
            })}
          </div>
          {front && (
            <div className="flex flex-col gap-3">
              <div className="flex justify-between text-[15px]">
                <span className="text-esk-text-2">Limite usado</span>
                <span>{used}%</span>
              </div>
              <Bar value={used} h={8} />
              <span className="text-[13px] text-esk-muted">
                {money(front.invoice)} de {money(front.limit)} · vence em {front.dueDays} dias
              </span>
            </div>
          )}
        </div>

        <div className="flex flex-col rounded-hero bg-esk-surface px-5 py-3 lg:col-span-5 lg:p-8">
          <div className="mb-2 mt-2 flex items-center justify-between lg:mt-0">
            <h2 className="text-[22px] font-medium tracking-[-0.02em]">Próximas faturas</h2>
          </div>
          <ul>
            {upcoming.map((c) => (
              <li key={c.id}>
                <button
                  onClick={() => dispatch({ type: 'card/front', id: c.id })}
                  className="flex w-full items-center gap-4 border-b border-esk-border py-4 text-left last:border-0"
                >
                  <span className="grid size-12 place-items-center rounded-full bg-esk-row">
                    <Icon name="card" size={20} strokeWidth={1.6} />
                  </span>
                  <span className="flex flex-1 flex-col gap-1">
                    <span className="text-[17px] font-medium">{c.name}</span>
                    <span className="text-[13px] text-esk-muted">Vence em {c.dueDays} dias</span>
                  </span>
                  <span className="num text-[17px] font-medium">{money(c.invoice)}</span>
                </button>
              </li>
            ))}
          </ul>
          {state.plus && (
            <button onClick={() => nav.go('fatura')} className="mt-3 flex items-center gap-2 self-start py-2 text-[14px] text-esk-lime">
              <Icon name="file" size={16} /> Importar fatura em PDF ou foto
            </button>
          )}
        </div>
      </section>}
    </div>
  )
}
