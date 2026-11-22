import { env, isSupabaseConfigured } from './env'
import { createClient } from '@supabase/supabase-js'

/**
 * Cliente opcional. A persistência continua local; a sessão autentica as
 * chamadas de IA quando as credenciais públicas do Supabase são configuradas.
 */
export const supabase = isSupabaseConfigured
  ? createClient(env.supabaseUrl, env.supabaseAnonKey)
  : null

export const supabaseConfig = {
  url: env.supabaseUrl,
  enabled: isSupabaseConfigured,
}
