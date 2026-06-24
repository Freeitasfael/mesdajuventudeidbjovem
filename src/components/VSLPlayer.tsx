import { useEffect, useRef, useState } from "react";
import { Play, Pause, Volume2, VolumeX, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

type Props = {
  /** URL direta do vídeo. Se omitido, busca em app_settings.home_vsl_video_url. */
  src?: string;
  /** Imagem de fallback / thumbnail caso não exista uma cadastrada no admin. */
  poster?: string;
  /** Classes extras no wrapper. */
  className?: string;
};

type CachedMeta = {
  videoUrl: string | null;
  thumbUrl: string | null;
  /** Epoch ms até quando o cache é considerado válido (URL assinada ainda fresca). */
  expiresAt: number;
};

const CACHE_KEY = "vsl:home:v2";
// Mantemos URLs assinadas por 6h no Storage; aqui invalidamos antes (4h) por segurança.
const CACHE_TTL_MS = 4 * 60 * 60 * 1000;

const readCache = (): CachedMeta | null => {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CachedMeta;
    if (!parsed || typeof parsed.expiresAt !== "number") return null;
    if (Date.now() > parsed.expiresAt) return null;
    return parsed;
  } catch {
    return null;
  }
};

const writeCache = (meta: CachedMeta) => {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(CACHE_KEY, JSON.stringify(meta));
  } catch {
    /* noop */
  }
};

const prefersReducedMotion = () => {
  if (typeof window === "undefined" || !window.matchMedia) return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
};

/**
 * VSLPlayer — autoplay mudo ao carregar, com fallback para clique manual.
 */
export const VSLPlayer = ({ src, poster, className = "" }: Props) => {
  const cached = !src ? readCache() : null;

  const [resolvedSrc, setResolvedSrc] = useState<string | null>(
    src ?? cached?.videoUrl ?? null,
  );
  const [thumbUrl, setThumbUrl] = useState<string | null>(
    cached?.thumbUrl ?? null,
  );
  const [loadingMeta, setLoadingMeta] = useState(!src && !cached);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [started, setStarted] = useState(false);
  const [thumbHidden, setThumbHidden] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(true);
  const [videoLoading, setVideoLoading] = useState(true);
  const [autoplayBlocked, setAutoplayBlocked] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const autoplayTriedRef = useRef(false);


  // Resolve URL do vídeo + thumbnail
  useEffect(() => {
    let active = true;

    const resolveVideoValue = async (
      v:
        | string
        | { bucket?: string; path?: string; url?: string }
        | null
        | undefined,
    ): Promise<string | null> => {
      if (!v) return null;
      if (typeof v === "string") return v;
      if (v.url) return v.url;
      if (v.bucket && v.path) {
        const { data: signed } = await supabase.storage
          .from(v.bucket)
          .createSignedUrl(v.path, 60 * 60 * 6);
        if (signed?.signedUrl) return signed.signedUrl;
        const pub = supabase.storage.from(v.bucket).getPublicUrl(v.path);
        return pub?.data?.publicUrl ?? null;
      }
      return null;
    };

    (async () => {
      try {
        const keys = ["home_vsl_thumbnail_url"];
        if (!src) keys.push("home_vsl_video_url");

        const { data, error } = await supabase
          .from("app_settings")
          .select("key,value")
          .in("key", keys);
        if (error) throw error;
        if (!active) return;

        const map = new Map(
          (data ?? []).map((r) => [r.key, r.value as unknown]),
        );

        let nextVideo: string | null = src ?? null;
        if (!src) {
          nextVideo = await resolveVideoValue(
            map.get("home_vsl_video_url") as never,
          );
          if (!active) return;
          setResolvedSrc(nextVideo);
        }

        const thumb = await resolveVideoValue(
          map.get("home_vsl_thumbnail_url") as never,
        );
        if (!active) return;
        setThumbUrl(thumb);

        if (!src) {
          writeCache({
            videoUrl: nextVideo,
            thumbUrl: thumb,
            expiresAt: Date.now() + CACHE_TTL_MS,
          });
        }
      } catch (err) {
        console.error("[VSLPlayer] resolve", err);
        if (active && !cached) setErrorMsg("Não foi possível carregar o vídeo.");
      } finally {
        if (active) setLoadingMeta(false);
      }
    })();

    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [src]);

  const tryAutoplay = () => {
    const v = videoRef.current;
    if (!v || !resolvedSrc || autoplayTriedRef.current) return;
    if (prefersReducedMotion()) {
      setAutoplayBlocked(true);
      setVideoLoading(false);
      return;
    }

    autoplayTriedRef.current = true;
    v.muted = true;
    v.defaultMuted = true;
    v.playsInline = true;
    setIsMuted(true);

    const p = v.play();
    if (p && typeof p.then === "function") {
      p.then(() => {
        setAutoplayBlocked(false);
      }).catch(() => {
        autoplayTriedRef.current = false;
        setAutoplayBlocked(true);
        setVideoLoading(false);
      });
    }
  };

  // Tenta autoplay mudo assim que o vídeo estiver montado.
  useEffect(() => {
    if (!resolvedSrc) return;
    autoplayTriedRef.current = false;
    const id = window.requestAnimationFrame(() => tryAutoplay());
    return () => window.cancelAnimationFrame(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resolvedSrc]);


  const displayThumb = thumbUrl ?? poster ?? null;

  const handleStart = () => {
    const v = videoRef.current;
    if (!v) return;
    setVideoLoading(true);
    v.muted = true;
    v.defaultMuted = true;
    v.playsInline = true;
    const p = v.play();
    if (p && typeof p.then === "function") {
      p.then(() => setAutoplayBlocked(false)).catch(() => {
        setErrorMsg("Falha ao reproduzir o vídeo.");
        setVideoLoading(false);
      });
    }
  };

  const togglePlay = () => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) {
      void v.play();
    } else {
      v.pause();
    }
  };

  const toggleMute = (e: React.MouseEvent) => {
    e.stopPropagation();
    const v = videoRef.current;
    if (!v) return;
    v.muted = !v.muted;
    setIsMuted(v.muted);
  };

  const enableSound = () => {
    const v = videoRef.current;
    if (!v) return;
    v.muted = false;
    setIsMuted(false);
    if (v.paused) void v.play();
  };

  const handlePlaying = () => {
    setIsPlaying(true);
    setVideoLoading(false);
    if (!started) {
      setStarted(true);
      window.setTimeout(() => setThumbHidden(true), 350);
    }
  };

  return (
    <div
      className={`group relative w-full overflow-hidden rounded-3xl border shadow-gold-glow ${className}`}
      style={{
        borderColor: "hsl(var(--hero-gold) / 0.35)",
        backgroundColor: "rgba(0,0,0,0.6)",
        aspectRatio: "16 / 9",
      }}
    >
      {resolvedSrc && (
        <video
          ref={videoRef}
          src={resolvedSrc}
          poster={displayThumb ?? undefined}
          autoPlay
          muted
          playsInline
          preload="auto"
          onPlay={() => setIsPlaying(true)}
          onPlaying={handlePlaying}
          onPause={() => setIsPlaying(false)}
          onWaiting={() => setVideoLoading(true)}
          onLoadedMetadata={tryAutoplay}
          onLoadedData={tryAutoplay}
          onCanPlay={() => {
            setVideoLoading(false);
            tryAutoplay();
          }}
          onEnded={() => {
            const v = videoRef.current;
            if (v) {
              try { v.pause(); v.currentTime = 0; } catch { /* noop */ }
            }
            setIsPlaying(false);
            setStarted(false);
            setThumbHidden(false);
            autoplayTriedRef.current = true; // não re-autoplay ao reaparecer
          }}
          onClick={togglePlay}
          onError={() => {
            setErrorMsg("Falha ao reproduzir o vídeo.");
            setVideoLoading(false);
          }}
          className="h-full w-full cursor-pointer object-cover"
        />
      )}


      {/* Spinner enquanto o vídeo carrega */}
      {resolvedSrc && videoLoading && !autoplayBlocked && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <Loader2
            className="h-10 w-10 animate-spin"
            style={{ color: "hsl(var(--hero-gold))" }}
          />
        </div>
      )}

      {/* Thumbnail + botão de play (fica visível até começar a tocar; fallback para autoplay bloqueado) */}
      {!thumbHidden && (
        <div
          className={`absolute inset-0 transition-opacity duration-500 ${
            started ? "pointer-events-none opacity-0" : "opacity-100"
          }`}
        >
          {displayThumb ? (
            <img
              src={displayThumb}
              alt="Prévia do vídeo"
              loading="eager"
              fetchPriority="high"
              decoding="async"
              onError={() => setThumbUrl(null)}
              className="h-full w-full object-cover"
            />
          ) : (
            <div
              className="flex h-full w-full items-center justify-center text-sm"
              style={{ color: "hsl(var(--hero-gold))" }}
            >
              {loadingMeta ? (
                <Loader2 className="h-6 w-6 animate-spin" />
              ) : errorMsg && !resolvedSrc ? (
                <span>{errorMsg}</span>
              ) : null}
            </div>
          )}

          {/* Overlay escuro suave */}
          <div
            className="pointer-events-none absolute inset-0"
            style={{
              background:
                "radial-gradient(ellipse at center, transparent 35%, hsl(var(--hero-bg) / 0.55) 100%)",
            }}
          />

          {resolvedSrc && (autoplayBlocked || !started) && (
            <button
              type="button"
              onClick={handleStart}
              aria-label="Reproduzir vídeo"
              className="absolute left-1/2 top-1/2 flex h-20 w-20 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full transition-transform duration-300 hover:scale-110 sm:h-24 sm:w-24"
              style={{
                backgroundColor: "hsl(var(--hero-gold))",
                color: "hsl(var(--hero-bg))",
                boxShadow:
                  "0 0 40px hsl(var(--hero-gold) / 0.55), 0 0 80px hsl(var(--hero-gold) / 0.25)",
                animation: "vsl-pulse 2s ease-in-out infinite",
              }}
            >
              <Play className="ml-1 h-9 w-9 fill-current sm:h-10 sm:w-10" />
            </button>
          )}
        </div>
      )}

      {/* Banner "Toque para ativar o som" enquanto mudo após autoplay */}
      {started && isPlaying && isMuted && (
        <button
          type="button"
          onClick={enableSound}
          aria-label="Ativar o som do vídeo"
          className="absolute left-1/2 top-4 -translate-x-1/2 rounded-full px-4 py-2 text-xs font-medium backdrop-blur-md transition-transform duration-200 hover:scale-105 sm:text-sm"
          style={{
            backgroundColor: "hsl(var(--hero-bg) / 0.7)",
            color: "hsl(var(--hero-gold))",
            border: "1px solid hsl(var(--hero-gold) / 0.5)",
          }}
        >
          <span className="inline-flex items-center gap-2">
            <Volume2 className="h-4 w-4" />
            Toque para ativar o som
          </span>
        </button>
      )}

      {/* Controles customizados (após iniciar) */}
      {started && resolvedSrc && (
        <div className="pointer-events-none absolute inset-0 flex items-end justify-between p-3 sm:p-4">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              togglePlay();
            }}
            aria-label={isPlaying ? "Pausar" : "Reproduzir"}
            className="pointer-events-auto flex h-10 w-10 items-center justify-center rounded-full backdrop-blur-md transition-all duration-200 hover:scale-105 sm:h-11 sm:w-11"
            style={{
              backgroundColor: "hsl(var(--hero-bg) / 0.55)",
              color: "hsl(var(--hero-gold))",
              border: "1px solid hsl(var(--hero-gold) / 0.4)",
            }}
          >
            {isPlaying ? (
              <Pause className="h-5 w-5 fill-current" />
            ) : (
              <Play className="ml-0.5 h-5 w-5 fill-current" />
            )}
          </button>

          <button
            type="button"
            onClick={toggleMute}
            aria-label={isMuted ? "Ativar som" : "Silenciar"}
            className="pointer-events-auto flex h-10 w-10 items-center justify-center rounded-full backdrop-blur-md transition-all duration-200 hover:scale-105 sm:h-11 sm:w-11"
            style={{
              backgroundColor: "hsl(var(--hero-bg) / 0.55)",
              color: "hsl(var(--hero-gold))",
              border: "1px solid hsl(var(--hero-gold) / 0.4)",
            }}
          >
            {isMuted ? (
              <VolumeX className="h-5 w-5" />
            ) : (
              <Volume2 className="h-5 w-5" />
            )}
          </button>
        </div>
      )}

      <style>{`
        @keyframes vsl-pulse {
          0%, 100% { transform: translate(-50%, -50%) scale(1); }
          50% { transform: translate(-50%, -50%) scale(1.08); }
        }
      `}</style>
    </div>
  );
};

export default VSLPlayer;
