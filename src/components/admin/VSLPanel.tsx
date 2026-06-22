import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Upload, Trash2, CheckCircle2, Film, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";

const SETTINGS_KEY = "home_vsl_video_url";
const BUCKET = "vsl-videos";
const MAX_BYTES = 1024 * 1024 * 1024; // 1 GB
const ALLOWED = ["video/mp4", "video/webm", "video/quicktime"];

type StoredValue =
  | { bucket: string; path: string }
  | string
  | null;

export function VSLPanel() {
  const [storedPath, setStoredPath] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState<number | null>(null);
  const [removing, setRemoving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const buildPreview = async (val: StoredValue) => {
    if (!val) {
      setStoredPath(null);
      setPreviewUrl(null);
      return;
    }
    if (typeof val === "string") {
      // URL legada (bucket público)
      setStoredPath(null);
      setPreviewUrl(val);
      return;
    }
    setStoredPath(val.path);
    const { data } = await supabase.storage
      .from(val.bucket)
      .createSignedUrl(val.path, 60 * 60); // 1h
    setPreviewUrl(data?.signedUrl ?? null);
  };

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("app_settings")
      .select("value")
      .eq("key", SETTINGS_KEY)
      .maybeSingle();
    if (error) console.error("[VSLPanel] load", error);
    await buildPreview((data?.value ?? null) as StoredValue);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const persist = async (val: StoredValue) => {
    const { error } = await supabase
      .from("app_settings")
      .upsert(
        { key: SETTINGS_KEY, value: val as unknown as object | null },
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
      toast.error("Arquivo muito grande (máx 1 GB).");
      return;
    }

    setUploading(true);
    setProgress(0);
    try {
      const ext = file.name.split(".").pop()?.toLowerCase() || "mp4";
      const path = `home/vsl-${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from(BUCKET)
        .upload(path, file, {
          contentType: file.type,
          cacheControl: "3600",
          upsert: false,
        });
      if (upErr) throw upErr;

      await persist({ bucket: BUCKET, path });
      await buildPreview({ bucket: BUCKET, path });
      toast.success("Vídeo da VSL atualizado com sucesso!");
    } catch (err) {
      console.error("[VSLPanel] upload", err);
      toast.error(
        err instanceof Error ? err.message : "Falha ao enviar o vídeo.",
      );
    } finally {
      setUploading(false);
      setProgress(null);
    }
  };

  const onRemove = async () => {
    if (!previewUrl) return;
    if (!confirm("Remover o vídeo atual da VSL?")) return;
    setRemoving(true);
    try {
      if (storedPath) {
        await supabase.storage.from(BUCKET).remove([storedPath]).catch(() => null);
      }
      await persist(null);
      setStoredPath(null);
      setPreviewUrl(null);
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
          ) : previewUrl ? (
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

        {previewUrl && (
          <div className="overflow-hidden rounded-xl border bg-black/90">
            <video
              key={previewUrl}
              src={previewUrl}
              controls
              playsInline
              preload="metadata"
              className="h-auto max-h-[420px] w-full"
            />
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
                Enviando{progress != null ? ` ${progress}%` : "…"}
              </>
            ) : (
              <>
                <Upload className="mr-2 h-4 w-4" />
                {previewUrl ? "Substituir vídeo" : "Enviar vídeo"}
              </>
            )}
          </Button>
          {previewUrl && (
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
          Formatos aceitos: MP4, WebM, MOV — máx. 1 GB. Recomendado: MP4 H.264
          720p/1080p para melhor compatibilidade no mobile.
        </p>
      </CardContent>
    </Card>
  );
}

export default VSLPanel;
