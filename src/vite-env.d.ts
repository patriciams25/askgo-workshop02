/// <reference types="vite/client" />

// Somente variáveis VITE_ (públicas) existem no navegador.
// Segredos como OPENAI_API_KEY NÃO devem ser declarados aqui.
interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL?: string
  readonly VITE_SUPABASE_ANON_KEY?: string
  readonly VITE_FEATURE_AI?: string
  readonly VITE_API_BASE_URL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
