# Eskgo

App de finanças pessoais em React 19, TypeScript, Vite e Tailwind CSS 4. Contempla o ciclo visual do briefing, com Home, Cartões, Metas (incluindo objetivos), Fatura, Assistente, Login e Cadastro, sem sidebar no desktop.

## Estado atual

Login e cadastro usam Supabase Auth quando a URL e a chave pública do projeto estão configuradas. Sem conexão, o app bloqueia o acesso em vez de aceitar uma sessão demonstrativa.

Com Supabase configurado, perfil, cartões, transações manuais, tetos e metas são carregados e gravados na conta autenticada. Uma conta financeira vazia recebe o conjunto de demonstração guardado no banco. A importação de fatura e o envio de anexos ainda precisam ser ligados ao Storage e à RPC `import_invoice`.

Veja o [checklist de validação](docs/CHECKLIST.md), o [contrato de integração](docs/INTEGRACAO.md) e o [schema Prisma](docs/SCHEMA_PRISMA.md).

## Executar

Este é o projeto **Eskgo-Claude** e deve ser a raiz do repositório.

```sh
npm install
npm run dev
```

Abra **http://localhost:5180** (porta fixa; se estiver ocupada, o Vite avisa em vez de trocar). `npm run build` gera a versão de produção, `npm run preview` serve em http://localhost:5181 e `npm test` roda os testes de estado.

### Storybook

Execute `npm run storybook` e abra **http://localhost:6006** para explorar as telas e os componentes isoladamente. `npm run build-storybook` gera a versão estática em `storybook-static/`.

As telas de referência do design estão em `referencias/`.

## Estrutura

```
Eskgo-Claude/
├── .env                 # valores reais locais — ignorado pelo Git
├── .env.example         # modelo versionado, sem segredos
├── .gitignore
├── vercel.json          # build Vite + rewrites SPA + headers
├── api/                 # Vercel Functions (servidor) — exemplos OpenAI
│   ├── _openai.ts       #   helper (prefixo _ = não vira rota)
│   ├── chat.ts          #   POST /api/chat     → assistente
│   └── invoice.ts       #   POST /api/invoice  → leitura de fatura
├── supabase/migrations/ # schema + RLS aplicado ao projeto remoto
├── docs/                # CHECKLIST.md e INTEGRACAO.md
├── tests/               # testes de estado (npm test)
├── referencias/         # telas de referência do design
└── src/
    ├── lib/env.ts       # variáveis VITE_ tipadas (públicas)
    ├── lib/supabase.ts  # ponto de entrada do Supabase (desligado)
    ├── services/
    │   ├── dataSource.ts  # contrato de persistência (hoje localStorage)
    │   └── ai.ts          # cliente das rotas /api (estágio 2)
    ├── components/  screens/  sheets.tsx  store.tsx  data.ts
```

## Variáveis de ambiente e segurança

```sh
cp .env.example .env   # já existe um .env vazio; preencha os valores
```

- Só variáveis `VITE_*` vão para o navegador. Use-as apenas para valores públicos (URL e anon key do Supabase, flags).
- `OPENAI_API_KEY` e `SUPABASE_SERVICE_ROLE_KEY` **não** têm prefixo `VITE_` e só são lidas em `api/*` (servidor).
- O `.env` está no `.gitignore`; só o `.env.example` sobe para o GitHub.
- Na Vercel, cadastre as mesmas chaves em *Project Settings → Environment Variables* e use a raiz do repositório (este projeto não fica em subpasta).

## Próximas etapas

1. Configure `VITE_SUPABASE_ANON_KEY` no `.env` local e valide a conexão autenticada.
2. Integre upload/importação de fatura e anexos do assistente com Storage e rotas do servidor.
3. Na Vercel, configure as variáveis e valide o fluxo completo antes de ligar `VITE_FEATURE_AI=true`.

## Telas (rotas por hash)

| Rota | Tela | Estágio |
|------|------|---------|
| `#/login` · `#/cadastro` | Login / Cadastro por e-mail e senha | Supabase Auth |
| `#/recuperar` | Recuperação de acesso por e-mail | Supabase Auth |
| `#/` | Home | 1 (+ atalho Fatura e botão Assistente no 2) |
| `#/cartoes` | Cartões | 1 |
| `#/metas` | Metas: orçamento e objetivos juntos, também no celular | 1 (+ card ASSISTENTE ESKGO no 2) |
| `#/fatura` | Importar fatura: escolher → lendo → confirmar | 2 |
| `#/assistente` | Chat "Pergunte sobre seu dinheiro" | 2 |

O estágio 2 liga e desliga em **Conta → Eskgo Plus · IA**. Sem `VITE_FEATURE_AI=true`, a leitura da fatura e as respostas do chat são simuladas no navegador (`src/services/invoiceMock.ts` e `src/services/insights.ts`).

## Funcionalidades

- Saldo ocultável, gastos mensais, categorias e transações.
- Adicionar, editar e apagar compras em uma folha, com valor, descrição, categoria, forma de pagamento e data.
- Carteira empilhada: selecione um cartão ao fundo para trazê-lo à frente; toque no cartão da frente para editar. O botão + cria um cartão.
- Teto mensal e tetos por categoria editáveis.
- Criar objetivos e guardar valores, com atualização do saldo e do progresso. Valores acima do saldo disponível são bloqueados.
- Conta e saída local que preserva os registros.
- Toasts, estados vazios, validação, navegação por hash, foco contido nas folhas, Escape para fechar e respeito à preferência por movimento reduzido.

## Dados e limites

Sem as variáveis públicas do Supabase, o app não permite entrar. Com elas configuradas, os dados ficam na conta autenticada e são protegidos por RLS. O conjunto fictício é carregado somente quando a conta não possui registros financeiros. Não há movimentação bancária.

Fatura, leitura por IA e chat pertencem ao estágio 2 e não estão implementados. A evolução precisa de backend e integração OpenAI com chave exclusivamente no servidor.

As fontes Satoshi e IBM Plex Mono são carregadas de serviços externos, com fallback de sistema.

## Validação realizada

- Build de produção com TypeScript e Vite.
- Navegador: adicionar R$ 25,50, recarregar e verificar persistência, editar para R$ 26,50 e apagar; saldo e total mensal recalculados em cada etapa.
- Guardar R$ 500: objetivo de R$ 13.600 para R$ 14.100 e saldo de R$ 14.500 para R$ 14.000, sem alterar os gastos do mês.
- Trocar cartão da pilha, abrir e salvar edição; abrir e salvar teto mensal.
- Sair e continuar mantendo saldo, metas e compras.
- Inspeção visual em larguras de celular e desktop, sem rolagem horizontal.

