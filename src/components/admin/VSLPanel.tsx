import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import {
  Upload,
  Trash2,
  CheckCircle2,
  Film,
  Image as ImageIcon,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";

const VIDEO_KEY = "home_vsl_video_url";
const THUMB_KEY = "home_vsl_thumbnail_url";
const VIDEO_BUCKET = "vsl-videos";
const THUMB_BUCKET = "hero-media";
const MAX_VIDEO = 1024 * 1024 * 1024; // 1 GB
const MAX_THUMB = 5 * 1024 * 1024; // 5 MB
const ALLOWED_VIDEO = ["video/mp4", "video/webm"];
const ALLOWED_THUMB = ["image/jpeg", "image/png", "image/webp"];

type StoredValue =
  | { bucket: string; path: string }
  | string
  | null;

async function buildSignedOrPublic(val: StoredValue): Promise<string | null> {
  if (!val) return null;
  if (typeof val === "string") return val;
  const { data: signed } = await supabase.storage
    .from(val.bucket)
    .createSignedUrl(val.path, 60 * 60);
  if (signed?.signedUrl) return signed.signedUrl;
  const pub = supabase.storage.from(val.bucket).getPublicUrl(val.path);
  return pub?.data?.publicUrl ?? null;
}

async function persistSetting(key: string, val: StoredValue) {
  const { error } = await supabase
    .from("app_settings")
    .upsert(
      [{ key, value: val as unknown as never }],
      { onConflict: "key" },
    );
  if (error) throw error;
}

export function VSLPanel() {
  const [videoVal, setVideoVal] = useState<StoredValue>(null);
  const [thumbVal, setThumbVal] = useState<StoredValue>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [thumbUrl, setThumbUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploadingVideo, setUploadingVideo] = useState(false);
  const [uploadingThumb, setUploadingThumb] = useState(false);
  const [removingVideo, setRemovingVideo] = useState(false);
  const [removingThumb, setRemovingThumb] = useState(false);
  const videoInput = useRef<HTMLInputElement>(null);
  const thumbInput = useRef<HTMLInputElement>(null);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("app_settings")
      .select("key,value")
      .in("key", [VIDEO_KEY, THUMB_KEY]);
    if (error) console.error("[VSLPanel] load", error);
    const map = new Map((data ?? []).map((r) => [r.key, r.value as StoredValue]));
    const v = (map.get(VIDEO_KEY) ?? null) as StoredValue;
    const t = (map.get(THUMB_KEY) ?? null) as StoredValue;
    setVideoVal(v);
    setThumbVal(t);
    setVideoUrl(await buildSignedOrPublic(v));
    setThumbUrl(await buildSignedOrPublic(t));
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const onPickVideo = () => videoInput.current?.click();
  const onPickThumb = () => thumbInput.current?.click();

  const onVideoFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    if (!ALLOWED_VIDEO.includes(file.type)) {
      toast.error("Formato inválido. Use MP4 ou WebM compatível com navegador.");
      return;
    }
    if (file.size > MAX_VIDEO) {
      toast.error("Arquivo muito grande (máx 1 GB).");
      return;
    }

    setUploadingVideo(true);
    try {
      const ext = file.name.split(".").pop()?.toLowerCase() || "mp4";
      const path = `home/vsl-${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from(VIDEO_BUCKET)
        .upload(path, file, {
          contentType: file.type,
          cacheControl: "3600",
          upsert: false,
        });
      if (upErr) throw upErr;

      const next = { bucket: VIDEO_BUCKET, path };
      await persistSetting(VIDEO_KEY, next);
      setVideoVal(next);
      setVideoUrl(await buildSignedOrPublic(next));
      toast.success("Vídeo da VSL atualizado com sucesso!");
    } catch (err) {
      console.error("[VSLPanel] upload video", err);
      toast.error(
        err instanceof Error ? err.message : "Falha ao enviar o vídeo.",
      );
    } finally {
      setUploadingVideo(false);
    }
  };

  const onThumbFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    if (!ALLOWED_THUMB.includes(file.type)) {
      toast.error("Formato inválido. Use JPG, PNG ou WebP.");
      return;
    }
    if (file.size > MAX_THUMB) {
      toast.error("Imagem muito grande (máx 5 MB).");
      return;
    }

    setUploadingThumb(true);
    try {
      const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
      const path = `home/vsl-thumb-${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from(THUMB_BUCKET)
        .upload(path, file, {
          contentType: file.type,
          cacheControl: "3600",
          upsert: false,
        });
      if (upErr) throw upErr;

      const next = { bucket: THUMB_BUCKET, path };
      await persistSetting(THUMB_KEY, next);
      setThumbVal(next);
      setThumbUrl(await buildSignedOrPublic(next));
      toast.success("Thumbnail atualizada com sucesso!");
    } catch (err) {
      console.error("[VSLPanel] upload thumb", err);
      toast.error(
        err instanceof Error ? err.message : "Falha ao enviar a imagem.",
      );
    } finally {
      setUploadingThumb(false);
    }
  };

  const onRemoveVideo = async () => {
    if (!videoVal) return;
    if (!confirm("Remover o vídeo atual da VSL?")) return;
    setRemovingVideo(true);
    try {
      if (typeof videoVal !== "string" && videoVal?.path) {
        await supabase.storage
          .from(videoVal.bucket)
          .remove([videoVal.path])
          .catch(() => null);
      }
      await persistSetting(VIDEO_KEY, null);
      setVideoVal(null);
      setVideoUrl(null);
      toast.success("Vídeo removido.");
    } catch (err) {
      console.error("[VSLPanel] remove video", err);
      toast.error("Não foi possível remover o vídeo.");
    } finally {
      setRemovingVideo(false);
    }
  };

  const onRemoveThumb = async () => {
    if (!thumbVal) return;
    if (!confirm("Remover a thumbnail atual?")) return;
    setRemovingThumb(true);
    try {
      if (typeof thumbVal !== "string" && thumbVal?.path) {
        await supabase.storage
          .from(thumbVal.bucket)
          .remove([thumbVal.path])
          .catch(() => null);
      }
      await persistSetting(THUMB_KEY, null);
      setThumbVal(null);
      setThumbUrl(null);
      toast.success("Thumbnail removida.");
    } catch (err) {
      console.error("[VSLPanel] remove thumb", err);
      toast.error("Não foi possível remover a imagem.");
    } finally {
      setRemovingThumb(false);
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
      <CardContent className="space-y-8">
        {/* ===== VÍDEO ===== */}
        <section className="space-y-4">
          <div className="flex items-center gap-2 text-sm">
            <Film className="h-4 w-4" />
            <span className="font-semibold">Vídeo</span>
            {loading ? (
              <span className="inline-flex items-center gap-2 text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Carregando…
              </span>
            ) : videoUrl ? (
              <span className="inline-flex items-center gap-2 font-semibold text-emerald-700">
                <CheckCircle2 className="h-4 w-4" />
                Ativo
              </span>
            ) : (
              <span className="text-muted-foreground">Nenhum vídeo configurado</span>
            )}
          </div>

          {videoUrl && (
            <div className="overflow-hidden rounded-xl border bg-black/90">
              <video
                key={videoUrl}
                src={videoUrl}
                controls
                playsInline
                preload="metadata"
                className="h-auto max-h-[420px] w-full"
              />
            </div>
          )}

          <div className="flex flex-wrap items-center gap-2">
            <input
              ref={videoInput}
              type="file"
              accept="video/mp4,video/webm,video/quicktime"
              className="hidden"
              onChange={onVideoFile}
            />
            <Button onClick={onPickVideo} disabled={uploadingVideo} className="font-semibold">
              {uploadingVideo ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Enviando…
                </>
              ) : (
                <>
                  <Upload className="mr-2 h-4 w-4" />
                  {videoUrl ? "Substituir vídeo" : "Enviar vídeo"}
                </>
              )}
            </Button>
            {videoUrl && (
              <Button
                variant="outline"
                onClick={onRemoveVideo}
                disabled={removingVideo}
                className="font-semibold"
              >
                {removingVideo ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Trash2 className="mr-2 h-4 w-4" />
                )}
                Remover
              </Button>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            Formatos aceitos: MP4, WebM, MOV — máx. 1 GB.
          </p>
        </section>

        <div className="h-px bg-border" />

        {/* ===== THUMBNAIL ===== */}
        <section className="space-y-4">
          <div className="flex items-center gap-2 text-sm">
            <ImageIcon className="h-4 w-4" />
            <span className="font-semibold">Thumbnail (imagem de capa)</span>
            {loading ? null : thumbUrl ? (
              <span className="inline-flex items-center gap-2 font-semibold text-emerald-700">
                <CheckCircle2 className="h-4 w-4" />
                Ativa
              </span>
            ) : (
              <span className="text-muted-foreground">
                Nenhuma imagem definida — será usado o fallback padrão.
              </span>
            )}
          </div>

          {thumbUrl && (
            <div className="overflow-hidden rounded-xl border bg-black/90">
              <img
                src={thumbUrl}
                alt="Thumbnail da VSL"
                className="h-auto max-h-[320px] w-full object-contain"
              />
            </div>
          )}

          <div className="flex flex-wrap items-center gap-2">
            <input
              ref={thumbInput}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={onThumbFile}
            />
            <Button onClick={onPickThumb} disabled={uploadingThumb} className="font-semibold">
              {uploadingThumb ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Enviando…
                </>
              ) : (
                <>
                  <Upload className="mr-2 h-4 w-4" />
                  {thumbUrl ? "Substituir thumbnail" : "Enviar thumbnail"}
                </>
              )}
            </Button>
            {thumbUrl && (
              <Button
                variant="outline"
                onClick={onRemoveThumb}
                disabled={removingThumb}
                className="font-semibold"
              >
                {removingThumb ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Trash2 className="mr-2 h-4 w-4" />
                )}
                Remover
              </Button>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            Formatos aceitos: JPG, PNG ou WebP — máx. 5 MB. Recomendado 1280×720.
          </p>
        </section>
      </CardContent>
    </Card>
  );
}

export default VSLPanel;
