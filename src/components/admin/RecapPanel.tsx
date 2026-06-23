import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Trash2, Upload, ImageIcon, Star, ArrowUp, ArrowDown } from "lucide-react";

interface RecapData {
  title: string;
  description: string;
  cover: string;
  photos: string[];
}

const BUCKET = "hero-media";
const FOLDER = "recap";

const DEFAULTS: RecapData = {
  title: "Vamos recapitular o que aconteceu no ano passado?",
  description:
    "Ano passado tivemos uma mostra de artes poderosa com diversos ministérios de artes da nossa cidade de Uberlândia, acompanhe como foi esse dia.",
  cover: "",
  photos: [],
};

export function RecapPanel() {
  const [data, setData] = useState<RecapData>(DEFAULTS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data: row } = await supabase
      .from("app_settings")
      .select("value")
      .eq("key", "recap_gallery")
      .maybeSingle();
    if (row?.value) {
      const v = row.value as Partial<RecapData>;
      setData({
        title: v.title || DEFAULTS.title,
        description: v.description || DEFAULTS.description,
        cover: v.cover || "",
        photos: Array.isArray(v.photos) ? v.photos : [],
      });
    }
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const persist = async (next: RecapData) => {
    setSaving(true);
    const { error } = await supabase
      .from("app_settings")
      .upsert({ key: "recap_gallery", value: next as never }, { onConflict: "key" });
    setSaving(false);
    if (error) {
      toast.error("Erro ao salvar: " + error.message);
      return false;
    }
    setData(next);
    return true;
  };

  const saveTexts = async () => {
    const ok = await persist(data);
    if (ok) toast.success("Textos atualizados");
  };

  const upload = async (file: File): Promise<string | null> => {
    const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
    const path = `${FOLDER}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
      cacheControl: "3600",
      contentType: file.type,
    });
    if (error) {
      toast.error("Falha no upload: " + error.message);
      return null;
    }
    const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(path);
    return pub.publicUrl;
  };

  const onCoverPick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setUploading(true);
    const url = await upload(file);
    setUploading(false);
    if (url) {
      const next = { ...data, cover: url };
      const ok = await persist(next);
      if (ok) toast.success("Capa atualizada");
    }
  };

  const onPhotosPick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    e.target.value = "";
    if (!files.length) return;
    setUploading(true);
    const urls: string[] = [];
    for (const f of files) {
      const u = await upload(f);
      if (u) urls.push(u);
    }
    setUploading(false);
    if (urls.length) {
      const next = { ...data, photos: [...data.photos, ...urls] };
      const ok = await persist(next);
      if (ok) toast.success(`${urls.length} foto(s) adicionada(s)`);
    }
  };

  const removePhoto = async (idx: number) => {
    const next = { ...data, photos: data.photos.filter((_, i) => i !== idx) };
    const ok = await persist(next);
    if (ok) toast.success("Foto removida");
  };

  const setAsCover = async (idx: number) => {
    const next = { ...data, cover: data.photos[idx] };
    const ok = await persist(next);
    if (ok) toast.success("Capa atualizada");
  };

  const move = async (idx: number, dir: -1 | 1) => {
    const j = idx + dir;
    if (j < 0 || j >= data.photos.length) return;
    const arr = [...data.photos];
    [arr[idx], arr[j]] = [arr[j], arr[idx]];
    await persist({ ...data, photos: arr });
  };

  if (loading) return <p className="text-sm text-muted-foreground">Carregando…</p>;

  return (
    <div className="space-y-6">
      <Card className="p-5 bg-amber-50 border-amber-200">
        <h3 className="font-semibold text-amber-900 flex items-center gap-2">
          <ImageIcon className="h-4 w-4" /> Como usar essa seção
        </h3>
        <ul className="mt-3 list-disc pl-5 text-sm text-amber-900/90 space-y-1.5">
          <li>O <b>título</b> e o <b>texto</b> aparecem no topo do bloco “Novidades & avisos” na Home.</li>
          <li>A <b>capa</b> é a imagem grande exibida acima da galeria. Use uma foto horizontal de alta qualidade.</li>
          <li>As <b>fotos da galeria</b> aparecem em miniaturas; ao clicar, abre um modal que avança automaticamente. Ao clicar nas setas o avanço passa a ser manual.</li>
          <li>Para trocar a capa rapidamente, clique no ícone de estrela em qualquer foto.</li>
          <li>Formatos aceitos: JPG, PNG ou WEBP. Recomendado até 2 MB por imagem.</li>
          <li>Não exclua todas as fotos — a primeira é usada como capa caso a capa esteja vazia.</li>
        </ul>
      </Card>

      <Card className="p-5 space-y-4">
        <div>
          <Label htmlFor="recap-title">Título</Label>
          <Input
            id="recap-title"
            value={data.title}
            onChange={(e) => setData({ ...data, title: e.target.value })}
          />
        </div>
        <div>
          <Label htmlFor="recap-desc">Texto / descrição</Label>
          <Textarea
            id="recap-desc"
            rows={4}
            value={data.description}
            onChange={(e) => setData({ ...data, description: e.target.value })}
          />
        </div>
        <Button onClick={saveTexts} disabled={saving}>
          {saving ? "Salvando…" : "Salvar textos"}
        </Button>
      </Card>

      <Card className="p-5 space-y-4">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h3 className="font-semibold">Foto de capa</h3>
            <p className="text-xs text-muted-foreground">Imagem horizontal grande exibida no topo.</p>
          </div>
          <Label className="inline-flex items-center gap-2 cursor-pointer rounded-md border px-3 py-2 text-sm hover:bg-muted">
            <Upload className="h-4 w-4" />
            {uploading ? "Enviando…" : "Trocar capa"}
            <input type="file" accept="image/*" className="hidden" onChange={onCoverPick} disabled={uploading} />
          </Label>
        </div>
        {data.cover ? (
          <img src={data.cover} alt="Capa" className="w-full max-h-72 object-cover rounded-lg border" />
        ) : (
          <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
            Sem capa definida. A primeira foto da galeria será usada.
          </div>
        )}
      </Card>

      <Card className="p-5 space-y-4">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h3 className="font-semibold">Galeria de fotos</h3>
            <p className="text-xs text-muted-foreground">
              {data.photos.length} foto(s). Você pode enviar várias de uma vez.
            </p>
          </div>
          <Label className="inline-flex items-center gap-2 cursor-pointer rounded-md border px-3 py-2 text-sm hover:bg-muted">
            <Upload className="h-4 w-4" />
            {uploading ? "Enviando…" : "Adicionar fotos"}
            <input
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={onPhotosPick}
              disabled={uploading}
            />
          </Label>
        </div>

        {data.photos.length === 0 ? (
          <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
            Nenhuma foto na galeria ainda.
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {data.photos.map((src, i) => (
              <div key={src + i} className="relative group rounded-lg overflow-hidden border">
                <img src={src} alt={`Foto ${i + 1}`} className="aspect-square object-cover w-full" />
                <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition flex flex-col items-center justify-center gap-2 p-2">
                  <div className="flex gap-1">
                    <Button size="icon" variant="secondary" className="h-8 w-8" onClick={() => move(i, -1)} disabled={i === 0} title="Mover para esquerda">
                      <ArrowUp className="h-4 w-4 -rotate-90" />
                    </Button>
                    <Button size="icon" variant="secondary" className="h-8 w-8" onClick={() => move(i, 1)} disabled={i === data.photos.length - 1} title="Mover para direita">
                      <ArrowDown className="h-4 w-4 -rotate-90" />
                    </Button>
                  </div>
                  <Button size="sm" variant="secondary" className="h-8" onClick={() => setAsCover(i)} title="Usar como capa">
                    <Star className="h-3.5 w-3.5 mr-1" /> Capa
                  </Button>
                  <Button size="sm" variant="destructive" className="h-8" onClick={() => removePhoto(i)}>
                    <Trash2 className="h-3.5 w-3.5 mr-1" /> Excluir
                  </Button>
                </div>
                {data.cover === src && (
                  <span className="absolute top-1.5 left-1.5 rounded-full bg-amber-400 text-amber-950 text-[10px] font-bold px-2 py-0.5 inline-flex items-center gap-1">
                    <Star className="h-3 w-3" /> CAPA
                  </span>
                )}
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
