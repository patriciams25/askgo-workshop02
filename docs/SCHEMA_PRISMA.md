# Banco de dados e Prisma

## Escopo e fonte da verdade

O modelo relacional do Eskgo está definido nas migrations `supabase/migrations/0001_init.sql`, `0002_front_alignment.sql` e `0003_backend_crud.sql`. O arquivo `prisma/schema.prisma` documenta os modelos que a aplicação poderá consultar pelo Prisma. As migrations SQL continuam sendo a fonte da verdade para RLS, grants, constraints, funções, triggers e Storage; não use `prisma db push` para alterar o Supabase.

O projeto Supabase tem Auth gerenciado. `auth.users` e `storage.objects` não são modelos gerenciados pelo Prisma. As referências de usuário usam UUID e os dados financeiros são isolados por `auth.uid()`.

## Modelos

| Modelo Prisma | Tabela | Operações / observações |
|---|---|---|
| `Profile` | `public.profiles` | Ler e editar o próprio perfil. Perfil é criado pelo trigger de Auth; cliente não insere nem exclui. |
| `Card` | `public.cards` | CRUD próprio; referências para faturas e transações do mesmo usuário são validadas. |
| `Transaction` | `public.transactions` | CRUD próprio; triggers ajustam saldo e fatura de cartão de forma atômica. |
| `Budget` | `public.budgets` | CRUD próprio; chave composta usuário + categoria. |
| `Goal` | `public.goals` | CRUD do objetivo; `saved` é derivado do ledger de contribuições. |
| `GoalContribution` | `public.goal_contributions` | CRUD próprio; operações ajustam saldo e total poupado atomicamente. |
| `Invoice` | `public.invoices` | Metadados próprios, vinculados a cartão e transações; importação atômica pela RPC `import_invoice`. |

## Storage

O bucket `invoice-files` é privado. Os objetos ficam sob `{auth.uid()}/invoices/...`, aceitam PDF, JPEG, PNG ou WebP até 3 MiB. As políticas de `storage.objects` permitem ao usuário selecionar, inserir, atualizar e excluir objetos apenas na pasta do próprio UUID. Anexos temporários do assistente não são persistidos neste bucket.

## RPCs e consistência

- `import_invoice(...)`: importa metadados e itens de fatura em uma transação, com validações de usuário, cartão, arquivo e deduplicação por fingerprint.
- `seed_my_demo_data()`: copia o fixture fictício privado para uma conta autenticada somente quando ainda não há dados financeiros. A carga é iniciada pela primeira abertura da conta vazia.
- Triggers mantêm perfil, saldo, faturas de cartão e metas consistentes. O total guardado de uma meta é derivado de `goal_contributions`, não deve ser alterado diretamente.

## CRUD e isolamento

As tabelas expostas em `public` recebem grants explícitos para `authenticated` e policies RLS de `SELECT`, `INSERT`, `UPDATE` e `DELETE` por proprietário. `anon` não recebe acesso. `profiles` é exceção intencional: permite `SELECT` e `UPDATE` próprios; criação e exclusão pertencem ao fluxo de Auth. RPCs e buckets têm grants/policies separados.

## Estado desta implementação

- [x] Schema SQL, constraints, índices e triggers preparados.
- [x] Policies/grants CRUD por usuário preparados.
- [x] Prisma schema alinhado com as tabelas públicas.
- [x] Fixture fictício separado de contas de Auth existentes.
- [x] Aplicar migrations ao projeto remoto `exfjakfhoovtayyvtjlm` (verificado no SQL Editor).
- [ ] Validar Prisma e migrations em PostgreSQL/Supabase local ou remoto.
- [x] Implementar integração de Auth e CRUD principal em `src/services/supabaseDataSource.ts`.
- [ ] Configurar a chave pública no `.env` local e validar operações com uma conta autenticada.
- [ ] Conectar importação de faturas e anexos ao bucket e RPCs.

Para habilitar o backend de ponta a ponta, configure `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` no ambiente do front e as variáveis de servidor documentadas em `.env.example`. Nunca inclua `service_role` no bundle do navegador.
