import type { State } from '../data'

/**
 * Contrato de persistência do app.
 *
 * Hoje: `localDataSource` (localStorage, só neste navegador).
 * Depois: um `supabaseDataSource` que implementa o mesmo contrato
 * (tabelas em supabase/migrations) — as telas não mudam.
 */
export interface DataSource {
  load(fallback: State): State
  save(state: State): void
}

const KEY = 'eskgo:v1'

export const localDataSource: DataSource = {
  load(fallback) {
    try {
      const raw = localStorage.getItem(KEY)
      if (raw) return { ...fallback, ...JSON.parse(raw) }
    } catch { /* storage indisponível: segue com os dados de exemplo */ }
    return fallback
  },
  save(state) {
    try { localStorage.setItem(KEY, JSON.stringify(state)) } catch { /* ignora */ }
  },
}

/** Fonte de dados ativa. Troque aqui quando o Supabase entrar. */
export const dataSource: DataSource = localDataSource

const ACCOUNTS_KEY = 'eskgo:demo-accounts:v1'
export function archiveAccount(state: State) {
  try {
    const accounts = JSON.parse(localStorage.getItem(ACCOUNTS_KEY) ?? '{}')
    accounts[state.user.email.toLowerCase()] = state
    localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(accounts))
  } catch { /* demonstração sem storage */ }
}
export function findLocalAccount(email: string): State | undefined {
  try { return JSON.parse(localStorage.getItem(ACCOUNTS_KEY) ?? '{}')[email.toLowerCase()] } catch { return undefined }
}
