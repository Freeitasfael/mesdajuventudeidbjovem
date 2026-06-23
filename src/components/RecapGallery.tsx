import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { ChevronLeft, ChevronRight, X, Play, Pause } from "lucide-react";

interface RecapData {
  title: string;
  description: string;
  cover: string;
  photos: string[];
}

const FALLBACK: RecapData = {
  title: "Vamos recapitular o que aconteceu no ano passado?",
  description:
    "Ano passado tivemos uma mostra de artes poderosa com diversos ministérios de artes da nossa cidade de Uberlândia, acompanhe como foi esse dia.",
  cover: "",
  photos: [],
};

export function RecapGallery() {
  const [data, setData] = useState<RecapData>(FALLBACK);
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const [autoPlay, setAutoPlay] = useState(true);
  const intervalRef = useRef<number | null>(null);

  useEffect(() => {
    (async () => {
      const { data: row } = await supabase
        .from("app_settings")
        .select("value")
        .eq("key", "recap_gallery")
        .maybeSingle();
      if (row?.value) {
        const v = row.value as Partial<RecapData>;
        setData({
          title: v.title || FALLBACK.title,
          description: v.description || FALLBACK.description,
          cover: v.cover || "",
          photos: Array.isArray(v.photos) ? v.photos : [],
        });
      }
    })();
  }, []);

  // Auto-advance when modal open
  useEffect(() => {
    if (openIndex === null || !autoPlay || data.photos.length <= 1) return;
    intervalRef.current = window.setInterval(() => {
      setOpenIndex((i) => (i === null ? null : (i + 1) % data.photos.length));
    }, 3500);
    return () => {
      if (intervalRef.current) window.clearInterval(intervalRef.current);
    };
  }, [openIndex, autoPlay, data.photos.length]);

  // Keyboard nav
  useEffect(() => {
    if (openIndex === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpenIndex(null);
      if (e.key === "ArrowRight") {
        setAutoPlay(false);
        setOpenIndex((i) => (i === null ? null : (i + 1) % data.photos.length));
      }
      if (e.key === "ArrowLeft") {
        setAutoPlay(false);
        setOpenIndex((i) =>
          i === null ? null : (i - 1 + data.photos.length) % data.photos.length,
        );
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [openIndex, data.photos.length]);

  const openAt = (i: number) => {
    setAutoPlay(true);
    setOpenIndex(i);
  };
  const goPrev = () => {
    setAutoPlay(false);
    setOpenIndex((i) =>
      i === null ? null : (i - 1 + data.photos.length) % data.photos.length,
    );
  };
  const goNext = () => {
    setAutoPlay(false);
    setOpenIndex((i) =>
      i === null ? null : (i + 1) % data.photos.length,
    );
  };

  const cover = data.cover || data.photos[0];

  return (
    <section
      className="relative py-20 sm:py-28"
      style={{ backgroundColor: "hsl(var(--hero-bg-deep))" }}
    >
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="max-w-3xl">
          <p
            className="text-xs font-extrabold uppercase tracking-[0.3em]"
            style={{ color: "hsl(var(--hero-gold))" }}
          >
            Novidades & avisos
          </p>
          <h2 className="mt-3 text-3xl font-extrabold tracking-tight sm:text-4xl">
            {data.title}
          </h2>
          <p className="mt-4 text-white/80 sm:text-lg">{data.description}</p>
        </div>

        {cover && (
          <button
            type="button"
            onClick={() => openAt(0)}
            className="group mt-10 block w-full overflow-hidden rounded-3xl border shadow-2xl transition-all hover:shadow-gold-glow"
            style={{ borderColor: "hsl(var(--hero-gold) / 0.25)" }}
          >
            <img
              src={cover}
              alt={data.title}
              className="h-[260px] w-full object-cover transition-transform duration-700 group-hover:scale-105 sm:h-[460px]"
              loading="lazy"
            />
          </button>
        )}

        {data.photos.length > 1 && (
          <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
            {data.photos.map((src, i) => (
              <button
                key={src + i}
                type="button"
                onClick={() => openAt(i)}
                className="group relative aspect-square overflow-hidden rounded-2xl border"
                style={{ borderColor: "hsl(var(--hero-gold) / 0.18)" }}
              >
                <img
                  src={src}
                  alt={`Foto ${i + 1}`}
                  className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110"
                  loading="lazy"
                />
                <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/40 to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Lightbox */}
      {openIndex !== null && data.photos[openIndex] && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 p-4 backdrop-blur-sm"
          onClick={() => setOpenIndex(null)}
        >
          <button
            type="button"
            className="absolute right-4 top-4 rounded-full bg-white/10 p-2 text-white transition hover:bg-white/20"
            onClick={(e) => {
              e.stopPropagation();
              setOpenIndex(null);
            }}
            aria-label="Fechar"
          >
            <X className="h-6 w-6" />
          </button>

          <button
            type="button"
            className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full bg-white/10 p-3 text-white transition hover:bg-white/20 sm:left-6"
            onClick={(e) => {
              e.stopPropagation();
              goPrev();
            }}
            aria-label="Anterior"
          >
            <ChevronLeft className="h-7 w-7" />
          </button>

          <img
            src={data.photos[openIndex]}
            alt={`Foto ${openIndex + 1}`}
            className="max-h-[85vh] max-w-[92vw] rounded-2xl object-contain shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          />

          <button
            type="button"
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-white/10 p-3 text-white transition hover:bg-white/20 sm:right-6"
            onClick={(e) => {
              e.stopPropagation();
              goNext();
            }}
            aria-label="Próxima"
          >
            <ChevronRight className="h-7 w-7" />
          </button>

          <div
            className="absolute bottom-6 left-1/2 flex -translate-x-1/2 items-center gap-3 rounded-full bg-white/10 px-4 py-2 text-xs text-white backdrop-blur"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setAutoPlay((v) => !v)}
              className="inline-flex items-center gap-1.5 transition hover:text-white"
              aria-label={autoPlay ? "Pausar" : "Reproduzir"}
            >
              {autoPlay ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
              {autoPlay ? "Auto" : "Manual"}
            </button>
            <span className="opacity-60">·</span>
            <span>
              {openIndex + 1} / {data.photos.length}
            </span>
          </div>
        </div>
      )}
    </section>
  );
}
