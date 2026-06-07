# Plano de implementação

## 1. Variações de camiseta (Babylook + Infantil)

**Banco (migration):**
- Renomeio/expando os SKUs em `entrada_stock` para um modelo de variação:
  - `camiseta_adulto_{P,M,G,GG}` (mantém os existentes)
  - `camiseta_baby_{P,M,G,GG}` (novo — Babylook)
  - `camiseta_infantil_{02,04,06,08,10}` (novo)
- Adiciono em `entrada_orders`:
  - `model text` (`adulto` | `baby` | `infantil`)
  - `size` continua, mas aceita `02..10` para infantil
- Atualizo `admin_refund_entrada_order` para repor estoque considerando `model`.

**Frontend `/entrada` (PurchaseDialog):**
- Adiciono seletor de **Modelo** (Adulto / Babylook / Infantil) quando o produto for `kit`.
- Tamanho passa a depender do modelo:
  - Adulto/Baby: P, M, G, GG
  - Infantil: 02, 04, 06, 08, 10
- Envio `model` + `size` para a edge function.

**Edge function `create-entrada-payment`:**
- Aceita `model` no body, monta o SKU correto (`camiseta_${model}_${size}`) para checagem e baixa de estoque.

**Admin (`EntradaPanel`):**
- Coluna mostra modelo + tamanho.
- Tela de estoque lista todos os SKUs novos.

## 2. Cartão de crédito com parcelamento (MP)

Mercado Pago Checkout API exige tokenização do cartão. Para evitar PCI no nosso frontend, uso **Checkout Pro (Preference + init_point)** com `payment_methods.installments` controlado:
- Cliente escolhe Pix (atual) ou Cartão (novo) no PurchaseDialog e no Checkout da rifa.
- Se Cartão: a edge function cria uma `preference` no MP (com `back_urls`, `auto_return`, `external_reference = order.id`, `notification_url = webhook`, `installments: 12`, juros do MP repassados ao cliente).
- Retorno: `init_point` → redireciono o usuário.
- Webhook (mp-webhook / entrada-webhook) já trata `payment.updated` → adapto para também aceitar pagamentos do tipo `credit_card` (mesma lógica de status `approved` → `confirm_payment` / atualizar entrada_orders).

Novos endpoints/parâmetros:
- `create-payment` e `create-entrada-payment` recebem `method: "pix" | "card"`.
- Quando `card`: cria preference e devolve `{ init_point, order_id }`.

UI:
- Página `/pagamento/:id` mostra QR Pix (atual). Quando method = card, redireciona direto para `init_point`.
- Status volta para `/pagamento/:id` via `back_urls.success`.

## 3. Fix do código de revendedor (crítico)

Problema: códigos criados manualmente não são reconhecidos.

- `validate_referral_code` hoje faz `ref_code = upper(trim(_code))`. Códigos manuais inseridos em caixa baixa ou com espaços não casam.
- Correção:
  - Migration normaliza `sellers.ref_code` para `upper(trim(ref_code))`.
  - Trigger `BEFORE INSERT/UPDATE` em `sellers` que sempre uppercase + trim.
  - `validate_referral_code` passa a usar `ilike` + trim para ser tolerante.
- `reserve-numbers` já faz fallback por nome — mantenho.
- Frontend já força uppercase no input — mantenho.

## 4. Código de revendedor em `/entrada`

- Adiciono em `entrada_orders`: `seller_id uuid`, `referral_label text`.
- PurchaseDialog ganha o mesmo bloco "Você recebeu indicação?" do `/checkout` da rifa.
- `create-entrada-payment` resolve seller via `ref_code` e grava no pedido.
- `EntradaPanel` mostra coluna "Revendedor" e permite **atribuir/alterar** manualmente:
  - Nova RPC `admin_set_entrada_order_seller(_order_id, _ref_code)` → resolve seller, grava `seller_id`/`referral_label`, valida admin.
- Dashboard consolidado: incluo vendas da /entrada nas métricas por revendedor.

## 5. Persistência da jornada

- `ref_code` já fica em `localStorage` (`raffle_ref_code`). Reaproveito a mesma chave no PurchaseDialog.
- Estado do PurchaseDialog (modelo/tamanho/qtd) é mantido em memória do componente (não persiste em refresh — comportamento ok porque o dialog reabre vazio).

## Arquivos afetados

- `supabase/migrations/` (1 nova migration: SKUs, colunas entrada_orders, normalização sellers, trigger, RPC admin_set_entrada_order_seller, atualização admin_refund_entrada_order, fix validate_referral_code).
- `supabase/functions/create-entrada-payment/index.ts` (model + cartão + ref_code).
- `supabase/functions/create-payment/index.ts` (cartão).
- `supabase/functions/entrada-webhook/index.ts` e `mp-webhook/index.ts` (cartão).
- `src/components/PurchaseDialog.tsx` (modelo, infantil, cartão, código revendedor).
- `src/components/admin/EntradaPanel.tsx` (coluna revendedor, ação atribuir).
- `src/pages/Checkout.tsx` e `src/pages/Pagamento.tsx` (opção cartão + redirect).
- `src/integrations/supabase/types.ts` (regenerado pela migration).

## Observações

- O Checkout Pro do MP exige o cliente sair do seu site para `mercadopago.com` e voltar. É o caminho seguro e sem PCI. Confirma se está ok antes de implementar.
- Vou manter PIX como padrão; cartão fica como segundo botão.
