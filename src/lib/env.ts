/**
 * Configuração pública do front-end, lida de variáveis VITE_.
 * Tudo aqui vai para o bundle — nunca coloque segredos.
 */
const clean = (v?: string) => (v ?? '').trim()

export const env = {
  supabaseUrl: clean(import.meta.env.VITE_SUPABASE_URL),
  supabaseAnonKey: clean(import.meta.env.VITE_SUPABASE_ANON_KEY),
  apiBaseUrl: clean(import.meta.env.VITE_API_BASE_URL) || '/api',
  featureAI: clean(import.meta.env.VITE_FEATURE_AI) === 'true',
} as const

/** true quando URL e anon key do Supabase foram preenchidas no .env. */
export const isSupabaseConfigured = Boolean(env.supabaseUrl && env.supabaseAnonKey)
