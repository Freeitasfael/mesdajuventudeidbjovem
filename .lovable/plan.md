# VSL da Home: autoplay ao carregar + correção do play

## Problema
Hoje o vídeo só começa após o clique no botão grande (`handleStart` define `started=true`). Em alguns dispositivos o clique parece "não funcionar" porque o `<video>` só é montado nesse momento, precisa baixar metadados/buffer e a thumbnail demora a sumir — dando sensação de travamento.

## Objetivo
- Iniciar o vídeo automaticamente (mudo, conforme exigência dos navegadores) assim que a Home abrir.
- Manter um overlay discreto "Toque para ativar o som" enquanto estiver mudo, que serve também de fallback caso o navegador bloqueie o autoplay.
- Não mexer em lógica de negócio, rotas, Admin ou nas configurações de `app_settings`.

## Mudanças em `src/components/VSLPlayer.tsx`

1. **Montar o `<video>` desde o início**, sem depender do estado `started`. Assim o browser começa a baixar antes do usuário tentar interagir.
   - Renderizar o `<video>` assim que `resolvedSrc` estiver disponível.
   - Manter `autoPlay`, `muted`, `playsInline`, `preload="auto"`.

2. **Disparar `play()` explicitamente** em um `useEffect` quando `resolvedSrc` mudar, tratando a Promise:
   - Sucesso → `setStarted(true)`, esconde thumbnail (fade-out atual).
   - Falha (autoplay bloqueado) → mantém thumbnail + botão de play visível para o usuário iniciar manualmente (fluxo atual de `handleStart`, que agora apenas chama `videoRef.current.play()` em vez de montar o vídeo).

3. **Spinner** continua aparecendo via `onWaiting`/`onCanPlay`, agora também durante o boot inicial (`videoLoading` começa `true` enquanto não houver `canplay`).

4. **Thumbnail/preview** continua sendo exibida por cima do `<video>` até o `onPlaying` disparar; nesse momento aplica o fade-out atual (`thumbHidden`). Garante que não há "tela preta" antes do primeiro frame.

5. **Botão de "ativar som"**: como autoplay exige `muted`, adicionar um pequeno banner clicável no topo/centro inferior ("Toque para ativar o som 🔊") enquanto `isMuted === true` e o vídeo estiver tocando. Ao clicar: `v.muted = false` e remove o banner. Some sozinho quando o usuário usa o controle de mute existente.

6. **Acessibilidade/UX**:
   - `aria-label` no banner de som.
   - Não autoplay se `prefers-reduced-motion: reduce` — nesse caso mantém o fluxo atual de clicar no play (sem regressão).

## Itens técnicos / detalhes

- O `<video>` ficará sempre montado quando `resolvedSrc` existir; `started` passa a representar "já começou a tocar pelo menos uma vez" e controla apenas o fade da thumbnail e a exibição dos controles inferiores (sem mudanças nos controles).
- `handleStart` vira fallback: chama `videoRef.current?.play()` (Promise) — em caso de erro, mostra `errorMsg`.
- Cache `sessionStorage` (`vsl:home:v1`) e resolução de URL ficam exatamente como estão.
- Nenhuma alteração em `Home.tsx`, `app_settings`, edge functions, schema ou `index.html`.

## Critério de aceite
- Ao abrir `/`, o vídeo começa a tocar mudo em até ~1s após o thumbnail aparecer (depende da rede).
- Banner "ativar som" aparece e funciona; controle de mute existente continua funcionando.
- Em navegadores que bloqueiam autoplay, o botão grande de play continua funcionando sem bug.
- Sem regressão em mobile (iOS Safari/Android Chrome) graças a `playsInline` + `muted`.
