import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react'
import { StoreProvider, useStore } from './store'
import { Home } from './screens/Home'
const Cartoes = lazy(() => import('./screens/Cartoes').then((module) => ({ default: module.Cartoes })))
const Metas = lazy(() => import('./screens/Metas').then((module) => ({ default: module.Metas })))
const Fatura = lazy(() => import('./screens/Fatura').then((module) => ({ default: module.Fatura })))
const Assistente = lazy(() => import('./screens/Assistente').then((module) => ({ default: module.Assistente })))
const Auth = lazy(() => import('./screens/Auth').then((module) => ({ default: module.Auth })))
import type { SheetState } from './sheets'
const Sheets = lazy(() => import('./sheets').then((module) => ({ default: module.Sheets })))
import { Toast } from './components/ui'

export type View = 'home' | 'cartoes' | 'metas' | 'login' | 'cadastro' | 'recuperar' | 'fatura' | 'assistente'
export interface Nav {
  go: (v: View) => void
  back: () => void
  sheet: (s: SheetState) => void
  toast: (msg: string) => void
}

const VIEWS: View[] = ['cartoes', 'metas', 'login', 'cadastro', 'recuperar', 'fatura', 'assistente']
const PLUS_ONLY: View[] = ['fatura', 'assistente']
const viewFromHash = (): View => {
  const h = location.hash.replace('#/', '') as View
  if (h as string === 'objetivos') return 'metas'
  return VIEWS.includes(h) ? h : 'home'
}

function Shell() {
  const { state } = useStore()
  const [view, setView] = useState<View>(viewFromHash)
  const [sheet, setSheet] = useState<SheetState | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const timer = useRef<number>(undefined)
  // tela anterior (para o "Voltar" do app retornar de onde a pessoa veio)
  const stack = useRef<View[]>(view === 'home' ? ['home'] : ['home', view])

  // pilha de navegação via hash → o botão voltar do navegador/celular funciona
  useEffect(() => {
    const onHash = () => {
      const next = viewFromHash()
      const s = stack.current
      if (next === 'home') stack.current = ['home']
      else if (s[s.length - 2] === next) s.pop()
      else if (s[s.length - 1] !== next) s.push(next)
      setView(next); setSheet(null)
    }
    window.addEventListener('hashchange', onHash)
    onHash()
    return () => window.removeEventListener('hashchange', onHash)
  }, [])
  useEffect(() => { window.scrollTo({ top: 0 }) }, [view])

  const showToast = useCallback((msg: string) => {
    setToast(msg)
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => setToast(null), 2400)
  }, [])

  const nav: Nav = {
    go: (v) => { location.hash = v === 'home' ? '/' : `/${v}` },
    back: () => {
      const prev = stack.current[stack.current.length - 2]
      const to: View = prev && !['login', 'cadastro', 'recuperar'].includes(prev) ? prev : 'home'
      location.hash = to === 'home' ? '/' : `/${to}`
    },
    sheet: setSheet,
    toast: showToast,

  }

  const close = useCallback(() => setSheet(null), [])
  const done = useCallback((msg: string) => { setSheet(null); showToast(msg) }, [showToast])

  useEffect(() => () => window.clearTimeout(timer.current), [])

  if (state.signedOut || ['login', 'cadastro', 'recuperar'].includes(view)) return <><Auth key={view} initialMode={view === 'cadastro' ? 'cadastro' : view === 'recuperar' ? 'recuperar' : 'login'} /><Toast message={toast} /></>

  // Sem o Plus (estágio 2), Fatura e Assistente não existem.
  const current: View = !state.plus && PLUS_ONLY.includes(view) ? 'home' : view

  return (
    <div className="min-h-dvh bg-esk-bg">
      <main className="mx-auto w-full max-w-[440px] px-4 pb-10 pt-8 lg:max-w-[1180px] lg:px-6 lg:pb-16 lg:pt-10" key={current}>
        <div className="min-w-0 animate-page">
          {current === 'home' && <Home nav={nav} />}
          {current === 'cartoes' && <Cartoes nav={nav} />}
          {current === 'metas' && <Metas nav={nav} />}
          {current === 'fatura' && <Fatura nav={nav} />}
          {current === 'assistente' && <Assistente nav={nav} />}
        </div>
      </main>
      {sheet && <Suspense fallback={<div role="status" className="fixed bottom-6 inset-x-4 rounded-tile bg-esk-sheet p-4 text-center">Abrindo formulário…</div>}><Sheets sheet={sheet} close={close} done={done} /></Suspense>}
      <Toast message={toast} />
    </div>
  )
}

export default function App() {
  return (
    <StoreProvider>
      <Suspense fallback={<div role="status" className="mx-auto flex max-w-[440px] flex-col gap-5 p-6 pt-12"><span className="text-[24px] font-bold text-esk-lime">Eskgo</span><span className="h-60 animate-pulse rounded-hero bg-esk-surface" /><span className="sr-only">Carregando tela</span></div>}>
        <Shell />
      </Suspense>
    </StoreProvider>
  )
}
