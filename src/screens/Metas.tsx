import { money, pct } from '../data'
import { useMonth, useStore } from '../store'
import { Icon } from '../components/Icon'
import { Bar, CountUp, RoundIconButton, useMounted } from '../components/ui'
import { topInsight } from '../services/insights'
import type { Nav } from '../App'

const CAT_COLOR: Record<string, string> = {
  alimentacao: 'var(--esk-lime)',
  moradia: 'var(--esk-offwhite)',
  transporte: 'var(--esk-lilac-strong)',
  lazer: 'var(--esk-lime)',
  saude: 'var(--esk-lilac)',
  outros: 'var(--esk-offwhite)',
}
const VISIBLE = ['alimentacao', 'moradia', 'transporte', 'lazer']

export function Metas({ nav }: { nav: Nav }) {
  const { state } = useStore()
  const m = useMonth(state)
  const insight = state.plus ? topInsight(state) : null
  const [featured, ...others] = state.goals
  const daysLeft = (() => {
    const d = new Date()
    return new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate() - d.getDate()
  })()
  const cats = m.byCat.filter((c) => VISIBLE.includes(c.id))
  const fp = featured ? pct(featured.saved, featured.target) : 0

  return (
    <div className="flex flex-col gap-6 lg:gap-8">
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-3 lg:gap-4">
          <RoundIconButton label="Voltar" icon="back" onClick={nav.back} />
          <h1 className="text-[29px] font-medium tracking-[-0.03em]">
            Metas
          </h1>
        </div>
        <RoundIconButton label="Nova meta" icon="plus" onClick={() => nav.sheet({ kind: 'goal' })} />
      </header>

      <section className="flex flex-col gap-10 lg:grid lg:grid-cols-12 lg:items-start lg:gap-5">
        {/* Este mês */}
        <div className={`flex flex-col gap-5 lg:col-span-6 lg:flex lg:rounded-hero lg:bg-esk-surface lg:p-8`}>
          <div className="flex items-center justify-between"><span className="kicker">Este mês</span><button className="text-[13px] text-esk-lime" onClick={() => nav.sheet({ kind: 'monthBudget' })}>Ajustar teto</button></div>
          <div className="flex flex-col gap-2">
            <span className="text-[15px] text-esk-text-2">{m.available == null ? 'Defina um teto mensal' : m.available >= 0 ? 'Ainda pode gastar' : 'Acima do teto do mês'}</span>
            <span className="num text-[56px] font-medium leading-none lg:text-[66px]">{m.available == null ? '—' : money(Math.abs(m.available))}</span>
            <span className="text-[14px] text-esk-muted">{state.monthCap > 0 ? `de ${money(state.monthCap)}, faltam ${daysLeft} dias` : 'Sem limite mensal configurado'}</span>
          </div>
          <div className="flex h-3 gap-1">
            {cats.map((c) => (
              <span key={c.id} className="rounded-[4px] transition-all duration-500" style={{ flex: Math.max(c.spent, 0.0001), background: CAT_COLOR[c.id] }} />
            ))}
            {m.available != null && <span className="rounded-[4px] bg-esk-border" style={{ flex: Math.max(0, m.available) }} />}
          </div>
          <div className="grid grid-cols-2 gap-3">
            {cats.map((c) => (
              <button
                key={c.id}
                onClick={() => nav.sheet({ kind: 'budget', category: c.id })}
                className="press lift flex flex-col gap-3.5 rounded-tile bg-esk-elevated p-5 text-left transition hover:bg-esk-row"
              >
                <span className="text-[14px] text-esk-text-2">{c.label}</span>
                <span className="num text-[28px] font-medium">{c.used}%</span>
                <Bar value={c.used} color={CAT_COLOR[c.id]} />
                <span className="text-[12px] text-esk-muted">{money(c.spent)} {c.cap > 0 ? `de ${money(c.cap)}` : '· sem teto'}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Guardando */}
        <div className={`flex flex-col gap-5 lg:col-span-6 lg:flex`}>
          <span className="kicker">Guardando para seus objetivos</span>
          {!featured && (
            <div className="flex flex-col items-start gap-4 rounded-hero border border-dashed border-esk-track p-6">
              <span className="text-[18px] font-medium">Nenhum objetivo ainda</span>
              <span className="text-[14px] text-esk-text-2">Viagem, reserva, curso… crie uma meta e guarde um pouco por vez.</span>
              <button onClick={() => nav.sheet({ kind: 'goal' })} className="h-12 rounded-full bg-esk-lime px-5 text-[15px] font-medium text-esk-ink">Criar objetivo</button>
            </div>
          )}
          {featured && (
            <div className="bg-hero flex min-h-[230px] flex-col justify-between rounded-hero p-6 text-esk-ink lg:p-8">
              <div className="flex justify-between text-[15px]">
                <span>{featured.name}</span>
                <span>{featured.date ?? ''}</span>
              </div>
              <button onClick={() => nav.sheet({ kind: 'goal', goalId: featured.id })} className="self-start rounded-full border border-esk-ink/20 px-3 py-1 text-[12px] hover:bg-esk-ink/5">Editar objetivo</button>
              <div className="flex items-end justify-between gap-4">
                <div className="flex flex-col gap-1.5">
                  <span className="text-[15px]">Já guardado</span>
                  <span className="num whitespace-nowrap text-[34px] font-medium leading-none sm:text-[40px] lg:text-[44px]">{money(featured.saved)}</span>
                  <span className="text-[12px] opacity-70">de {money(featured.target)}</span>
                </div>
                <Ring value={fp} />
              </div>
            </div>
          )}
          {featured && (
            <div className="grid grid-cols-[84px_minmax(0,1fr)] gap-3">
              <button
                aria-label="Guardar outro valor"
                onClick={() => nav.sheet({ kind: 'save', goalId: featured.id })}
                className="grid h-[84px] place-items-center rounded-tile bg-esk-lime text-esk-ink transition active:scale-95"
              >
                <Icon name="plus" size={22} strokeWidth={1.8} />
              </button>
              <button
                onClick={() => nav.sheet({ kind: 'save', goalId: featured.id })}
                className="h-[84px] rounded-tile bg-esk-elevated px-6 text-left text-[17px] transition hover:bg-esk-row active:scale-[0.98]"
              >
                Guardar R$ 500
              </button>
            </div>
          )}

          {featured && <><div className="mt-2 flex items-center justify-between">
            <h2 className="text-[22px] font-medium tracking-[-0.02em]">Outros objetivos</h2>
          </div>
          <ul className="rounded-hero bg-esk-surface px-5 py-2 lg:px-6">
            {others.map((g) => (
              <li key={g.id}>
                <div className="flex items-center gap-3 border-b border-esk-border py-4">
                <button
                  onClick={() => nav.sheet({ kind: 'save', goalId: g.id })}
                  className="flex min-w-0 flex-1 items-center gap-4 text-left"
                >
                  <span className="grid size-11 place-items-center rounded-full bg-esk-row">
                    <Icon name={g.icon} size={19} strokeWidth={1.6} />
                  </span>
                  <span className="flex flex-1 flex-col gap-1">
                    <span className="text-[16px] font-medium">{g.name}</span>
                    <span className="text-[13px] text-esk-muted">{money(g.saved)} de {money(g.target)}</span>
                  </span>
                  <span className="num text-[16px] font-medium">{pct(g.saved, g.target)}%</span>
                </button>
                <button onClick={() => nav.sheet({ kind: 'goal', goalId: g.id })} className="shrink-0 rounded-full px-3 py-2 text-[12px] text-esk-text-2 hover:bg-esk-row">Editar</button>
                </div>
              </li>
            ))}
            {others.length === 0 && <li className="py-6 text-center text-[13px] text-esk-muted">Toque em + para criar outro objetivo.</li>}
          </ul></>}
        </div>
      </section>

      {insight && <InsightCard text={insight} onOpen={() => nav.go('assistente')} className="flex" />}
    </div>
  )
}

function InsightCard({ text, onOpen, className = '' }: { text: string; onOpen: () => void; className?: string }) {
  return (
    <button onClick={onOpen} className={`${className} min-h-[200px] w-full flex-col justify-between gap-6 rounded-hero bg-esk-lilac-strong p-6 text-left text-esk-ink transition hover:brightness-105 active:scale-[0.99] lg:min-h-0 lg:flex-row lg:items-center lg:p-8`}>
      <span className="flex flex-col gap-4 lg:flex-row lg:items-center lg:gap-8">
        <span className="font-mono text-[12px] tracking-[0.14em]">ASSISTENTE ESKGO</span>
        <span className="text-[26px] font-medium leading-[1.12] tracking-[-0.03em] lg:text-[28px]">{text}</span>
      </span>
      <span className="grid size-11 shrink-0 place-items-center self-end rounded-full bg-esk-ink text-esk-text lg:self-center" aria-hidden="true">
        <Icon name="arrowUpRightSm" size={18} />
      </span>
      <span className="sr-only">Abrir assistente</span>
    </button>
  )
}

function Ring({ value }: { value: number }) {
  const r = 42
  const c = 2 * Math.PI * r
  const on = useMounted(120)
  value = on ? value : 0
  return (
    <div className="relative grid size-[100px] shrink-0 place-items-center">
      <svg viewBox="0 0 100 100" className="absolute inset-0 -rotate-90" aria-hidden="true">
        <circle cx="50" cy="50" r={r} fill="none" stroke="rgba(10,10,10,0.12)" strokeWidth="10" />
        <circle
          cx="50" cy="50" r={r} fill="none" stroke="#0A0A0A" strokeWidth="10" strokeLinecap="round"
          strokeDasharray={c} strokeDashoffset={c * (1 - Math.min(100, value) / 100)}
          className="transition-[stroke-dashoffset] duration-1000 ease-[cubic-bezier(.2,.8,.2,1)]"
        />
      </svg>
      <span className="num text-[20px] font-bold"><CountUp value={value} format={(n) => `${Math.round(n)}%`} duration={900} /></span>
    </div>
  )
}
