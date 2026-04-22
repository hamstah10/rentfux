import { useEffect, useState } from "react";
import { api, apiError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { FileText, ImageIcon, Eye, XCircle } from "lucide-react";
import { toast } from "sonner";

const LABELS = { license: "Führerschein", id_card: "Personalausweis" };

export default function AdminDocumentCard({ customerId, docType, meta }) {
  const [url, setUrl] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => () => { if (url) URL.revokeObjectURL(url); }, [url]);

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await api.get(`/admin/customers/${customerId}/documents/${docType}`, { responseType: "blob" });
      setUrl(URL.createObjectURL(data));
    } catch (e) { toast.error(apiError(e)); }
    finally { setLoading(false); }
  };

  const close = () => {
    if (url) URL.revokeObjectURL(url);
    setUrl(null);
  };

  const isImage = meta?.content_type?.startsWith("image/");

  return (
    <div className="border border-slate-200 rounded-lg p-4 bg-white" data-testid={`admin-doc-${docType}`}>
      <div className="flex items-start gap-3 mb-3">
        <div className="w-9 h-9 rounded-lg bg-[#EFF4FF] text-[#0055FF] flex items-center justify-center">
          {isImage ? <ImageIcon size={16} /> : <FileText size={16} />}
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-semibold text-[#0A192F]">{LABELS[docType]}</div>
          {meta ? (
            <>
              <div className="text-xs text-slate-500 truncate">{meta.filename}</div>
              <div className="text-xs text-slate-400 mt-0.5">
                {(meta.size / 1024).toFixed(1)} KB · {(meta.uploaded_at || "").slice(0, 16).replace("T", " ")}
              </div>
            </>
          ) : (
            <div className="text-xs text-slate-400">Nicht hochgeladen</div>
          )}
        </div>
      </div>

      {meta && !url && (
        <Button size="sm" variant="outline" onClick={load} disabled={loading} data-testid={`admin-doc-view-${docType}`}>
          <Eye size={14} className="mr-1.5" /> {loading ? "Lädt..." : "Ansehen"}
        </Button>
      )}

      {url && (
        <div className="mt-3">
          <div className="relative border border-slate-200 rounded-md overflow-hidden bg-slate-50">
            {isImage ? (
              <img src={url} alt={LABELS[docType]} className="w-full max-h-96 object-contain" />
            ) : (
              <iframe src={url} title={LABELS[docType]} className="w-full h-96" />
            )}
            <Button size="sm" variant="outline" className="absolute top-2 right-2 h-7 bg-white" onClick={close}>
              <XCircle size={14} />
            </Button>
          </div>
          <a href={url} target="_blank" rel="noreferrer" className="text-xs text-[#0055FF] hover:underline mt-2 inline-block">
            In neuem Tab öffnen
          </a>
        </div>
      )}
    </div>
  );
}
