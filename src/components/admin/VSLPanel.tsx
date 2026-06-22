import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Upload, Trash2, CheckCircle2, Film, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";

const SETTINGS_KEY = "home_vsl_video_url";
const BUCKET = "hero-media";
const MAX_BYTES = 200 * 1024 * 1024; // 200 MB
const ALLOWED = ["video/mp4", "video/webm", "video/quicktime"];

export function VSLPanel() {
  const [currentUrl, setCurrentUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [removing, setRemoving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("app_settings")
      .select("value")
      .eq("key", SETTINGS_KEY)
      .maybeSingle();
    if (error) {
      console.error("[VSLPanel] load", error);
    }
    const v = data?.value;
    const url =
      typeof v === "string"
        ? v
        : v && typeof v === "object" && "url" in (v as Record<string, unknown>)
          ? String((v as { url?: string }).url ?? "")
          : "";
    setCurrentUrl(url || null);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const persistUrl = async (url: string | null) => {
    // upsert em app_settings
    const { error } = await supabase
      .from("app_settings")
      .upsert(
        { key: SETTINGS_KEY, value: url ?? null },
        { onConflict: "key" },
      );
    if (error) throw error;
  };

  const onPick = () => inputRef.current?.click();

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    if (!ALLOWED.includes(file.type)) {
      toast.error("Formato inválido. Use MP4, WebM ou MOV.");
      return;
    }
    if (file.size > MAX_BYTES) {
      toast.error("Arquivo muito grande (máx 200 MB).");
      return;
    }

    setUploading(true);
    try {
      const ext = file.name.split(".").pop()?.toLowerCase() || "mp4";
      const path = `vsl/home-${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from(BUCKET)
        .upload(path, file, {
          contentType: file.type,
          cacheControl: "3600",
          upsert: false,
        });
      if (upErr) throw upErr;

      const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(path);
      const publicUrl = pub.publicUrl;

      await persistUrl(publicUrl);
      setCurrentUrl(publicUrl);
      toast.success("Vídeo da VSL atualizado com sucesso!");
    } catch (err) {
      console.error("[VSLPanel] upload", err);
      toast.error(
        err instanceof Error ? err.message : "Falha ao enviar o vídeo.",
      );
    } finally {
      setUploading(false);
    }
  };

  const onRemove = async () => {
    if (!currentUrl) return;
    if (!confirm("Remover o vídeo atual da VSL?")) return;
    setRemoving(true);
    try {
      await persistUrl(null);
      // tenta apagar do storage se vier do bucket público
      const marker = `/${BUCKET}/`;
      const idx = currentUrl.indexOf(marker);
      if (idx >= 0) {
        const path = currentUrl.slice(idx + marker.length).split("?")[0];
        await supabase.storage.from(BUCKET).remove([path]).catch(() => null);
      }
      setCurrentUrl(null);
      toast.success("Vídeo da VSL removido.");
    } catch (err) {
      console.error("[VSLPanel] remove", err);
      toast.error("Não foi possível remover o vídeo.");
    } finally {
      setRemoving(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Film className="h-5 w-5" />
          Vídeo da VSL (Home)
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex items-center gap-2 text-sm">
          {loading ? (
            <span className="inline-flex items-center gap-2 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Carregando…
            </span>
          ) : currentUrl ? (
            <span className="inline-flex items-center gap-2 font-semibold text-emerald-700">
              <CheckCircle2 className="h-4 w-4" />
              Vídeo atual ativo
            </span>
          ) : (
            <span className="text-muted-foreground">
              Nenhum vídeo configurado — a Home usará o fallback.
            </span>
          )}
        </div>

        {currentUrl && (
          <div className="overflow-hidden rounded-xl border bg-black/90">
            <video
              key={currentUrl}
              src={currentUrl}
              controls
              playsInline
              preload="metadata"
              className="h-auto w-full max-h-[420px]"
            />
            <p className="break-all p-3 text-[11px] text-muted-foreground">
              {currentUrl}
            </p>
          </div>
        )}

        <div className="flex flex-wrap items-center gap-2">
          <input
            ref={inputRef}
            type="file"
            accept="video/mp4,video/webm,video/quicktime"
            className="hidden"
            onChange={onFile}
          />
          <Button onClick={onPick} disabled={uploading} className="font-semibold">
            {uploading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Enviando…
              </>
            ) : (
              <>
                <Upload className="mr-2 h-4 w-4" />
                {currentUrl ? "Substituir vídeo" : "Enviar vídeo"}
              </>
            )}
          </Button>
          {currentUrl && (
            <Button
              variant="outline"
              onClick={onRemove}
              disabled={removing}
              className="font-semibold"
            >
              {removing ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Trash2 className="mr-2 h-4 w-4" />
              )}
              Remover
            </Button>
          )}
        </div>

        <p className="text-xs text-muted-foreground">
          Formatos aceitos: MP4, WebM, MOV — máx. 200 MB. Recomendado: MP4 H.264
          720p ou 1080p para melhor compatibilidade no mobile.
        </p>
      </CardContent>
    </Card>
  );
}

export default VSLPanel;
