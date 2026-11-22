import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from 'react'
import { useStore } from '../store'
import { Icon } from '../components/Icon'
import { RoundIconButton } from '../components/ui'
import { env } from '../lib/env'
import { AIAuthRequiredError, askAssistant, fileToBase64, type ChatAttachment, type ChatMessage } from '../services/ai'
import { localAnswer, type Answer } from '../services/insights'
import type { Nav } from '../App'

interface Msg { id: string; role: 'user' | 'assistant'; text: string; attachmentName?: string; highlight?: Answer['highlight']; error?: boolean; fresh?: boolean }

const SUGGESTIONS = [
  'Quanto gastei com delivery este mês?',
  'Como guardo mais para a viagem?',
  'Quais assinaturas eu tenho?',
  'Quando vence minha fatura?',
  'Qual meu saldo?',
]
const MAX_LEN = 500
const MAX_ATTACHMENT_BYTES = 3 * 1024 * 1024
const ACCEPTED_ATTACHMENTS = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp']
const KEY = 'eskgo:chat:v1'
const reduceMotion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

/** Conversa guardada só nesta aba (sessionStorage): sobrevive a navegar entre telas. */
function loadChat(email: string): Msg[] {
  try {
    const raw = JSON.parse(sessionStorage.getItem(KEY) ?? 'null')
    return raw?.email === email ? (raw.msgs as Msg[]).map((m) => ({ ...m, fresh: false })) : []
  } catch { return [] }
}

export function Assistente({ nav }: { nav: Nav }) {
  const { state } = useStore()
  const [msgs, setMsgs] = useState<Msg[]>(() => loadChat(state.user.email))
  const [input, setInput] = useState('')
  const [waiting, setWaiting] = useState(false)
  const [retry, setRetry] = useState('')
  const endRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const attachmentRef = useRef<HTMLInputElement>(null)
  const abort = useRef<AbortController | null>(null)
  const lock = useRef(false)
  const [attachment, setAttachment] = useState<File | null>(null)
  const [attachmentError, setAttachmentError] = useState('')

  useEffect(() => () => abort.current?.abort(), [])
  useEffect(() => {
    // guarda só pares respondidos: descarta erros e a pergunta que ficou sem resposta
    const kept = msgs.filter((m, i) => !m.error && !(m.role === 'user' && (msgs[i + 1]?.error || (i === msgs.length - 1 && !waiting))))
    try { sessionStorage.setItem(KEY, JSON.stringify({ email: state.user.email, msgs: kept })) } catch { /* ignora */ }
  }, [msgs, waiting, state.user.email])
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: reduceMotion() ? 'auto' : 'smooth', block: 'end' }) }, [msgs, waiting])

  const send = async (text: string, selectedAttachment: File | null = attachment) => {
    const q = text.trim().slice(0, MAX_LEN) || (selectedAttachment ? 'Analise o anexo enviado.' : '')
    if (!q || lock.current) return
    lock.current = true
    const controller = new AbortController()
    abort.current = controller
    setRetry('')
    const history: Msg[] = [...msgs.filter((m) => !m.error), { id: crypto.randomUUID(), role: 'user', text: q, attachmentName: selectedAttachment?.name, fresh: true }]
    setMsgs(history)
    setInput('')
    setWaiting(true)
    try {
      let answer: Answer
      if (env.featureAI) {
        const payload: ChatMessage[] = history.map((m) => ({ role: m.role, content: m.text }))
        const apiAttachment: ChatAttachment | undefined = selectedAttachment ? {
          name: selectedAttachment.name,
          mimeType: selectedAttachment.type,
          base64: await fileToBase64(selectedAttachment),
        } : undefined
        answer = { text: (await askAssistant(payload, state, controller.signal, apiAttachment)).reply }
      } else {
        await new Promise((r) => setTimeout(r, 650 + Math.random() * 400))
        answer = selectedAttachment
          ? { text: 'O modo demonstração não analisa anexos. Ative a IA e entre na sua conta para pedir uma análise do arquivo.' }
          : localAnswer(q, state)
      }
      if (controller.signal.aborted) return
      setAttachment(null)
      setAttachmentError('')
      setMsgs((m) => [...m, { id: crypto.randomUUID(), role: 'assistant', fresh: true, ...answer }])
    } catch (error) {
      if (controller.signal.aborted) return
      setRetry(q)
      setMsgs((m) => [...m, { id: crypto.randomUUID(), role: 'assistant', fresh: true, error: true, text: error instanceof AIAuthRequiredError ? error.message : 'Não consegui responder agora. Verifique a conexão e tente de novo.' }])
    } finally {
      lock.current = false
      if (!controller.signal.aborted) setWaiting(false)
      inputRef.current?.focus({ preventScroll: true })
    }
  }

  const reset = () => { abort.current?.abort(); lock.current = false; setWaiting(false); setRetry(''); setMsgs([]); setAttachment(null); setAttachmentError('') }
  const submit = (e: FormEvent) => { e.preventDefault(); send(input) }
  const selectAttachment = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null
    event.target.value = ''
    if (!file) return
    if (!ACCEPTED_ATTACHMENTS.includes(file.type)) { setAttachment(null); setAttachmentError('Escolha um PDF ou uma imagem JPG, PNG ou WebP.'); return }
    if (file.size === 0) { setAttachment(null); setAttachmentError('O arquivo está vazio. Escolha outro.'); return }
    if (file.size > MAX_ATTACHMENT_BYTES) { setAttachment(null); setAttachmentError('O anexo deve ter até 3 MB.'); return }
    setAttachment(file)
    setAttachmentError('')
  }
  const asked = new Set(msgs.filter((m) => m.role === 'user').map((m) => m.text))
  const followUps = SUGGESTIONS.filter((s) => !asked.has(s)).slice(0, 3)
  const last = msgs[msgs.length - 1]

  return (
    <div className="mx-auto flex min-h-[calc(100dvh-72px)] w-full max-w-[760px] flex-col gap-6">
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-3 lg:gap-4">
          <RoundIconButton label="Voltar" icon="back" onClick={nav.back} />
          <h1 className="text-[29px] font-medium tracking-[-0.03em]">Assistente</h1>
        </div>
        {msgs.length > 0 ? (
          <button onClick={reset} className="press flex h-11 items-center gap-2 rounded-full bg-esk-elevated px-4 text-[13px] text-esk-text-2 transition hover:text-esk-text">
            <Icon name="plus" size={15} /> Nova conversa
          </button>
        ) : (
          <span className="glow grid size-11 place-items-center rounded-full bg-esk-elevated text-esk-lilac" aria-hidden="true"><Icon name="sparkle" size={18} /></span>
        )}
      </header>

      <div className="flex flex-1 flex-col gap-3" role="log" aria-live="polite" aria-label="Conversa">
        {msgs.length === 0 && (
          <div className="stagger flex flex-col gap-5 py-4">
            <span className="kicker">Assistente Eskgo</span>
            <p className="text-[26px] font-medium leading-tight tracking-[-0.03em] lg:text-[32px]">Pergunte sobre seu dinheiro.</p>
            <p className="text-[14px] text-esk-text-2">As respostas usam seus gastos, cartões e metas — não dicas genéricas.</p>
            <div className="flex flex-wrap gap-2">
              {SUGGESTIONS.slice(0, 4).map((s) => (
                <button key={s} onClick={() => send(s)} className="press rounded-full bg-esk-elevated px-4 py-2.5 text-left text-[14px] transition hover:bg-esk-row">{s}</button>
              ))}
            </div>
          </div>
        )}

        {msgs.map((m) => (
          <div key={m.id} className={`flex flex-col gap-3 ${m.fresh ? 'animate-msg' : ''} ${m.role === 'user' ? 'items-end' : 'items-start'}`}>
            {m.role === 'user' ? (
              <>
                {m.attachmentName && <span className="flex max-w-[85%] items-center gap-2 rounded-2xl bg-esk-elevated px-3 py-2 text-[12px] text-esk-text-2"><Icon name="file" size={15} />{m.attachmentName}</span>}
                <p className="max-w-[85%] origin-bottom-right rounded-[22px] rounded-br-[8px] bg-esk-lime px-5 py-3.5 text-[16px] leading-snug text-esk-ink">{m.text}</p>
              </>
            ) : (
              <AssistantBubble msg={m} />
            )}
          </div>
        ))}

        {waiting && (
          <div className="flex items-center gap-2 self-start animate-msg" role="status" aria-label="Assistente digitando">
            <span className="glow grid size-8 place-items-center rounded-full bg-esk-elevated text-esk-lilac"><Icon name="sparkle" size={14} /></span>
            <span className="flex items-center gap-1.5 rounded-[22px] bg-esk-elevated px-5 py-4">
              {[0, 1, 2].map((d) => <span key={d} className="typing-dot size-2 rounded-full bg-esk-text-2" style={{ animationDelay: `${d * 150}ms` }} />)}
            </span>
          </div>
        )}

        {retry && !waiting && (
          <button onClick={() => send(retry)} className="press ml-10 flex items-center gap-2 self-start rounded-full bg-esk-row px-4 py-3 text-[14px] text-esk-lime">
            <Icon name="repeat" size={15} /> Tentar novamente
          </button>
        )}

        {!waiting && !retry && last?.role === 'assistant' && followUps.length > 0 && (
          <div className="stagger ml-10 mt-1 flex flex-wrap gap-2" aria-label="Sugestões de pergunta">
            {followUps.map((s) => (
              <button key={s} onClick={() => send(s)} className="press rounded-full border border-esk-track px-3.5 py-2 text-[13px] text-esk-text-2 transition hover:border-esk-lime hover:text-esk-text">{s}</button>
            ))}
          </div>
        )}
        <div ref={endRef} />
      </div>

      {attachment && <div className="flex items-center gap-2 rounded-2xl bg-esk-elevated px-3 py-2 text-[12px] text-esk-text-2">
        <Icon name="file" size={16} />
        <span className="min-w-0 flex-1 truncate">{attachment.name} · {(attachment.size / 1024).toFixed(0)} KB</span>
        <button type="button" aria-label="Remover anexo" disabled={waiting} onClick={() => setAttachment(null)} className="grid size-8 place-items-center rounded-full hover:bg-esk-row"><Icon name="close" size={15} /></button>
      </div>}
      {attachment && <p className="-mt-4 text-[11px] text-esk-muted">{env.featureAI ? 'O arquivo será enviado para análise pela IA.' : 'Modo demonstração: o arquivo não será enviado.'}</p>}
      {attachmentError && <p role="alert" className="-mt-3 text-[12px] text-esk-lilac">{attachmentError}</p>}
      <form onSubmit={submit} className="sticky bottom-4 flex items-center gap-2 rounded-full bg-esk-elevated p-2 pl-3 shadow-[0_-12px_40px_rgba(3,3,3,0.9)] ring-1 ring-transparent transition focus-within:ring-esk-lime/40">
        <input ref={attachmentRef} type="file" accept="application/pdf,image/jpeg,image/png,image/webp" className="sr-only" onChange={selectAttachment} tabIndex={-1} aria-hidden="true" />
        <button type="button" aria-label="Anexar PDF ou imagem" disabled={waiting} onClick={() => attachmentRef.current?.click()} className="grid size-11 shrink-0 place-items-center rounded-full text-esk-text-2 transition hover:bg-esk-row disabled:opacity-40"><Icon name="file" size={19} /></button>
        <label htmlFor="ask" className="sr-only">Pergunte sobre seu dinheiro</label>
        <input ref={inputRef} id="ask" value={input} onChange={(e) => setInput(e.target.value.slice(0, MAX_LEN))} placeholder="Pergunte sobre seu dinheiro"
          className="h-12 min-w-0 flex-1 bg-transparent text-[16px] outline-none placeholder:text-esk-muted" maxLength={MAX_LEN} autoComplete="off" />
        {input.length > MAX_LEN - 80 && <span className="text-[11px] text-esk-muted" aria-live="polite">{MAX_LEN - input.length}</span>}
        <button type="submit" aria-label="Enviar pergunta" disabled={(!input.trim() && !attachment) || waiting}
          className="press grid size-12 shrink-0 place-items-center rounded-full bg-esk-lime text-esk-ink transition disabled:scale-90 disabled:opacity-40">
          <Icon name="send" size={20} strokeWidth={2} />
        </button>
      </form>
      {!env.featureAI && <p className="-mt-3 text-center text-[11px] text-esk-muted">Modo demonstração: respostas calculadas no navegador com seus dados.</p>}
    </div>
  )
}

/** Resposta com efeito de escrita (estilo streaming) e card de insight que surge ao final. */
function AssistantBubble({ msg }: { msg: Msg }) {
  const [shown, setShown] = useState(msg.fresh && !msg.error && !reduceMotion() ? 0 : msg.text.length)
  const done = shown >= msg.text.length
  useEffect(() => {
    if (done) return
    // baseado em tempo (não em ticks): termina no prazo mesmo com timers reduzidos em aba de fundo
    const total = Math.min(1400, 280 + msg.text.length * 9)
    const start = performance.now()
    const id = window.setInterval(() => {
      const p = Math.min(1, (performance.now() - start) / total)
      setShown(Math.ceil(msg.text.length * p))
    }, 16)
    return () => window.clearInterval(id)
  }, [done, msg.text.length])

  return (
    <div className="flex w-full items-start gap-2">
      <span className={`grid size-8 shrink-0 place-items-center rounded-full bg-esk-elevated ${msg.error ? 'text-esk-lilac-strong' : 'text-esk-lilac'}`} aria-hidden="true">
        <Icon name={msg.error ? 'close' : 'sparkle'} size={14} />
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-3">
        <p className={`max-w-[88%] self-start rounded-[22px] rounded-tl-[8px] px-5 py-3.5 text-[16px] leading-snug ${msg.error ? 'border border-esk-lilac-strong/40 bg-esk-lilac-strong/10 text-esk-lilac' : 'bg-esk-elevated'}`}>
          <span className="sr-only">{msg.text}</span>
          <span aria-hidden="true">{msg.text.slice(0, shown)}{!done && <span className="caret" />}</span>
        </p>
        {msg.highlight && done && (
          <div className="bg-hero animate-insight flex w-full flex-col gap-2 rounded-[30px] p-6 text-esk-ink">
            <span className="text-[15px]">{msg.highlight.kicker}</span>
            <span className="num text-[32px] font-medium leading-none sm:text-[38px] lg:text-[44px]">{msg.highlight.value}</span>
            <span className="text-[14px]">{msg.highlight.note}</span>
          </div>
        )}
      </div>
    </div>
  )
}
