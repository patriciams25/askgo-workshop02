import { createClient } from '@supabase/supabase-js'
import { json } from './_openai'

const windows = new Map<string, { start: number; count: number }>()
const WINDOW_MS = 60_000
const MAX_REQUESTS = 12

/** Verifica o bearer JWT contra o servidor Auth do Supabase em cada chamada. */
export async function requireSupabaseUser(request: Request): Promise<{ id: string } | Response> {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  const anonKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY
  if (!url || !anonKey) return json({ error: 'Autenticação Supabase não configurada no servidor.' }, 503)

  const authorization = request.headers.get('authorization') ?? ''
  const token = /^Bearer\s+([^\s]+)$/i.exec(authorization)?.[1]
  if (!token) return json({ error: 'Entre na sua conta para usar a IA.' }, 401)

  try {
    const client = createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } })
    const { data, error } = await client.auth.getUser(token)
    if (error || !data.user) return json({ error: 'Sessão inválida ou expirada.' }, 401)
    return { id: data.user.id }
  } catch {
    return json({ error: 'Não foi possível validar a sessão.' }, 503)
  }
}

export function isResponse(value: { id: string } | Response): value is Response {
  return value instanceof Response
}

/** Protege cada instância aquecida contra rajadas; limites distribuídos ficam no firewall do deploy. */
export function enforceBurstLimit(userId: string): Response | null {
  const now = Date.now()
  const current = windows.get(userId)
  if (!current || now - current.start >= WINDOW_MS) {
    windows.set(userId, { start: now, count: 1 })
    return null
  }
  if (current.count >= MAX_REQUESTS) return json({ error: 'Muitas solicitações. Aguarde um minuto e tente novamente.' }, 429)
  current.count += 1
  return null
}
