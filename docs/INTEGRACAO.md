# Eskgo — contrato de integração (front → backend)

O front está fechado e validado com dados locais. Toda mudança de dado passa por **uma ação do store** (`src/store.tsx`). Integrar o backend é trocar cada ação por uma chamada ao Supabase ou à API, **sem mexer nas telas**.

- Persistência local de demonstração: `src/services/dataSource.ts` (localStorage).
- Quando `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` estão configuradas, autenticação usa Supabase Auth e `src/services/supabaseDataSource.ts` carrega/salva perfil, cartões, transações, tetos e metas usando RLS. Contas sem dados recebem o fixture de demonstração do banco uma única vez; contas com qualquer registro não são preenchidas.
- Cliente IA hoje: `src/services/ai.ts` → rotas `api/*` (Vercel). Sem `VITE_FEATURE_AI=true`, usa simulação local (`invoiceMock.ts`, `insights.ts`).
- Schema: `supabase/migrations/0001_init.sql` + `0002_front_alignment.sql` + `0003_backend_crud.sql`. Ver também [`SCHEMA_PRISMA.md`](SCHEMA_PRISMA.md).

## 1. Autenticação

| Tela / ação | Hoje (local) | Supabase |
|---|---|---|
| Login → `auth/signIn` | Entra direto (acesso livre) | `supabase.auth.signInWithPassword({ email, password })` |
| Cadastro → `auth/signUp` | Entra direto | `supabase.auth.signUp({ email, password, options: { data: { name } } })` — o trigger `handle_new_user` cria o `profile` |
| Esqueci a senha | Mostra confirmação | `supabase.auth.resetPasswordForEmail(email)` |
| Conta → Sair → `session/set` | Marca `signedOut` | `supabase.auth.signOut()` |
| Sessão ao abrir | `localStorage` | `supabase.auth.getSession()` + `onAuthStateChange` |

Reativar a validação de e-mail/senha em `src/screens/Auth.tsx` (removida na fase de acesso livre).

## 2. Dados (ação do store → tabela)

| Ação | Tela | Tabela / operação | Efeitos que o backend deve replicar |
|---|---|---|---|
| `tx/add` | Folha Adicionar | `insert transactions` | `profiles.balance -= value`; se cartão, `cards.invoice += value` |
| `tx/update` | Detalhe da compra | `update transactions` | desfaz o valor antigo e aplica o novo (saldo e fatura) |
| `tx/delete` | Detalhe da compra | `delete transactions` | devolve saldo e fatura |
| `card/add` · `card/update` · `card/delete` | Novo/editar/remover cartão | `insert/update/delete cards` | `card/add` também define `profiles.front_card_id`; ao excluir, manter transações históricas e ajustar o cartão da frente |
| `card/front` | Pilha de cartões | `update profiles.front_card_id` | — |
| `goal/add` · `goal/update` · `goal/delete` | Criar/editar/excluir objetivo | `insert/update/delete goals` | Exclusão devolve ao saldo local o valor guardado; a regra precisa ser atômica no backend |
| `goal/save` | Guardar valor | `update goals.saved += amount` | `profiles.balance -= amount` (bloqueado se `amount > balance`) |
| `budget/set` · `budget/delete` | Criar/editar/remover teto por categoria | `upsert/delete budgets (user_id, category)` | O estado local usa `0` para representar teto removido; no banco, remover a linha é preferível |
| `monthCap/set` · `monthCap/delete` | Ajustar/remover teto mensal | `update profiles.month_cap` | `0` representa teto mensal não definido no front atual |
| `balance/set` | Registrar saldo | `update profiles.balance` | — |
| `balance/toggle` | Olho no saldo | `update profiles.hide_balance` | — |
| `plus/toggle` | Conta → Eskgo Plus | `update profiles.plus` | — |
| `invoice/import` | Fatura → Confirmar | `insert invoices` + `insert transactions` (lote, `source='invoice'`) | `cards.invoice = total`; `balance -= soma`; `unique(user_id, fingerprint)` impede duplicar |

**Implementação no schema:** triggers aplicam os efeitos de saldo/fatura em transações e aportes; `import_invoice` grava fatura e itens atomicamente. `seed_my_demo_data()` insere o fixture somente por chamada explícita de uma sessão autenticada e só em conta vazia. O front ainda não chama essas operações.

### Mapeamento de campos

| Front (`src/data.ts`) | Banco |
|---|---|
| `Transaction.date` | `transactions.spent_on` |
| `Transaction.method` (id do cartão, `pix`, `dinheiro`) | `card_id` + `method` (`card`/`pix`/`dinheiro`) |
| `Card.limit` · `Card.dueDays` | `credit_limit` · calcular de `due_day` |
| `Goal.date` ("Dez 2027") | `target_label` |
| `State.frontCardId` · `plus` · `monthCap` | `profiles.front_card_id` · `plus` · `month_cap` |
| `State.importedInvoices` | `invoices.fingerprint` |

## 3. IA (estágio 2) — rotas de servidor

| Rota | Entrada | Saída | Usada em |
|---|---|---|---|
| `POST /api/invoice` | `{ name, mimeType, base64 }` (PDF/JPG/PNG/WebP ≤ 3 MiB) + JWT | `{ total, items[{ name, value, date, category, subscription }] }` | `Fatura.tsx` via `readInvoice()` |
| `POST /api/chat` | `{ messages[{ role, content }], context, attachment? }` + JWT | `{ reply }` | `Assistente.tsx` via `askAssistant()`; anexo PDF/JPG/PNG/WebP ≤ 3 MiB |

- Erros: 400 JSON inválido · 413 arquivo grande · 415 tipo · 502 falha OpenAI · 503 sem `OPENAI_API_KEY`. O front já mostra erro + "Tentar novamente".
- As rotas agora exigem JWT do Supabase (`Authorization: Bearer`) e aplicam um limitador em memória por instância. Antes de produção: buscar o contexto no servidor (não confiar no enviado pelo navegador), configurar rate limit distribuído no firewall e validar as variáveis de ambiente.
- Respostas com destaque (card em gradiente) hoje vêm só do modo local; para a OpenAI devolver `highlight`, ampliar o schema de `/api/chat`.

## 4. Ordem sugerida

1. Revisar e aplicar em ordem as três migrations (`0001`, `0002`, `0003`) no Supabase. A migração `0003` adiciona permissões/RLS, integridade, RPCs e bucket privado; preserve as contas existentes de Auth.
2. Configurar `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` no `.env` local e no Vercel. Sem essas duas variáveis, o app permanece na demonstração local.
3. O login/cadastro, a carga dos dados e as operações principais de CRUD estão ligados ao Supabase. A integração de importação da Fatura com upload do arquivo e `import_invoice` ainda precisa ser concluída antes de usar esse fluxo.
4. Vercel: importar o repositório do Eskgo-Claude (raiz do projeto), configurar variáveis de ambiente, `OPENAI_API_KEY` se as rotas de IA forem usadas.
5. Ligar `VITE_FEATURE_AI=true` somente após configurar as rotas e validar Assistente e Fatura em conta de teste.
