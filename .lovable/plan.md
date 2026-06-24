## Problema

A VSL na Home demora a aparecer e a iniciar. Causas no `src/components/VSLPlayer.tsx`:

1. A thumbnail só renderiza depois do round-trip a `app_settings` no Supabase (sem cache).
2. A `<img>` da thumbnail usa `loading="lazy"` + `decoding="async"`, atrasando ainda mais a primeira pintura.
3. Após clicar em Play, o `<video>` usa `preload="metadata"` e não mostra nenhum spinner — fica preto até o buffer estar pronto.
4. URLs assinadas do Storage são geradas a cada navegação (mesmo com TTL de 6h), sem cache em `sessionStorage`.
5. Não há `<link rel="preconnect">` para o domínio do Supabase Storage, então o primeiro request paga TLS/DNS toda vez.

## Mudanças (apenas no player e no `index.html`, sem mexer em lógica de negócio)

### 1. `src/components/VSLPlayer.tsx`
- Cachear o resultado de `app_settings` + URLs resolvidas em `sessionStorage` (chave `vsl:home:v1`), com leitura síncrona no `useState` inicial para pintar a thumbnail imediatamente em navegações subsequentes.
- Trocar `loading="lazy"` por `loading="eager"` + `fetchPriority="high"` na `<img>` da thumbnail (é LCP da Home).
- Estado novo `videoLoading`: ativado em `handleStart`, desativado em `onCanPlay`/`onPlaying`. Enquanto verdadeiro, mostrar `Loader2` central sobre o `<video>` para feedback imediato.
- Trocar `preload="metadata"` por `preload="auto"` no `<video>` que só é montado após o clique (não custa banda antes do click).
- Tratar `onError` do `<img>` para cair no estado de fallback sem travar.

### 2. `index.html`
- Adicionar `<link rel="preconnect" href="https://vxvrjhbymztzpbekfgwz.supabase.co" crossorigin>` e `<link rel="dns-prefetch" href="https://vxvrjhbymztzpbekfgwz.supabase.co">` no `<head>` para que o primeiro request à API/Storage não pague handshake.

### Fora de escopo
- Não alterar `app_settings`, schema, edge functions, rotas ou outras páginas.
- Não trocar a fonte do vídeo nem mover o asset para CDN externa (pode ser feito depois se ainda estiver lento).

## Verificação
- Build local + abrir a Home no Playwright headless, capturar screenshot mostrando thumbnail visível sem flash de loader, e inspecionar `performance.getEntriesByType('resource')` para confirmar preconnect e cache hit em segunda visita.
