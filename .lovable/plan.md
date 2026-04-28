# Sistema de Rifa Digital com PIX — Plano de Entrega

Stack confirmada: **React + Vite + Tailwind + shadcn/ui** no frontend, **Lovable Cloud (Supabase: Postgres + RLS + Edge Functions Deno)** no backend. Mercado Pago via Edge Function quando você tiver o token.

A entrega será **faseada** (cada fase é uma mensagem/implementação). Esta proposta cobre a **Fase 1** em detalhe e lista as fases seguintes em alto nível.

---

## Fase 1 — Fundação: Cloud + Schema + Tela /rifa (esta entrega)

### O que será feito

1. **Ativar Lovable Cloud** no projeto (Postgres + Auth + Edge Functions).
2. **Criar todo o schema** (migration única) com as tabelas, constraints, índices, RLS e seed dos 400 números.
3. **Criar a página `/rifa`** com o grid 1–400 lendo do banco em tempo real (read-only nesta fase — clique nos números virá na Fase 2 junto com o checkout).
4. **Layout base do app**: rotas, header simples, tema claro minimalista, mobile-first.

### Schema (migration)

Tabelas, todas com `id uuid pk default gen_random_uuid()` e `created_at timestamptz default now()`:

- **sellers** — `name text not null`, `phone text`, `ref_code text unique not null`, `user_id uuid references auth.users(id)` (opcional, vendedor pode ter login depois).
- **buyers** — `name text not null check (array_length(string_to_array(trim(name),' '),1) >= 2)`, `phone text not null check (phone ~ '^[0-9]{10,11}$')`.
- **numbers** — `number int unique not null check (number between 1 and 400)`, `status text not null check (status in ('available','reserved','paid')) default 'available'`, `reserved_at timestamptz`, `order_id uuid references orders(id)`.
- **orders** — `buyer_id uuid not null references buyers(id)`, `seller_id uuid references sellers(id)`, `total_cents int not null`, `status text check (status in ('pending','paid','expired','cancelled')) default 'pending'`, `expires_at timestamptz not null`.
- **order_numbers** — `order_id uuid references orders(id) on delete cascade`, `number int references numbers(number)`, `unique(order_id, number)`.
- **payments** — `order_id uuid references orders(id)`, `provider text default 'mercadopago'`, `provider_payment_id text unique`, `status text check (status in ('pending','approved','rejected','expired','refunded')) default 'pending'`, `amount_cents int not null`, `qr_code text`, `qr_code_base64 text`, `raw jsonb`, `updated_at timestamptz default now()`.
- **app_settings** — tabela simples key/value para coisas como `price_per_number_cents` (você definirá depois pelo admin).
- **user_roles** — `user_id uuid references auth.users(id)`, `role app_role` (enum `'admin' | 'seller'`), com função `has_role()` security definer (padrão Lovable para evitar recursão em RLS).

**Índices**: `numbers(number)`, `numbers(status)`, `payments(status)`, `payments(provider_payment_id)`, `orders(status)`, `orders(expires_at)`, `sellers(ref_code)`.

**RLS** (resumo):
- `numbers`: SELECT público (qualquer um vê o grid). UPDATE somente via Edge Function (service role).
- `orders` / `order_numbers` / `payments` / `buyers`: SELECT/INSERT só via Edge Function.
- `sellers`: SELECT público (precisamos validar `ref_code` na URL). INSERT via Edge Function.
- `app_settings`: SELECT público. UPDATE só admin.
- `user_roles`: SELECT só admin (via `has_role`).

**Seed**: insere os 400 números com `status='available'`.

### Tela `/rifa` (Fase 1 — visualização)

- Header: título da rifa + legenda de cores.
- Grid responsivo (10 colunas no desktop, 5 no mobile) com 400 botões numerados.
- Cores via tokens semânticos do design system (não hardcoded):
  - **available** → verde
  - **reserved** → amarelo
  - **paid** → vermelho/desabilitado
- Cada célula mostra o número. Clique nesta fase **apenas mostra um toast** "checkout em breve" — a lógica de seleção/reserva entra na Fase 2.
- Captura de `?ref=CODIGO` na URL e armazena em `localStorage` para uso na Fase 2.
- Realtime via Supabase channel em `numbers` para atualizar cores ao vivo.

### Estados e UX

- Loading skeleton no grid.
- Erro com retry.
- Mobile-first (375px), Tailwind, animações leves (hover scale-105, transition-colors).

### Detalhes técnicos

- Migration única SQL aplicada via ferramenta de migração do Cloud.
- Cliente Supabase já vem configurado pelo Cloud (`src/integrations/supabase/client.ts`).
- Tipos TypeScript gerados automaticamente.
- Tokens de design adicionados em `index.css` e `tailwind.config.ts` (verde/amarelo/vermelho semânticos para status).

---

## Próximas fases (visão geral, serão detalhadas quando chegarmos)

**Fase 2 — Reserva + Checkout**
- Seleção múltipla de números no grid.
- Tela `/checkout`: nome (≥2 palavras), telefone (10–11 dígitos), resumo, valor total.
- Edge Function `reserve-numbers`: transação com `SELECT ... FOR UPDATE`, marca como `reserved`, cria `order` com `expires_at = now() + 10min`.
- Captura do `ref_code` do localStorage e vincula ao `order`.

**Fase 3 — Pagamento PIX (Mercado Pago)**
- Você fornece o **MP Access Token** → guardo como secret no Cloud.
- Edge Function `create-payment` cria pagamento PIX via API do MP, salva QR Code.
- Tela `/pagamento/:orderId`: mostra QR Code + copia-e-cola, faz polling do status.
- Edge Function `mp-webhook` (pública, sem JWT): valida origem, **consulta a API do MP** (nunca confia no payload), atualiza `payments` e `numbers` para `paid`.

**Fase 4 — Cron jobs (expiração + reconciliação)**
- pg_cron a cada 1 min: libera números reservados há mais de 10 min.
- pg_cron a cada 2 min: pega `payments.status='pending'`, consulta MP, atualiza.

**Fase 5 — Vendedores + Ranking**
- Tela `/vendedor`: cadastro público (nome, telefone) → gera `ref_code` e link `https://.../rifa?ref=CODIGO`.
- Tela `/ranking`: lista pública de vendedores ordenada por valor arrecadado (com toggle para "por nº de números pagos" — você pediu os dois).

**Fase 6 — Admin**
- Login email/senha (Lovable Cloud Auth) + role `admin` na tabela `user_roles`.
- `/admin/login` e `/admin` (dashboard): total arrecadado, números pagos/reservados/disponíveis, ranking completo, lista de pedidos, ajuste do `price_per_number_cents`.

---

## Pendências suas (para destravar fases futuras)

1. **Mercado Pago Access Token** (sandbox para testar, depois produção) → necessário para Fase 3.
2. **Valor por número** → você definirá pelo admin na Fase 6 (até lá uso um placeholder de R$ 10,00 que ajustamos a qualquer momento).
3. **Email do admin** que terá acesso ao painel → necessário no início da Fase 6.

---

## Detalhes técnicos consolidados

- **Concorrência na reserva**: `BEGIN; SELECT number FROM numbers WHERE number = ANY($1) AND status='available' FOR UPDATE; UPDATE ... ; COMMIT;` dentro de uma Edge Function com service role — evita race condition.
- **Webhook seguro**: assinatura `x-signature` do MP validada + chamada de volta à API do MP com o `payment_id` antes de marcar como pago.
- **RLS estrita**: nenhuma escrita direta do cliente em `orders`/`payments`/`numbers` — sempre via Edge Function.
- **Realtime**: canal Supabase em `numbers` para o grid atualizar sem reload.
- **Logs padronizados**: `console.log('[reserve-numbers]', ...)` em todas as Edge Functions.
- **Validação**: Zod nas Edge Functions, `react-hook-form + zod` no frontend.

Posso prosseguir com a **Fase 1** (Cloud + schema + tela /rifa) assim que você aprovar?