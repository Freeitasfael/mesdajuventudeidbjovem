import { useEffect, useRef, useState } from "react";
import { Play, Volume2, VolumeX, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

type Props = {
  /** URL direta do vídeo. Se omitido, busca em app_settings.home_vsl_video_url. */
  src?: string;
  /** Imagem de fallback enquanto o vídeo não carrega. */
  poster?: string;
  /** Inicia automaticamente (default: true). */
  autoplay?: boolean;
  /** Loop infinito (default: true). */
  loop?: boolean;
  /** Mostrar controle discreto de mudo (default: true). */
  showMuteToggle?: boolean;
  /** Classes extras no wrapper. */
  className?: string;
};

/**
 * VSLPlayer — player estilo VSL/PandaVideo, zero distração.
 * - Sem timeline, sem fullscreen, sem duração, sem menu.
 * - Autoplay muted; ao clicar ativa som e mantém reprodução.
 * - Carregamento prioritário do vídeo (preload="auto").
 */
export const VSLPlayer = ({
  src,
  poster,
  autoplay = true,
  loop = true,
  showMuteToggle = true,
  className = "",
}: Props) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [resolvedSrc, setResolvedSrc] = useState<string | null>(src ?? null);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(true);
  const [loadingSrc, setLoadingSrc] = useState(!src);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Resolve URL — prioridade máxima: assim que a tela montar
  useEffect(() => {
    if (src) {
      setResolvedSrc(src);
      setLoadingSrc(false);
      return;
    }
    let active = true;
    setLoadingSrc(true);
    (async () => {
      try {
        const { data, error } = await supabase
          .from("app_settings")
          .select("value")
          .eq("key", "home_vsl_video_url")
          .maybeSingle();
        if (error) throw error;
        const v = data?.value as
          | string
          | { bucket?: string; path?: string; url?: string }
          | null
          | undefined;
        if (!active) return;
        if (!v) {
          setLoadingSrc(false);
          return;
        }
        if (typeof v === "string") {
          setResolvedSrc(v);
          setLoadingSrc(false);
          return;
        }
        if (v.url) {
          setResolvedSrc(v.url);
          setLoadingSrc(false);
          return;
        }
        if (v.bucket && v.path) {
          // Tenta URL pública primeiro (sem round-trip extra)
          const pub = supabase.storage.from(v.bucket).getPublicUrl(v.path);
          // Em buckets privados o getPublicUrl ainda retorna uma URL,
          // mas ela falha ao carregar. Por isso preferimos signedUrl.
          const { data: signed, error: sErr } = await supabase.storage
            .from(v.bucket)
            .createSignedUrl(v.path, 60 * 60 * 6); // 6h
          if (!active) return;
          if (signed?.signedUrl) {
            setResolvedSrc(signed.signedUrl);
          } else if (pub?.data?.publicUrl) {
            setResolvedSrc(pub.data.publicUrl);
          } else if (sErr) {
            throw sErr;
          }
          setLoadingSrc(false);
        }
      } catch (err) {
        console.error("[VSLPlayer] resolve src", err);
        if (active) {
          setErrorMsg("Não foi possível carregar o vídeo.");
          setLoadingSrc(false);
        }
      }
    })();
    return () => {
      active = false;
    };
  }, [src]);

  // Força reload + autoplay quando o src é resolvido
  useEffect(() => {
    const v = videoRef.current;
    if (!v || !resolvedSrc) return;
    v.muted = true;
    setMuted(true);
    try {
      v.load();
    } catch {
      // ignore
    }
    if (!autoplay) return;

    const tryPlay = () => {
      const p = v.play();
      if (p && typeof p.then === "function") {
        p.then(() => setPlaying(true)).catch(() => setPlaying(false));
      }
    };

    if (v.readyState >= 2) tryPlay();
    const onCanPlay = () => tryPlay();
    v.addEventListener("loadeddata", onCanPlay, { once: true });
    v.addEventListener("canplay", onCanPlay, { once: true });
    return () => {
      v.removeEventListener("loadeddata", onCanPlay);
      v.removeEventListener("canplay", onCanPlay);
    };
  }, [resolvedSrc, autoplay]);

  const togglePlay = () => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) {
      if (muted) {
        v.muted = false;
        setMuted(false);
      }
      v.play()
        .then(() => setPlaying(true))
        .catch(() => setPlaying(false));
    } else {
      v.pause();
      setPlaying(false);
    }
  };

  const toggleMute = (e: React.MouseEvent) => {
    e.stopPropagation();
    const v = videoRef.current;
    if (!v) return;
    v.muted = !v.muted;
    setMuted(v.muted);
  };

  return (
    <div
      className={`group relative w-full overflow-hidden rounded-3xl border shadow-gold-glow ${className}`}
      style={{
        borderColor: "hsl(var(--hero-gold) / 0.35)",
        backgroundColor: "rgba(0,0,0,0.6)",
        aspectRatio: "16 / 9",
      }}
      onClick={togglePlay}
      role="button"
      aria-label={playing ? "Pausar vídeo" : "Reproduzir vídeo"}
    >
      {resolvedSrc ? (
        <video
          ref={videoRef}
          src={resolvedSrc}
          poster={poster}
          autoPlay={autoplay}
          muted={muted}
          loop={loop}
          playsInline
          preload="auto"
          controls={false}
          disablePictureInPicture
          controlsList="nodownload nofullscreen noremoteplayback noplaybackrate"
          onPlay={() => setPlaying(true)}
          onPause={() => setPlaying(false)}
          onError={() => setErrorMsg("Falha ao reproduzir o vídeo.")}
          className="h-full w-full object-cover"
        />
      ) : (
        <div
          className="flex h-full w-full flex-col items-center justify-center gap-2 text-sm"
          style={{ color: "hsl(var(--hero-gold))" }}
        >
          {loadingSrc ? (
            <>
              <Loader2 className="h-6 w-6 animate-spin" />
              <span>Carregando vídeo…</span>
            </>
          ) : (
            <span>{errorMsg ?? "Vídeo indisponível."}</span>
          )}
        </div>
      )}

      {/* Overlay escuro suave para contraste */}
      <div
        className="pointer-events-none absolute inset-0 transition-opacity"
        style={{
          background:
            "radial-gradient(ellipse at center, transparent 35%, hsl(var(--hero-bg) / 0.55) 100%)",
          opacity: playing ? 0 : 1,
        }}
      />

      {/* Botão central play (aparece quando pausado) */}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          togglePlay();
        }}
        aria-label="Reproduzir"
        className={`absolute inset-0 m-auto flex h-20 w-20 items-center justify-center rounded-full transition-all duration-300 sm:h-24 sm:w-24 ${
          playing
            ? "pointer-events-none scale-90 opacity-0"
            : "scale-100 opacity-100 hover:scale-105"
        }`}
        style={{
          backgroundColor: "hsl(var(--hero-gold))",
          color: "hsl(var(--hero-bg))",
          boxShadow:
            "0 0 40px hsl(var(--hero-gold) / 0.55), 0 0 80px hsl(var(--hero-gold) / 0.25)",
        }}
      >
        <Play className="ml-1 h-9 w-9 fill-current sm:h-10 sm:w-10" />
      </button>

      {/* Hint sutil de "toque para ativar som" */}
      {playing && muted && (
        <div
          className="pointer-events-none absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full px-4 py-1.5 text-[11px] font-extrabold uppercase tracking-[0.25em] backdrop-blur-md sm:text-xs"
          style={{
            backgroundColor: "hsl(var(--hero-bg) / 0.65)",
            color: "hsl(var(--hero-gold))",
            border: "1px solid hsl(var(--hero-gold) / 0.35)",
          }}
        >
          Toque para ativar o som
        </div>
      )}

      {/* Toggle de mute discreto */}
      {showMuteToggle && resolvedSrc && (
        <button
          type="button"
          onClick={toggleMute}
          aria-label={muted ? "Ativar som" : "Silenciar"}
          className="absolute right-3 top-3 inline-flex h-10 w-10 items-center justify-center rounded-full backdrop-blur-md transition hover:scale-105"
          style={{
            backgroundColor: "hsl(var(--hero-bg) / 0.55)",
            color: "hsl(var(--hero-gold))",
            border: "1px solid hsl(var(--hero-gold) / 0.35)",
          }}
        >
          {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
        </button>
      )}
    </div>
  );
};

export default VSLPlayer;
