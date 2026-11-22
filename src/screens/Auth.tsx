import { useEffect, useRef, useState, type FormEvent } from 'react'
import { emptyState, initialState, money } from '../data'
import { useStore } from '../store'
import { supabase } from '../lib/supabase'
import { Icon } from '../components/Icon'
import { Field, PrimaryButton, inputCls } from '../components/ui'

type Mode = 'login' | 'cadastro' | 'recuperar'


export function Auth({ initialMode = 'login' }: { initialMode?: Mode }) {
  const { dispatch } = useStore()
  const mode = initialMode
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const [resetting, setResetting] = useState(false)
  const [recoveryComplete, setRecoveryComplete] = useState(false)
  const timer = useRef<number | undefined>(undefined)
  useEffect(() => () => window.clearTimeout(timer.current), [])
  useEffect(() => {
    if (!supabase || mode !== 'recuperar') return
    let active = true
    void supabase.auth.getSession().then(({ data }) => { if (active && data.session) setResetting(true) })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (active && event === 'PASSWORD_RECOVERY') setResetting(true)
    })
    return () => { active = false; subscription.unsubscribe() }
  }, [mode])
  const switchMode = (next: Mode) => { location.hash = `/${next}` }

  /** Autentica via Supabase quando configurado; sem conexão, bloqueia o acesso. */
  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (loading) return
    setErrors({})
    const mail = email.trim().toLowerCase()
    if (mode === 'recuperar') {
      if (!supabase) { setErrors({ email: 'O acesso ainda não está configurado. Configure a conexão com o Supabase.' }); return }
      if (resetting) {
        const nextErrors: Record<string, string> = {}
        if (password.length < 8) nextErrors.password = 'Use pelo menos 8 caracteres.'
        if (password !== confirm) nextErrors.confirm = 'As senhas não coincidem.'
        if (Object.keys(nextErrors).length) { setErrors(nextErrors); return }
        setLoading(true)
        try {
          const { error } = await supabase.auth.updateUser({ password })
          if (error) throw error
          setRecoveryComplete(true)
          setSent(true)
        } catch (error) {
          setErrors({ form: error instanceof Error ? error.message : 'Não foi possível atualizar a senha.' })
        } finally { setLoading(false) }
        return
      }
      if (!mail) { setErrors({ email: 'Informe o e-mail da conta.' }); return }
      setLoading(true)
      try {
        const { error } = await supabase.auth.resetPasswordForEmail(mail, { redirectTo: `${window.location.origin}/#/recuperar` })
        if (error) throw error
        setSent(true)
      } catch (error) {
        setErrors({ email: error instanceof Error ? error.message : 'Não foi possível solicitar a recuperação.' })
      } finally { setLoading(false) }
      return
    }

    if (supabase) {
      const nextErrors: Record<string, string> = {}
      if (!mail) nextErrors.email = 'Informe seu e-mail.'
      if (!password) nextErrors.password = 'Informe sua senha.'
      if (mode === 'cadastro' && password !== confirm) nextErrors.confirm = 'As senhas não coincidem.'
      if (Object.keys(nextErrors).length) { setErrors(nextErrors); return }
      setLoading(true)
      try {
        if (mode === 'cadastro') {
          const { data, error } = await supabase.auth.signUp({ email: mail, password, options: { data: { name: name.trim() } } })
          if (error) throw error
          if (!data.session) { setSent(true); return }
          dispatch({ type: 'auth/signUp', name: name.trim() || data.user?.email?.split('@')[0] || 'Pessoa', email: mail })
        } else {
          const { data, error } = await supabase.auth.signInWithPassword({ email: mail, password })
          if (error) throw error
          const displayName = name.trim() || String(data.user.user_metadata.name ?? data.user.email?.split('@')[0] ?? 'Pessoa')
          dispatch({ type: 'auth/signIn', account: emptyState(displayName, mail) })
        }
        setPassword(''); setConfirm(''); location.hash = '/'
      } catch (error) {
        setErrors({ form: error instanceof Error ? error.message : 'Não foi possível entrar. Tente novamente.' })
      } finally { setLoading(false) }
      return
    }
    setErrors({ form: 'O acesso não está configurado. Configure a conexão com o Supabase antes de entrar ou criar uma conta.' })
  }

  return (
    <main className="mx-auto grid min-h-dvh w-full max-w-[1180px] items-center gap-10 px-4 py-10 lg:grid-cols-2 lg:gap-16 lg:px-6">
      <section className="hidden flex-col gap-6 lg:flex" aria-label="Eskgo">
        <span className="text-[28px] font-bold tracking-[-0.04em] text-esk-lime">Eskgo</span>
        <div className="bg-hero flex min-h-[340px] flex-col justify-between rounded-hero p-9 text-esk-ink">
          <span className="font-mono text-[12px] tracking-[0.14em]">FINANÇAS</span>
          <div className="flex flex-col gap-3"><span>Seu saldo</span><span className="num text-[66px] font-medium leading-none">{money(14500)}</span><span className="flex items-center gap-2 text-[15px]"><Icon name="check" size={16} /> Seu dinheiro, no seu ritmo.</span></div>
        </div>
        <p className="max-w-[420px] text-[22px] leading-snug text-esk-text-2">Seu assistente financeiro para grandes conquistas.</p>
      </section>
      <section className="mx-auto flex w-full max-w-[420px] flex-col gap-6">
        <span className="text-[26px] font-bold tracking-[-0.04em] text-esk-lime lg:hidden">Eskgo</span>
        <div className="flex flex-col gap-2"><span className="kicker">Seu próximo passo começa aqui</span><h1 className="text-[32px] font-medium tracking-[-0.03em]">{mode === 'login' ? 'Entrar na sua conta' : mode === 'cadastro' ? 'Criar sua conta' : resetting ? 'Defina uma nova senha' : 'Recuperar acesso'}</h1><p className="text-[15px] text-esk-text-2">{mode === 'recuperar' ? resetting ? 'Escolha uma senha nova para sua conta.' : 'Informe o e-mail da sua conta.' : 'Organize o hoje. Conquiste o que vem depois.'}</p></div>
        {mode !== 'recuperar' && <nav aria-label="Acesso" className="grid grid-cols-2 gap-1 rounded-full bg-esk-elevated p-1">{(['login', 'cadastro'] as const).map((item) => <button key={item} onClick={() => switchMode(item)} aria-current={mode === item ? 'page' : undefined} className={`h-11 rounded-full text-[14px] font-medium ${mode === item ? 'bg-esk-lime text-esk-ink' : 'text-esk-text-2'}`}>{item === 'login' ? 'Login' : 'Cadastro'}</button>)}</nav>}
        {sent ? <div role="status" className="flex flex-col gap-4 rounded-hero bg-esk-surface p-6"><Icon name="check" size={28} className="text-esk-lime" /><h2 className="text-[22px]">{recoveryComplete ? 'Senha atualizada' : mode === 'recuperar' ? (supabase ? 'Confira seu e-mail' : 'Solicitação demonstrada') : 'Confirme seu e-mail'}</h2><p className="text-[14px] text-esk-text-2">{recoveryComplete ? 'Agora você pode entrar usando sua nova senha.' : supabase ? (mode === 'recuperar' ? 'Se houver uma conta com esse endereço, você receberá as instruções para recuperar o acesso.' : 'Enviamos um link de confirmação. Depois, entre com seu e-mail e senha.') : 'Na versão conectada, as instruções serão enviadas por e-mail. Nesta demonstração nenhum e-mail foi enviado.'}</p><PrimaryButton onClick={() => switchMode('login')}>Voltar para entrar</PrimaryButton></div> : <form onSubmit={submit} noValidate className="flex flex-col gap-4" aria-busy={loading}>
          {errors.form && <p role="alert" className="rounded-2xl border border-esk-lilac-strong/30 bg-esk-lilac-strong/10 p-4 text-[13px] text-esk-lilac">{errors.form}</p>}
          <fieldset disabled={loading} className="flex min-w-0 flex-col gap-4">
            {mode === 'cadastro' && <Field label="Nome" error={errors.name}><input className={inputCls} autoComplete="given-name" placeholder="Opcional" value={name} onChange={(e) => setName(e.target.value)} aria-invalid={!!errors.name} maxLength={60} /></Field>}
            {!(mode === 'recuperar' && resetting) && <Field label="E-mail" error={errors.email}><input className={inputCls} type="email" autoComplete="email" placeholder={supabase ? 'voce@exemplo.com' : 'Opcional'} value={email} onChange={(e) => setEmail(e.target.value)} aria-invalid={!!errors.email} maxLength={254} /></Field>}
            {(mode !== 'recuperar' || resetting) && <div className="flex flex-col gap-2"><label htmlFor="password" className="text-[13px] text-esk-text-2">Senha</label><div className="relative"><input id="password" className={`${inputCls} pr-14`} type={showPass ? 'text' : 'password'} autoComplete={mode === 'login' ? 'current-password' : 'new-password'} placeholder={supabase ? 'Obrigatória' : 'Opcional'} value={password} onChange={(e) => setPassword(e.target.value)} aria-invalid={!!errors.password} aria-describedby={errors.password ? 'password-error' : undefined} maxLength={128} /><button type="button" onClick={() => setShowPass((value) => !value)} aria-label={showPass ? 'Esconder senha' : 'Mostrar senha'} className="absolute right-1 top-1 grid size-11 place-items-center rounded-full text-esk-text-2"><Icon name={showPass ? 'eyeOff' : 'eye'} size={18} /></button></div>{errors.password && <span id="password-error" role="alert" className="text-[12px] text-esk-lilac">{errors.password}</span>}</div>}
            {(mode === 'cadastro' || resetting) && <Field label="Confirmar senha" error={errors.confirm}><input className={inputCls} type={showPass ? 'text' : 'password'} autoComplete="new-password" placeholder={supabase ? 'Obrigatória' : 'Opcional'} value={confirm} onChange={(e) => setConfirm(e.target.value)} aria-invalid={!!errors.confirm} /></Field>}
            {mode === 'login' && <button type="button" className="self-end py-1 text-[13px] text-esk-lime" onClick={() => switchMode('recuperar')}>Esqueci minha senha</button>}
            <PrimaryButton type="submit" disabled={loading}>{loading ? 'Aguarde…' : mode === 'login' ? 'Entrar' : mode === 'cadastro' ? 'Criar conta' : resetting ? 'Salvar nova senha' : 'Solicitar recuperação'}</PrimaryButton>
          </fieldset>
        </form>}
        {mode === 'recuperar' && !sent && <button className="text-[14px] text-esk-lime" onClick={() => switchMode('login')}>Voltar para entrar</button>}
        <p className="text-[12px] leading-relaxed text-esk-muted">{supabase ? 'Autenticação protegida pelo Supabase. Os dados financeiros permanecem locais neste navegador.' : 'Acesso livre nesta fase de front-end: os campos são opcionais e o botão entra direto. Nenhuma senha é salva ou enviada.'}</p>
      </section>
    </main>
  )
}
