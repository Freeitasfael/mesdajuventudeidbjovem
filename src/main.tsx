import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "@fontsource/sora/600.css";
import "@fontsource/sora/700.css";
import "@fontsource/sora/800.css";
import "@fontsource/manrope/400.css";
import "@fontsource/manrope/500.css";
import "@fontsource/manrope/600.css";
import "@fontsource/manrope/700.css";
import "./index.css";

// Após um novo deploy, o index.html em cache pode tentar carregar chunks
// JS com hashes antigos que não existem mais → tela branca com
// "Failed to fetch dynamically imported module". Recarregamos a página
// uma única vez para puxar o novo index.html.
const CHUNK_RELOAD_KEY = "chunk_reload_attempt";
const isChunkLoadError = (msg: string) =>
  /Failed to fetch dynamically imported module|Importing a module script failed|ChunkLoadError|Loading chunk [\w-]+ failed/i.test(
    msg,
  );
const handleChunkError = (msg: string) => {
  if (!isChunkLoadError(msg)) return;
  if (sessionStorage.getItem(CHUNK_RELOAD_KEY)) return;
  sessionStorage.setItem(CHUNK_RELOAD_KEY, "1");
  window.location.reload();
};
window.addEventListener("error", (e) => handleChunkError(e.message || ""));
window.addEventListener("unhandledrejection", (e) =>
  handleChunkError(String(e.reason?.message || e.reason || "")),
);
// Limpa o flag quando o app monta com sucesso
window.addEventListener("load", () =>
  sessionStorage.removeItem(CHUNK_RELOAD_KEY),
);

createRoot(document.getElementById("root")!).render(<App />);

// Service Worker (PWA) — só em produção, evita interferir no preview do Lovable
if ("serviceWorker" in navigator && import.meta.env.PROD) {
  const host = window.location.hostname;
  const isLovablePreview =
    host.startsWith("id-preview--") ||
    host.startsWith("preview--") ||
    host.endsWith(".lovableproject.com") ||
    host.endsWith(".lovableproject-dev.com");
  if (!isLovablePreview) {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    });
  }
}

