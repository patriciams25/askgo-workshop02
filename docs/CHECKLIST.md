# Eskgo — checklist de validação do front-end

Validado em 21/11/2026 no navegador (375 px e 1440 px) em `http://localhost:5180` (projeto `Eskgo-Claude/`), com `npm test`, `tsc`, `vite build` e `typecheck:api`.

Legenda: ✅ validado · 🔌 depende de configuração ou validação adicional (contrato em `docs/INTEGRACAO.md`)

## Acesso
- 🔌 Login/cadastro exigem Supabase configurado e credenciais; sem conexão o acesso é bloqueado
- 🔌 Esqueci a senha: Supabase envia link de recuperação por e-mail
- ✅ Conta → Sair → "Deseja sair?" → volta ao login, dados preservados
- 🔌 Auth real (Supabase): e-mail + senha, recuperação por e-mail, sessão

## Home
- ✅ Saldo com contagem animada; olho oculta/mostra (`R$ ••••••`)
- ✅ Atalhos estágio 2: Adicionar · Fatura · Cartões · Metas; botão Assistente no card
- ✅ Este mês: total animado, comparação com outubro, teto, barra por categoria, 3 tiles
- ✅ Transações com entrada escalonada; toque abre detalhe

## Gasto (folha Adicionar / Detalhe)
- ✅ Valor vazio → erro "Digite um valor válido" (com tremida)
- ✅ Adicionar R$ 45,90 → saldo 14.454,10 e mês 2.385,90 + aviso "registrado"
- ✅ Editar para R$ 50 → saldo 14.450 e mês 2.390 + "Gasto atualizado"
- ✅ Apagar com confirmação → volta a 14.500 / 2.340 + "Gasto apagado"
- ✅ Folha anima na entrada e na saída (X, fundo, Esc)

## Cartões
- ✅ Pilha: tocar em cartão de trás traz para frente (R$ 1.284 → R$ 640, limite 26%)
- ✅ Novo cartão: 3 erros de validação; salvar → vai para a frente + "Cartão adicionado"
- ✅ Tocar no cartão da frente → "Editar cartão" → renomear + "Cartão atualizado"
- ✅ Próximas faturas + link "Importar fatura"
- ✅ Estado vazio "Sua carteira está vazia"

## Metas e objetivos
- ✅ Ajustar teto do mês (R$ 3.500 → "Ainda pode gastar" R$ 1.160)
- ✅ Teto por categoria (Alimentação R$ 1.000 → 74%) com barras que crescem
- ✅ Guardar R$ 500 na Viagem (13.600 → 14.100; anel anima de 0 ao %)
- ✅ Guardar acima do saldo → bloqueado "Seu saldo disponível é…"
- ✅ Nova meta: validação + "Meta criada"
- ✅ Card ASSISTENTE ESKGO com insight calculado → abre o Assistente
- ✅ Estado vazio "Nenhum objetivo ainda"

## Fatura (estágio 2)
- ✅ Escolher PDF ou foto; arquivo `.txt` e vazio recusados na hora com mensagem
- ✅ "Lendo sua fatura": % + barra com brilho correndo
- ✅ Encontramos: 34 compras · 6 assinaturas · R$ 1.284; lista com entrada escalonada
- ✅ Desmarcar 1 item → "Confirmar 33 lançamentos · R$ 1.228,10"
- ✅ Confirmar → Home: saldo 13.271,90 e mês 3.568,10 (centavos corretos) + aviso
- ✅ Fatura do cartão passa a ser o total lido (não soma duas vezes)
- ✅ Mesma fatura não é importada duas vezes
- 🔌 Leitura real via OpenAI (`POST /api/invoice`)

## Assistente (estágio 2)
- ✅ Acesso pelo botão no saldo (Home) e pelo card em Metas
- ✅ Tela vazia: "Pergunte sobre seu dinheiro" + 4 sugestões
- ✅ Envio desabilitado com campo vazio e enquanto responde
- ✅ "Digitando…" com pontos animados e brilho lilás
- ✅ Resposta com efeito de escrita (cursor lima) e card em gradiente surgindo ao final
- ✅ Perguntas de continuação após cada resposta
- ✅ Respostas com dados reais: delivery, viagem (simulação de prazo), assinaturas, fatura, saldo
- ✅ Teto estourado avisado ("você passou R$ X do teto"); cumprimento; pergunta fora do escopo
- ✅ Erro de rede → mensagem destacada + "Tentar novamente" (testado com `/api/chat` indisponível)
- ✅ "Voltar" retorna à tela de origem (Home ou Metas)
- ✅ Conversa preservada ao sair e voltar; "Nova conversa" limpa
- 🔌 Respostas reais via OpenAI (`POST /api/chat`)

## Microinterações
- ✅ Troca de tela: sobe com fade · listas: entrada escalonada
- ✅ Botões afundam ao toque; tiles elevam no hover (desktop)
- ✅ Folhas: sobem/descem (celular) e aparecem/somem (desktop)
- ✅ Avisos entram com mola; erros de formulário tremem
- ✅ Números contam até o valor; barras e anel crescem ao aparecer
- ✅ Gradiente do hero se move devagar
- ✅ "Reduzir movimento" do sistema desliga tudo, inclusive loops

## Qualidade
- ✅ Sem rolagem horizontal em todas as telas (375 px e 1440 px)
- ✅ `tsc`, `vite build`, `typecheck:api` e `npm test` passando
- ✅ Nenhum segredo no bundle do navegador

## Integração Supabase e próximos passos
- ✅ Migrations 0001, 0002 e 0003 aplicadas no projeto remoto; tabelas, RLS e bucket confirmados
- ✅ Auth Supabase e persistência de perfil, cartões, transações manuais, tetos e metas integrados no código
- 🔌 Preencher a chave pública `VITE_SUPABASE_ANON_KEY` no `.env` local e no Vercel para ativar a conexão
- 🔌 Testar CRUD com conta dedicada; a carga inicial de dados fictícios ocorre apenas em conta vazia
- 🔌 Conectar upload de anexo e importação de Fatura à RPC `import_invoice`
- 🔌 Vercel: configurar variáveis e `OPENAI_API_KEY`; ligar `VITE_FEATURE_AI=true` após validar as rotas
- 🔌 Rotas `/api/*`: validar JWT do Supabase e carregar contexto confiável no servidor
