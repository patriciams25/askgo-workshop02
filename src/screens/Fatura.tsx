import { useEffect, useMemo, useRef, useState } from 'react'
import { CATEGORIES, catLabel, money, relDate } from '../data'
import { uid, useStore } from '../store'
import { CATEGORY_ICON, Icon, type IconName } from '../components/Icon'
import { Field, Sheet, inputCls, parseMoney, PrimaryButton, RoundIconButton } from '../components/ui'
import { env } from '../lib/env'
import { AIAuthRequiredError, fileToBase64, readInvoice, type InvoiceResult } from '../services/ai'
import { mockInvoice, simulateReading } from '../services/invoiceMock'
import type { Nav } from '../App'

type Phase = 'pick' | 'reading' | 'review' | 'error'
const ACCEPT_PDF = 'application/pdf'
const ACCEPT_IMG = 'image/jpeg,image/png,image/webp'
const MAX_MB = 3

/** Tela única, três estados: escolher PDF/foto → "Lendo sua fatura" → Encontramos. */
export function Fatura({ nav }: { nav: Nav }) {
  const { state, dispatch } = useStore()
  const [phase, setPhase] = useState<Phase>('pick')
  const [fileName, setFileName] = useState('')
  const [kind, setKind] = useState<'PDF' | 'FOTO'>('PDF')
  const [progress, setProgress] = useState(0)
  const [result, setResult] = useState<InvoiceResult | null>(null)
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [cardId, setCardId] = useState(state.frontCardId || state.cards[0]?.id || '')
  const [error, setError] = useState('')
  const [pending, setPending] = useState<File | null>(null)
  const [fingerprint, setFingerprint] = useState('')
  const [editing, setEditing] = useState<number | null>(null)
  const confirming = useRef(false)
  const pdfRef = useRef<HTMLInputElement>(null)
  const imgRef = useRef<HTMLInputElement>(null)
  const abort = useRef<AbortController | null>(null)

  useEffect(() => () => abort.current?.abort(), [])

  const start = async (file: File | null) => {
    abort.current?.abort()
    const ctrl = new AbortController()
    abort.current = ctrl
    const isPdf = !file || file.type === ACCEPT_PDF
    if (file && ![ACCEPT_PDF, ...ACCEPT_IMG.split(',')].includes(file.type)) { setError('Escolha um PDF ou uma imagem JPG, PNG ou WebP.'); setPhase('error'); return }
    if (file && file.size === 0) { setError('O arquivo está vazio. Escolha outro arquivo.'); setPhase('error'); return }
    if (file && file.size > MAX_MB * 1024 * 1024) {
      setError(`Arquivo maior que ${MAX_MB} MB. Tente uma foto menor ou o PDF original.`)
      setPhase('error')
      return
    }
    setKind(isPdf ? 'PDF' : 'FOTO')
    setFileName(file?.name ?? 'fatura-novembro.pdf')
    setProgress(0)
    setResult(null)
    setError('')
    setPhase('reading')
    try {
      let res: InvoiceResult
      if (env.featureAI && file) {
        const [base64] = await Promise.all([fileToBase64(file), simulateReading((p) => setProgress(Math.min(p, 90)), ctrl.signal)])
        res = await readInvoice({ name: file.name, mimeType: file.type, base64 }, ctrl.signal)
        setProgress(100)
      } else {
        await simulateReading(setProgress, ctrl.signal)
        res = mockInvoice()
      }
      if (ctrl.signal.aborted) return
      const key = env.featureAI && file ? Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', await file.arrayBuffer()))).map((value) => value.toString(16).padStart(2, '0')).join('') : `demo:${res.items[0]?.date.slice(0, 7)}`
      if (ctrl.signal.aborted) return
      setFingerprint(key)
      setResult(res)
      setSelected(new Set(res.items.map((_, i) => i)))
      setPhase('review')
    } catch (e) {
      if ((e as DOMException).name === 'AbortError') return
      setError(e instanceof AIAuthRequiredError ? e.message : 'Não conseguimos ler essa fatura. Tente outra foto ou o PDF original.')
      setPhase('error')
    }
  }

  const onFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0] ?? null
    e.target.value = ''
    if (!f) return
    abort.current?.abort()
    setResult(null)
    // valida já na escolha: só PDF/JPG/PNG/WebP, não vazio, até MAX_MB
    const invalid = ![ACCEPT_PDF, ...ACCEPT_IMG.split(',')].includes(f.type)
      ? 'Escolha um PDF ou uma imagem JPG, PNG ou WebP.'
      : f.size === 0 ? 'O arquivo está vazio. Escolha outro arquivo.'
      : f.size > MAX_MB * 1024 * 1024 ? `Arquivo maior que ${MAX_MB} MB. Tente uma foto menor ou o PDF original.` : ''
    setFileName(f.name)
    setKind(f.type === ACCEPT_PDF ? 'PDF' : 'FOTO')
    if (invalid) { setPending(null); setError(invalid); setPhase('error'); return }
    setPending(f); setError(''); setPhase('pick')
  }

  const summary = useMemo(() => {
    if (!result) return null
    const subs = result.items.filter((i) => i.subscription)
    const chosen = result.items.filter((_, i) => selected.has(i))
    return {
      buys: result.items.length,
      subs: subs.length,
      subsTotal: subs.reduce((n, i) => n + i.value, 0),
      chosenTotal: chosen.reduce((n, i) => n + i.value, 0),
      chosen,
    }
  }, [result, selected])

  const toggle = (i: number) => setSelected((s) => { const n = new Set(s); n.has(i) ? n.delete(i) : n.add(i); return n })

  const confirm = () => {
    if (!result || !summary || !summary.chosen.length || confirming.current) return
    if (state.importedInvoices?.includes(fingerprint)) { nav.toast('Esta fatura já foi importada.'); return }
    confirming.current = true
    dispatch({
      type: 'invoice/import',
      cardId,
      fingerprint,
      total: result.total,
      txs: summary.chosen.map((i) => ({
        id: `${fingerprint}:${uid()}`, name: i.name, category: i.category, method: cardId || 'dinheiro', date: i.date, value: i.value,
        source: 'invoice', invoiceId: fingerprint, subscription: i.subscription,
      })),
    })
    nav.toast(`${summary.chosen.length} ${summary.chosen.length === 1 ? 'lançamento importado' : 'lançamentos importados'}`)
    nav.go('home')
  }

  const card = state.cards.find((c) => c.id === cardId)
  const dueLabel = card ? `Vence em ${card.dueDays} dias` : 'Sem cartão vinculado'

  return (
    <div className="flex flex-col gap-6 lg:gap-8">
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-3 lg:gap-4">
          <RoundIconButton label="Voltar" icon="back" onClick={nav.back} />
          <h1 className="text-[29px] font-medium tracking-[-0.03em]">Importar fatura</h1>
        </div>
        <RoundIconButton label="Escolher PDF" icon="file" onClick={() => pdfRef.current?.click()} />
      </header>

      <input ref={pdfRef} type="file" accept={ACCEPT_PDF} className="sr-only" onChange={onFile} tabIndex={-1} aria-hidden="true" />
      <input ref={imgRef} type="file" accept={ACCEPT_IMG} capture="environment" className="sr-only" onChange={onFile} tabIndex={-1} aria-hidden="true" />

      <section className="flex flex-col gap-6 lg:grid lg:grid-cols-12 lg:items-start lg:gap-5">
        {/* Esquerda: hero + ações */}
        <div className="flex flex-col gap-3 lg:col-span-7">
          <div className="bg-hero flex min-h-[238px] flex-col justify-between rounded-hero p-6 text-esk-ink lg:min-h-[300px] lg:p-8" aria-live="polite">
            {phase === 'pick' && (
              <>
                <div className="flex justify-between text-[15px]"><span>{pending ? (pending.type === ACCEPT_PDF ? 'PDF selecionado' : 'Foto selecionada') : 'PDF ou foto'}</span><span className="font-mono text-[12px] tracking-[0.14em]">ASSISTENTE ESKGO</span></div>
                <div className="flex flex-col gap-2">
                  <span className="text-[15px]">{pending ? fileName : 'Envie a fatura do cartão'}</span>
                  <span className="text-[34px] font-medium leading-[1.05] tracking-[-0.04em] lg:text-[48px]">{pending ? 'Pronta para revisar.' : 'A IA lê, você confirma.'}</span>
                </div>
              </>
            )}
            {phase === 'reading' && (
              <>
                <div className="flex justify-between text-[15px]"><span>{kind}</span><span className="num">{progress}%</span></div>
                <div className="flex flex-col gap-2">
                  <span className="truncate text-[15px]">{fileName}</span>
                  <span className="text-[36px] font-medium leading-none tracking-[-0.04em] lg:text-[52px]">Lendo sua fatura</span>
                  <div className="mt-3 h-2 w-full overflow-hidden rounded-[8px] bg-black/10" role="progressbar" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100} aria-label="Progresso da leitura">
                    <div className="shimmer h-full rounded-[8px] bg-esk-ink transition-[width] duration-200" style={{ width: `${progress}%` }} />
                  </div>
                </div>
              </>
            )}
            {phase === 'review' && result && (
              <>
                <div className="flex justify-between text-[15px]"><span className="truncate pr-4">{fileName}</span><span>Lida</span></div>
                <div className="flex flex-col gap-2">
                  <span className="text-[15px]">Total da fatura</span>
                  <span className="num text-[44px] font-medium leading-none lg:text-[58px]">{money(result.total)}</span>
                  <span className="flex items-center gap-2 text-[13px]"><Icon name="check" size={16} strokeWidth={2} /> Confira antes de lançar na home.</span>
                </div>
              </>
            )}
            {phase === 'error' && (
              <>
                <div className="flex justify-between text-[15px]"><span>{kind}</span><span>Ops</span></div>
                <div className="flex flex-col gap-2">
                  <span className="text-[32px] font-medium leading-tight tracking-[-0.04em]">Não deu para ler</span>
                  <span className="text-[14px]" role="alert">{error}</span>
                </div>
              </>
            )}
          </div>

          <div className="grid grid-cols-[84px_minmax(0,1fr)] gap-3">
            <button aria-label="Tirar foto da fatura" onClick={() => imgRef.current?.click()}
              className="grid h-[84px] place-items-center rounded-tile bg-esk-lime text-esk-ink transition active:scale-95">
              <Icon name={phase === 'pick' ? 'camera' : 'upload'} size={22} strokeWidth={1.8} />
            </button>
            <button onClick={() => pdfRef.current?.click()}
              className="h-[84px] rounded-tile bg-esk-elevated px-6 text-left text-[17px] transition hover:bg-esk-row active:scale-[0.98]">
              {phase === 'pick' ? 'Escolher PDF da fatura' : 'Enviar outro PDF'}
            </button>
          </div>
          {phase === 'pick' && pending && <><PrimaryButton onClick={() => start(pending)}>Ler fatura</PrimaryButton><button className="py-2 text-[14px] text-esk-text-2" onClick={() => { setPending(null); setFileName('') }}>Remover arquivo</button></>}
          {phase === 'reading' && <button className="py-2 text-[14px] text-esk-lime" onClick={() => { abort.current?.abort(); setPhase('pick'); setResult(null) }}>Cancelar leitura</button>}
          {phase === 'review' && <button className="py-2 text-[14px] text-esk-text-2" onClick={() => { setPhase('pick'); setPending(null); setResult(null); setFileName('') }}>Descartar leitura</button>}
          {phase === 'error' && <PrimaryButton onClick={() => { setPhase('pick'); setPending(null); setError('') }}>Tentar novamente</PrimaryButton>}
          {phase === 'pick' && !pending && (
            <button onClick={() => start(null)} className="self-start py-2 text-[14px] text-esk-lime">
              Testar com fatura de exemplo (fatura-novembro.pdf)
            </button>
          )}
          {!env.featureAI && (
            <p className="text-[12px] text-esk-muted">Demonstração: nenhum arquivo é enviado. A leitura usa 34 compras fictícias, independentemente do arquivo escolhido.</p>
          )}
        </div>

        {/* Direita: Encontramos */}
        <div className="flex flex-col gap-4 lg:col-span-5">
          <div className="mt-2 flex items-center justify-between lg:mt-0">
            <h2 className="text-[22px] font-medium tracking-[-0.02em]">Encontramos</h2>
            {phase === 'review' && result && (
              <button className="text-[14px] text-esk-lime" onClick={() => setSelected(selected.size === result.items.length ? new Set() : new Set(result.items.map((_, i) => i)))}>
                {selected.size === result.items.length ? 'Desmarcar todas' : 'Marcar todas'}
              </button>
            )}
          </div>

          <ul className="rounded-hero bg-esk-surface px-5 py-2 lg:px-6">
            <SummaryRow icon="card" title="Compras" sub={env.featureAI ? 'Categorizadas com IA' : 'Dados de exemplo para revisão'} value={summary ? String(summary.buys) : null} loading={phase === 'reading'} />
            <SummaryRow icon="repeat" title="Assinaturas" sub={summary ? `${money(summary.subsTotal)} por mês` : 'Cobranças recorrentes'} value={summary ? String(summary.subs) : null} loading={phase === 'reading'} />
            <SummaryRow icon="sigma" title="Total da fatura" sub={dueLabel} value={result ? money(result.total) : null} loading={phase === 'reading'} last />
          </ul>

          {phase === 'pick' && (
            <p className="px-1 text-[13px] leading-relaxed text-esk-muted">Depois da leitura você revisa cada compra. Só o que você confirmar entra na home, junto do que já digitou.</p>
          )}

          {phase === 'review' && result && summary && (
            <>
              {state.cards.length > 0 && (
                <label className="flex items-center justify-between gap-3 rounded-[20px] bg-esk-elevated px-5 py-3 text-[14px]">
                  <span className="text-esk-text-2">Cartão da fatura</span>
                  <select value={cardId} onChange={(e) => setCardId(e.target.value)} className="bg-transparent text-right text-esk-text outline-none">
                    {state.cards.map((c) => <option key={c.id} value={c.id}>{c.name} •• {c.last4}</option>)}
                  </select>
                </label>
              )}
              <ul className="stagger max-h-[420px] overflow-y-auto rounded-hero bg-esk-surface px-5 py-1 lg:px-6" aria-label="Compras encontradas">
                {result.items.map((it, i) => (
                  <li key={i} className="border-b border-esk-border py-2">
                    <label className="flex cursor-pointer items-center gap-3 py-2">
                      <input type="checkbox" checked={selected.has(i)} onChange={() => toggle(i)} aria-label={`Selecionar ${it.name}, ${money(it.value, true)}`} className="size-5 shrink-0 accent-[#e5ffb5]" />
                      <span className="grid size-10 shrink-0 place-items-center rounded-full bg-esk-row">
                        <Icon name={it.subscription ? 'repeat' : CATEGORY_ICON[it.category]} size={17} strokeWidth={1.6} />
                      </span>
                      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                        <span className="truncate text-[15px] font-medium">{it.name}</span>
                        <span className="truncate text-[11px] text-esk-muted">{it.subscription ? 'Assinatura' : catLabel(it.category)} · {relDate(it.date)}</span>
                      </span>
                      <span className="num text-[14px] font-medium">− {money(it.value, true)}</span>
                    </label>
                    <button className="ml-8 min-h-10 text-[12px] text-esk-lime" onClick={() => setEditing(i)} aria-label={`Editar compra ${i + 1}: ${it.name}`}>Editar compra</button>
                  </li>
                ))}
              </ul>
              {state.importedInvoices?.includes(fingerprint) && <p role="status" className="text-[14px] text-esk-lilac">Esta fatura já foi importada. Os lançamentos estão na Home.</p>}
              <PrimaryButton onClick={confirm} disabled={!summary.chosen.length || state.importedInvoices?.includes(fingerprint)}>
                Confirmar {summary.chosen.length} {summary.chosen.length === 1 ? 'lançamento' : 'lançamentos'} · {money(summary.chosenTotal, true)}
              </PrimaryButton>
            </>
          )}
        </div>
      </section>
      {editing !== null && result && <ReviewEdit key={editing} item={result.items[editing]} onClose={() => setEditing(null)} onSave={(item) => {
        setResult((current) => {
          if (!current) return current
          const items = current.items.map((old, index) => index === editing ? item : old)
          return { items, total: Math.round(items.reduce((sum, entry) => sum + entry.value, 0) * 100) / 100 }
        })
        setEditing(null)
      }} />}
    </div>
  )
}

function SummaryRow({ icon, title, sub, value, loading, last }: { icon: IconName; title: string; sub: string; value: string | null; loading: boolean; last?: boolean }) {
  return (
    <li className={`flex items-center gap-4 py-4 ${last ? '' : 'border-b border-esk-border'}`}>
      <span className="grid size-11 place-items-center rounded-full bg-esk-row"><Icon name={icon} size={19} strokeWidth={1.6} /></span>
      <span className="flex flex-1 flex-col gap-1">
        <span className="text-[16px] font-medium">{title}</span>
        <span className="text-[13px] text-esk-muted">{sub}</span>
      </span>
      {loading ? <span className="h-4 w-12 animate-pulse rounded bg-esk-track" aria-hidden="true" /> : <span className="num text-[16px] font-medium">{value ?? '—'}</span>}
    </li>
  )
}

function ReviewEdit({ item, onClose, onSave }: { item: InvoiceResult['items'][number]; onClose: () => void; onSave: (item: InvoiceResult['items'][number]) => void }) {
  const [name, setName] = useState(item.name)
  const [value, setValue] = useState(String(item.value).replace('.', ','))
  const [category, setCategory] = useState(item.category)
  const [date, setDate] = useState(item.date)
  const [error, setError] = useState('')
  return <Sheet title="Revisar compra" onClose={onClose}><form className="flex flex-col gap-4" noValidate onSubmit={(event) => {
    event.preventDefault()
    const amount = parseMoney(value)
    if (!name.trim() || amount <= 0 || !date) { setError('Informe descrição, valor maior que zero e data.'); return }
    onSave({ ...item, name: name.trim(), value: amount, category, date })
  }}>
    <Field label="Descrição"><input className={inputCls} value={name} onChange={(event) => setName(event.target.value)} /></Field>
    <Field label="Valor (R$)"><input inputMode="decimal" className={inputCls} value={value} onChange={(event) => setValue(event.target.value)} /></Field>
    <Field label="Categoria"><select className={inputCls} value={category} onChange={(event) => setCategory(event.target.value as typeof category)}>{CATEGORIES.map((entry) => <option key={entry.id} value={entry.id}>{entry.label}</option>)}</select></Field>
    <Field label="Data"><input type="date" className={inputCls} value={date} onChange={(event) => setDate(event.target.value)} /></Field>
    {error && <p role="alert" className="text-[13px] text-esk-lilac">{error}</p>}
    <PrimaryButton type="submit">Salvar revisão</PrimaryButton>
  </form></Sheet>
}
