import { useEffect, useRef, useState } from "react";
import { api, API_BASE, apiError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { FileText, ImageIcon, Upload, Trash2, Eye, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

const LABELS = { license: "Führerschein", id_card: "Personalausweis" };

export default function DocumentUpload({ docType, meta, onChanged }) {
  const inputRef = useRef(null);
  const [uploading, setUploading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState(null);

  useEffect(() => () => { if (previewUrl) URL.revokeObjectURL(previewUrl); }, [previewUrl]);

  const pick = () => inputRef.current?.click();

  const upload = async (file) => {
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { toast.error("Datei zu groß (max 5 MB)"); return; }
    const fd = new FormData();
    fd.append("file", file);
    setUploading(true);
    try {
      await api.post(`/uploads/documents/${docType}`, fd, { headers: { "Content-Type": "multipart/form-data" } });
      toast.success(`${LABELS[docType]} hochgeladen`);
      onChanged?.();
      setPreviewUrl(null);
    } catch (e) { toast.error(apiError(e)); }
    finally { setUploading(false); }
  };

  const remove = async () => {
    if (!window.confirm(`${LABELS[docType]} löschen?`)) return;
    try {
      await api.delete(`/uploads/documents/${docType}`);
      toast.success("Gelöscht");
      setPreviewUrl(null);
      onChanged?.();
    } catch (e) { toast.error(apiError(e)); }
  };

  const view = async () => {
    try {
      const { data } = await api.get(`/uploads/documents/me/${docType}`, { responseType: "blob" });
      const url = URL.createObjectURL(data);
      setPreviewUrl(url);
      window.open(url, "_blank");
    } catch (e) { toast.error(apiError(e)); }
  };

  const isImage = meta?.content_type?.startsWith("image/");

  return (
    <div className="border border-slate-200 rounded-lg p-5 bg-white" data-testid={`doc-card-${docType}`}>
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-lg bg-[#EFF4FF] text-[#0055FF] flex items-center justify-center">
            {isImage ? <ImageIcon size={16} /> : <FileText size={16} />}
          </div>
          <div>
            <div className="font-semibold text-[#0A192F]">{LABELS[docType]}</div>
            {meta ? (
              <div className="text-xs text-slate-500 truncate max-w-[220px]">{meta.filename}</div>
            ) : (
              <div className="text-xs text-slate-500">Noch nicht hochgeladen</div>
            )}
          </div>
        </div>
        {meta && (
          <div className="flex items-center gap-1 text-[11px] text-emerald-700 bg-emerald-50 border border-emerald-100 px-2 py-0.5 rounded-full">
            <CheckCircle2 size={11} /> Vorhanden
          </div>
        )}
      </div>

      {meta && (
        <div className="text-xs text-slate-500 mb-3 space-y-0.5">
          <div>Größe: {(meta.size / 1024).toFixed(1)} KB</div>
          <div>Hochgeladen: {(meta.uploaded_at || "").slice(0, 16).replace("T", " ")}</div>
        </div>
      )}

      <input
        type="file" ref={inputRef} hidden
        accept="image/png,image/jpeg,image/webp,application/pdf"
        onChange={(e) => upload(e.target.files?.[0])}
        data-testid={`doc-input-${docType}`}
      />

      <div className="flex flex-wrap gap-2">
        <Button type="button" onClick={pick} disabled={uploading} size="sm" className="bg-[#0055FF] hover:bg-[#0044CC]" data-testid={`doc-upload-${docType}`}>
          <Upload size={14} className="mr-1.5" /> {uploading ? "Lädt hoch..." : meta ? "Ersetzen" : "Hochladen"}
        </Button>
        {meta && (
          <>
            <Button type="button" variant="outline" size="sm" onClick={view} data-testid={`doc-view-${docType}`}>
              <Eye size={14} className="mr-1.5" /> Ansehen
            </Button>
            <Button type="button" variant="outline" size="sm" className="text-red-600 hover:text-red-700" onClick={remove} data-testid={`doc-delete-${docType}`}>
              <Trash2 size={14} />
            </Button>
          </>
        )}
      </div>

      <div className="mt-3 text-[11px] text-slate-400">JPG, PNG, WEBP oder PDF · max. 5 MB</div>
    </div>
  );
}
