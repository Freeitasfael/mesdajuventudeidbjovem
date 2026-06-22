import { useEffect, useRef, useState } from "react";
import { Play, Volume2, VolumeX } from "lucide-react";
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
 * - Pause mostra play central premium em dourado.
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
  const [playing, setPlaying] = useState(autoplay);
  const [muted, setMuted] = useState(true);
  const [ready, setReady] = useState(false);

  // Buscar URL do vídeo configurado no admin se nenhum src foi passado
  useEffect(() => {
    if (src) {
      setResolvedSrc(src);
      return;
    }
    let active = true;
    (async () => {
      const { data } = await supabase
        .from("app_settings")
        .select("value")
        .eq("key", "home_vsl_video_url")
        .maybeSingle();
      if (!active) return;
      const v = data?.value as
        | string
        | { bucket?: string; path?: string; url?: string }
        | null
        | undefined;
      if (!v) return;
      if (typeof v === "string") {
        setResolvedSrc(v);
        return;
      }
      if (v.url) {
        setResolvedSrc(v.url);
        return;
      }
      if (v.bucket && v.path) {
        const { data: signed } = await supabase.storage
          .from(v.bucket)
          .createSignedUrl(v.path, 60 * 60);
        if (active && signed?.signedUrl) setResolvedSrc(signed.signedUrl);
      }
    })();
    return () => {
      active = false;
    };
  }, [src]);

  // Tentar autoplay assim que o vídeo carregar
  useEffect(() => {
    const v = videoRef.current;
    if (!v || !autoplay) return;
    const tryPlay = () => {
      v.play()
        .then(() => setPlaying(true))
        .catch(() => setPlaying(false));
    };
    if (v.readyState >= 2) tryPlay();
    else v.addEventListener("loadeddata", tryPlay, { once: true });
  }, [resolvedSrc, autoplay]);

  const togglePlay = () => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) {
      // Primeiro clique também ativa o som
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
          preload="metadata"
          controls={false}
          disablePictureInPicture
          controlsList="nodownload nofullscreen noremoteplayback noplaybackrate"
          onPlay={() => setPlaying(true)}
          onPause={() => setPlaying(false)}
          onLoadedData={() => setReady(true)}
          className="h-full w-full object-cover"
        />
      ) : (
        <div
          className="flex h-full w-full items-center justify-center text-sm"
          style={{ color: "hsl(var(--hero-gold))" }}
        >
          Carregando vídeo…
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
