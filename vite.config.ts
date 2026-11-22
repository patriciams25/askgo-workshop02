import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// Eskgo (Claude) roda sempre em http://localhost:5180.
// A porta 5173 é do projeto do Codex (pasta Eskgo/app) — strictPort evita colisão.
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: { port: 5180, strictPort: true, open: false },
  preview: { port: 5181, strictPort: true },
})
