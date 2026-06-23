import { useEffect, useState } from "react";
import { Play, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

type Props = {
  /** URL direta do vídeo. Se omitido, busca em app_settings.home_vsl_video_url. */
  src?: string;
  /** Imagem de fallback / thumbnail caso não exista uma cadastrada no admin. */
  poster?: string;
  /** Classes extras no wrapper. */
  className?: string;
};

/**
 * VSLPlayer — player com thumbnail e carregamento sob demanda.
 * - Mostra apenas uma imagem + botão de play até o clique do usuário.
 * - Ao clicar, monta o <video> com autoplay muted playsinline e controls.
 * - preload="metadata" para não baixar o vídeo inteiro antecipadamente.
 */
export const VSLPlayer = ({ src, poster, className = "" }: Props) => {
  const [resolvedSrc, setResolvedSrc] = useState<string | null>(src ?? null);
  const [thumbUrl, setThumbUrl] = useState<string | null>(null);
  const [loadingMeta, setLoadingMeta] = useState(!src);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [started, setStarted] = useState(false);

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
        setLoadingMeta(true);
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

        if (!src) {
          const videoUrl = await resolveVideoValue(
            map.get("home_vsl_video_url") as never,
          );
          if (!active) return;
          setResolvedSrc(videoUrl);
        }

        const thumb = await resolveVideoValue(
          map.get("home_vsl_thumbnail_url") as never,
        );
        if (!active) return;
        setThumbUrl(thumb);
      } catch (err) {
        console.error("[VSLPlayer] resolve", err);
        if (active) setErrorMsg("Não foi possível carregar o vídeo.");
      } finally {
        if (active) setLoadingMeta(false);
      }
    })();

    return () => {
      active = false;
    };
  }, [src]);

  const displayThumb = thumbUrl ?? poster ?? null;

  return (
    <div
      className={`relative w-full overflow-hidden rounded-3xl border shadow-gold-glow ${className}`}
      style={{
        borderColor: "hsl(var(--hero-gold) / 0.35)",
        backgroundColor: "rgba(0,0,0,0.6)",
        aspectRatio: "16 / 9",
      }}
    >
      {started && resolvedSrc ? (
        <video
          src={resolvedSrc}
          poster={displayThumb ?? undefined}
          autoPlay
          muted
          playsInline
          controls
          preload="metadata"
          onError={() => setErrorMsg("Falha ao reproduzir o vídeo.")}
          className="h-full w-full object-cover"
        />
      ) : (
        <>
          {displayThumb ? (
            <img
              src={displayThumb}
              alt="Prévia do vídeo"
              loading="lazy"
              decoding="async"
              className="h-full w-full object-cover"
            />
          ) : (
            <div
              className="flex h-full w-full items-center justify-center text-sm"
              style={{ color: "hsl(var(--hero-gold))" }}
            >
              {loadingMeta ? (
                <Loader2 className="h-6 w-6 animate-spin" />
              ) : (
                <span>{errorMsg ?? "Vídeo indisponível."}</span>
              )}
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

          {resolvedSrc && (
            <button
              type="button"
              onClick={() => setStarted(true)}
              aria-label="Reproduzir vídeo"
              className="absolute inset-0 m-auto flex h-20 w-20 items-center justify-center rounded-full transition-all duration-300 hover:scale-105 sm:h-24 sm:w-24"
              style={{
                backgroundColor: "hsl(var(--hero-gold))",
                color: "hsl(var(--hero-bg))",
                boxShadow:
                  "0 0 40px hsl(var(--hero-gold) / 0.55), 0 0 80px hsl(var(--hero-gold) / 0.25)",
              }}
            >
              <Play className="ml-1 h-9 w-9 fill-current sm:h-10 sm:w-10" />
            </button>
          )}
        </>
      )}
    </div>
  );
};

export default VSLPlayer;
