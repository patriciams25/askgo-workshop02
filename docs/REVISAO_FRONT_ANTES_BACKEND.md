# Revisão do front-end antes do backend

Checklist de produto e integração para validar com o briefing. “Front local” significa que a operação existe no estado/localStorage do navegador; não significa que já persista na conta do usuário no servidor.

## Acesso e conta

- [ ] Entrar com e-mail e senha válidos.
- [ ] Recusar credenciais inválidas com mensagem compreensível.
- [ ] Criar conta com nome, e-mail, senha e confirmação.
- [ ] Confirmar conta por e-mail, quando exigido pelo provedor.
- [ ] Solicitar recuperação de senha e abrir o link recebido.
- [ ] Definir nova senha e conseguir entrar com ela.
- [ ] Restaurar sessão ao recarregar a página.
- [ ] Sair e impedir acesso às telas privadas após o logout.
- [ ] Manter os dados isolados por `user_id`; nunca carregar dados de outra conta.
- [ ] Permitir visualizar e editar dados de perfil previstos no escopo.
- [ ] Confirmar como exclusão da conta e retenção/remoção dos dados serão tratadas.

## Home

- [ ] Visualizar saldo disponível e ocultar/revelar o valor.
- [ ] Registrar e editar o saldo inicial sem criar um gasto fictício.
- [ ] Exibir gastos do mês, comparação, categorias e limite mensal.
- [ ] Distinguir teto não configurado de teto igual a zero.
- [ ] Abrir o detalhe de cada gasto e navegar para cartões, metas, fatura e assistente.
- [ ] Atualizar totais após criar, editar, excluir ou importar um gasto.
- [ ] Exibir estados vazios, carregamento e falhas de leitura.

## Gastos e valores financeiros — CRUD

- [ ] **Criar:** valor positivo, descrição, categoria, forma de pagamento e data.
- [ ] **Ler:** listar e abrir detalhes, com filtros/ordenação conforme o briefing final.
- [ ] **Atualizar:** alterar qualquer campo e recalcular saldo e fatura sem duplicar efeitos.
- [ ] **Excluir:** pedir confirmação, remover o lançamento e reverter saldo/fatura.
- [ ] Validar centavos, datas inválidas, valores vazios e limites de entrada.
- [ ] Preservar histórico e origem do lançamento (manual ou importado).
- [ ] Ao editar/excluir lançamento importado, manter coerentes a fatura e a possibilidade de reimportar.
- [ ] Evitar duplicidade de IDs e garantir que usuário não leia/edite/exclua lançamento alheio.
- [ ] Definir se saldo é apenas fotografia atual ou se haverá CRUD de receitas/movimentações de saldo. Hoje o saldo é um campo editável, sem histórico próprio.

## Cartões — CRUD

- [ ] **Criar:** apelido, final, limite, vencimento, fatura inicial e cor.
- [ ] **Ler:** carteira, cartão em destaque, limite usado e próximas faturas.
- [ ] **Atualizar:** editar dados e fatura sem apagar compras associadas.
- [ ] **Excluir:** confirmar remoção, ajustar cartão em destaque e preservar os gastos históricos.
- [ ] Validar final numérico com quatro dígitos, limite, vencimento e valor da fatura.
- [ ] Ao excluir cartão, manter associação histórica inteligível e impedir novo vínculo a cartão excluído.
- [ ] Definir o comportamento de exclusão com fatura/importação pendente.

## Tetos e metas de gastos — CRUD

- [ ] **Criar:** teto mensal e teto por categoria.
- [ ] **Ler:** valores, gasto acumulado, percentual e disponibilidade.
- [ ] **Atualizar:** alterar teto e refletir imediatamente na Home, em Metas e nos insights.
- [ ] **Excluir:** remover teto mensal ou por categoria sem apagar gastos.
- [ ] Exibir “sem teto” quando removido, sem calcular falsamente estouro de limite.
- [ ] Validar valor não negativo, moeda e categorias permitidas.
- [ ] Persistir tetos por usuário e categoria; impedir categorias duplicadas.

## Objetivos de economia — CRUD

- [ ] **Criar:** nome, valor-alvo, prazo opcional e ícone.
- [ ] **Ler:** lista, progresso, valor guardado e prazo.
- [ ] **Atualizar:** editar nome, alvo, prazo e ícone; impedir alvo menor que o valor guardado.
- [ ] **Excluir:** confirmar e definir claramente o destino do valor já reservado.
- [ ] **Guardar valor:** validar saldo disponível e aplicar a movimentação de forma atômica.
- [ ] Definir se será possível desfazer/editar aportes individuais; hoje o total guardado não tem histórico de aportes.
- [ ] Garantir que saldo e objetivo não fiquem divergentes em falhas ou requisições repetidas.

## Importação de fatura

- [ ] Escolher PDF/JPG/PNG/WebP, validar tipo/tamanho e mostrar erro para arquivo vazio ou inválido.
- [ ] Mostrar progresso, resultado extraído e total conferível.
- [ ] Permitir selecionar/desselecionar itens antes de confirmar.
- [ ] **Criar/Ler/Atualizar/Excluir** lançamentos importados com mesma segurança dos lançamentos manuais.
- [ ] Associar fatura ao usuário e cartão; guardar fingerprint para bloquear duplicidade.
- [ ] Reconciliar total da fatura com itens selecionados, saldo e cartão sem dupla contagem.
- [ ] Tratar análise indisponível, resposta inválida, limite de tamanho e sessão expirada.
- [ ] Informar quando o documento será enviado a um serviço de IA e como será retido.

## Assistente e anexos

- [ ] Enviar pergunta, receber resposta, continuar conversa e iniciar nova conversa.
- [ ] Usar contexto financeiro obtido no servidor para o usuário autenticado, sem confiar em valores enviados pelo navegador.
- [ ] Anexar PDF/JPG/PNG/WebP, remover anexo, ver nome/tamanho e validar limite.
- [ ] Mostrar claramente se o arquivo será enviado à IA; não simular análise do anexo no modo demonstração.
- [ ] Tratar sessão inválida, limite de requisições, falha de rede e resposta vazia com opção de tentar novamente.
- [ ] Limitar dados pessoais e financeiros enviados ao provedor; documentar retenção e privacidade.

## Conta e preferências

- [ ] Alternar exibição do saldo.
- [ ] Exibir estado do plano/IA sem apresentar um toggle de demonstração como compra real.
- [ ] Confirmar logout e invalidar sessão no servidor.
- [ ] Isolar preferências e histórico de conversa por conta/dispositivo conforme decisão do produto.

## Preparação do esquema e do backend

- [x] Preparar migrações `0001`–`0003`, `prisma/schema.prisma`, grants e policies CRUD por dono; aplicação remota e teste PostgreSQL continuam pendentes.
- [x] Definir `user_id` obrigatório em entidades do usuário, RLS para SELECT/INSERT/UPDATE/DELETE e ownership das relações no SQL.
- [ ] Para uma linha relacionada, validar que o `card_id` pertence ao mesmo `user_id` da transação.
- [ ] Validar também que `profiles.front_card_id` pertence ao próprio perfil; uma FK simples para `cards.id` não garante ownership entre usuários.
- [ ] Mapear IDs locais string para UUIDs do banco; o front atual usa IDs de demonstração que não são UUID.
- [ ] Mapear método do front (ID do cartão, `pix`, `dinheiro`) para `card_id` e enum `method` do banco.
- [ ] Definir exclusões e integridade referencial: exclusão de cartão preserva transações; exclusão de conta remove/anônima os dados conforme política.
- [ ] Configurar as variáveis públicas do projeto (`VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY`) no ambiente local e Vercel para ativar Auth e persistência Supabase; sem elas o app segue no modo local.
- [ ] Integrar o fluxo de importação de Fatura ao bucket privado e à função `import_invoice`.
- [x] Preparar triggers/RPC para efeitos atômicos de transação, aporte e importação; falta conectá-los ao front.
- [ ] Tratar conflitos, repetição/idempotência, paginação, falhas offline e atualizações concorrentes.
- [x] Criar índices e restrições para unicidade, valores, categorias e relações nas migrations.
- [ ] Não expor chave `service_role` no navegador; exigir JWT nas rotas privadas.
- [ ] Aplicar rate limit distribuído no ambiente publicado; o limitador em memória por instância é apenas mitigação local.
- [ ] Configurar Supabase e OpenAI no ambiente de deploy; nenhum segredo deve ir ao bundle do cliente.

## Estado identificado nesta revisão

- [x] Front local oferece CRUD de gastos.
- [x] Front local oferece criar/listar/editar/excluir cartões; remoção preserva gastos históricos.
- [x] Front local oferece criar/listar/editar/excluir objetivos; ao excluir, o valor guardado retorna ao saldo.
- [x] Front local oferece criar/ler/editar/remover tetos mensais e por categoria; teto removido é exibido como “sem teto”.
- [x] Front local oferece aportes em objetivos, mas ainda sem histórico individual de aportes.
- [x] Assistente oferece seleção e remoção de anexo; análise real depende de Supabase e da API de IA configurados.
- [ ] Validar o CRUD ponta a ponta em conta de teste depois de preencher as variáveis de ambiente. Perfil, cartões, transações manuais, tetos e metas têm integração Supabase no código; a importação de faturas/anexos ainda não.
- [ ] A autenticação Supabase pode ser habilitada por configuração, mas os dados financeiros continuam locais; login real não equivale a sincronização nem isolamento server-side dos registros.
- [x] Modelar aportes como ledger (`goal_contributions`) para manter saldo e total guardado atômicos; integração e teste remoto pendentes.

## Verificação técnica desta alteração

- [x] `npm run build` (TypeScript do front e build Vite).
- [x] TypeScript das rotas API verificado passando os arquivos explicitamente.
- [ ] Validar migrações, RLS e operações CRUD em PostgreSQL/Supabase; nenhum servidor de banco local está disponível e a migração remota ainda não foi aplicada.
- [ ] Verificação visual/interativa de cada fluxo no navegador após estas alterações.
- [ ] Integração ponta a ponta com Supabase/OpenAI, pois as variáveis e o projeto de backend ainda não estão configurados.
