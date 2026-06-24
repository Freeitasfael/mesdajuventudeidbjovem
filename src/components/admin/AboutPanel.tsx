import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import {
  Upload,
  Trash2,
  Loader2,
  Image as ImageIcon,
  Save,
  Info,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";

const HEADING_KEY = "about_heading";
const BODY_KEY = "about_body";
const IMAGE_KEY = "about_image_url";
const KICKER_KEY = "about_caption_kicker";
const CAPTION_KEY = "about_caption_title";

const IMAGE_BUCKET = "hero-media";
const MAX_IMAGE = 8 * 1024 * 1024;
const ALLOWED_IMAGE = ["image/jpeg", "image/png", "image/webp"];

const DEFAULTS = {
  heading: "O maior movimento jovem da Igreja de Deus no Brasil",
  body: `O **Mês da Juventude** acontece em todo o país, reunindo jovens da Igreja de Deus no Brasil para viver esse tempo de forma única em cada lugar.

Cada estado se movimenta do seu jeito, com ações, encontros e momentos que levam uma mensagem simples e real: **Jesus transforma.**

E em **Minas Gerais** isso ganha ainda mais força. Neste ano, a IDB Jovem Minas Gerais está preparando uma grande mobilização em um final de semana especial — um encontro que vai reunir jovens de várias cidades para viver algo marcante juntos.

Mais do que um evento, é um tempo de **conexão, fé e propósito.**

Há 16 anos esse movimento vem impactando gerações dentro da nossa igreja, levando uma mensagem que continua transformando vidas.`,
  kicker: "Edição atual",
  caption: "Jesus Transforma — Tour Nacional",
};

type StoredImage = { bucket: string; path: string } | string | null;

async function resolveImageUrl(val: StoredImage): Promise<string | null> {
  if (!val) return null;
  if (typeof val === "string") return val;
  const { data: signed } = await supabase.storage
    .from(val.bucket)
    .createSignedUrl(val.path, 60 * 60 * 6);
  if (signed?.signedUrl) return signed.signedUrl;
  const pub = supabase.storage.from(val.bucket).getPublicUrl(val.path);
  return pub?.data?.publicUrl ?? null;
}

async function persistSetting(key: string, value: unknown) {
  const { error } = await supabase
    .from("app_settings")
    .upsert([{ key, value: value as never }], { onConflict: "key" });
  if (error) throw error;
}

export function AboutPanel() {
  const [heading, setHeading] = useState(DEFAULTS.heading);
  const [body, setBody] = useState(DEFAULTS.body);
  const [kicker, setKicker] = useState(DEFAULTS.kicker);
  const [caption, setCaption] = useState(DEFAULTS.caption);
  const [imageVal, setImageVal] = useState<StoredImage>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingImg, setUploadingImg] = useState(false);
  const [removingImg, setRemovingImg] = useState(false);
  const imgInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("app_settings")
        .select("key,value")
        .in("key", [HEADING_KEY, BODY_KEY, IMAGE_KEY, KICKER_KEY, CAPTION_KEY]);
      if (error) console.error("[AboutPanel] load", error);
      const map = new Map((data ?? []).map((r) => [r.key, r.value as unknown]));
      if (typeof map.get(HEADING_KEY) === "string")
        setHeading(map.get(HEADING_KEY) as string);
      if (typeof map.get(BODY_KEY) === "string")
        setBody(map.get(BODY_KEY) as string);
      if (typeof map.get(KICKER_KEY) === "string")
        setKicker(map.get(KICKER_KEY) as string);
      if (typeof map.get(CAPTION_KEY) === "string")
        setCaption(map.get(CAPTION_KEY) as string);
      const img = (map.get(IMAGE_KEY) ?? null) as StoredImage;
      setImageVal(img);
      setImageUrl(await resolveImageUrl(img));
      setLoading(false);
    })();
  }, []);

  const saveText = async () => {
    setSaving(true);
    try {
      await Promise.all([
        persistSetting(HEADING_KEY, heading.trim()),
        persistSetting(BODY_KEY, body),
        persistSetting(KICKER_KEY, kicker.trim()),
        persistSetting(CAPTION_KEY, caption.trim()),
      ]);
      toast.success("Textos salvos!");
    } catch (err) {
      console.error("[AboutPanel] save", err);
      toast.error(err instanceof Error ? err.message : "Falha ao salvar.");
    } finally {
      setSaving(false);
    }
  };

  const onPickImage = () => imgInput.current?.click();

  const onImageFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!ALLOWED_IMAGE.includes(file.type)) {
      toast.error("Formato inválido. Use JPG, PNG ou WebP.");
      return;
    }
    if (file.size > MAX_IMAGE) {
      toast.error("Imagem muito grande (máx 8 MB).");
      return;
    }
    setUploadingImg(true);
    try {
      const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
      const path = `home/about-${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from(IMAGE_BUCKET)
        .upload(path, file, {
          contentType: file.type,
          cacheControl: "3600",
          upsert: false,
        });
      if (upErr) throw upErr;
      const next = { bucket: IMAGE_BUCKET, path };
      await persistSetting(IMAGE_KEY, next);
      setImageVal(next);
      setImageUrl(await resolveImageUrl(next));
      toast.success("Foto atualizada!");
    } catch (err) {
      console.error("[AboutPanel] upload img", err);
      toast.error(err instanceof Error ? err.message : "Falha ao enviar.");
    } finally {
      setUploadingImg(false);
    }
  };

  const onRemoveImage = async () => {
    if (!imageVal) return;
    if (!confirm("Remover a foto atual?")) return;
    setRemovingImg(true);
    try {
      if (typeof imageVal !== "string" && imageVal?.path) {
        await supabase.storage
          .from(imageVal.bucket)
          .remove([imageVal.path])
          .catch(() => null);
      }
      await persistSetting(IMAGE_KEY, null);
      setImageVal(null);
      setImageUrl(null);
      toast.success("Foto removida.");
    } catch (err) {
      console.error("[AboutPanel] remove img", err);
      toast.error("Não foi possível remover.");
    } finally {
      setRemovingImg(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Info className="h-5 w-5" />
          Sobre o evento (Home)
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-8">
        {loading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Carregando…
          </div>
        ) : (
          <>
            {/* ===== TEXTO ===== */}
            <section className="space-y-4">
              <div>
                <Label htmlFor="about-heading">Título da seção</Label>
                <Input
                  id="about-heading"
                  value={heading}
                  onChange={(e) => setHeading(e.target.value)}
                  className="mt-1"
                />
              </div>

              <div>
                <Label htmlFor="about-body">
                  Texto (parágrafos separados por linha em branco)
                </Label>
                <Textarea
                  id="about-body"
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  rows={10}
                  className="mt-1 font-mono text-sm"
                />
                <p className="mt-1 text-xs text-muted-foreground">
                  Use <code>**texto**</code> para deixar em negrito.
                </p>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <Label htmlFor="about-kicker">Legenda — chamada</Label>
                  <Input
                    id="about-kicker"
                    value={kicker}
                    onChange={(e) => setKicker(e.target.value)}
                    className="mt-1"
                    placeholder="Ex: Edição atual"
                  />
                </div>
                <div>
                  <Label htmlFor="about-caption">Legenda — título</Label>
                  <Input
                    id="about-caption"
                    value={caption}
                    onChange={(e) => setCaption(e.target.value)}
                    className="mt-1"
                    placeholder="Ex: Jesus Transforma — Tour Nacional"
                  />
                </div>
              </div>

              <Button onClick={saveText} disabled={saving} className="font-semibold">
                {saving ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Save className="mr-2 h-4 w-4" />
                )}
                Salvar textos
              </Button>
            </section>

            <div className="h-px bg-border" />

            {/* ===== FOTO ===== */}
            <section className="space-y-4">
              <div className="flex items-center gap-2 text-sm">
                <ImageIcon className="h-4 w-4" />
                <span className="font-semibold">Foto da seção</span>
              </div>

              {imageUrl && (
                <div className="overflow-hidden rounded-xl border bg-black/90">
                  <img
                    src={imageUrl}
                    alt="Foto Sobre o evento"
                    className="h-auto max-h-[360px] w-full object-contain"
                  />
                </div>
              )}

              <div className="flex flex-wrap items-center gap-2">
                <input
                  ref={imgInput}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="hidden"
                  onChange={onImageFile}
                />
                <Button
                  onClick={onPickImage}
                  disabled={uploadingImg}
                  className="font-semibold"
                >
                  {uploadingImg ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Enviando…
                    </>
                  ) : (
                    <>
                      <Upload className="mr-2 h-4 w-4" />
                      {imageUrl ? "Substituir foto" : "Enviar foto"}
                    </>
                  )}
                </Button>
                {imageUrl && (
                  <Button
                    variant="outline"
                    onClick={onRemoveImage}
                    disabled={removingImg}
                    className="font-semibold"
                  >
                    {removingImg ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Trash2 className="mr-2 h-4 w-4" />
                    )}
                    Remover
                  </Button>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                Formatos: JPG, PNG ou WebP — máx. 8 MB. Recomendado proporção
                vertical/quadrada.
              </p>
            </section>
          </>
        )}
      </CardContent>
    </Card>
  );
}

export default AboutPanel;
