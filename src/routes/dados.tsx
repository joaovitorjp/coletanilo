import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import * as XLSX from "xlsx";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Toaster } from "@/components/ui/sonner";
import { Database, FileSpreadsheet, Loader2, Upload, Trash2 } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

export const Route = createFileRoute("/dados")({ component: DadosPage });

const CHUNK_SIZE = 1000;

function DadosPage() {
  const [count, setCount] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState("");
  const [fileName, setFileName] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const refreshCount = async () => {
    const { count } = await supabase
      .from("products")
      .select("*", { count: "exact", head: true });
    setCount(count ?? 0);
  };

  useEffect(() => { refreshCount(); }, []);

  const handleFile = async (file: File) => {
    setBusy(true);
    setProgress(0);
    setFileName(file.name);
    setStatus("Lendo arquivo...");
    try {
      const buf = await file.arrayBuffer();
      setStatus("Processando planilha...");
      // dense + raw for speed on large files
      const wb = XLSX.read(buf, { type: "array", dense: true, cellDates: false, cellFormula: false, cellHTML: false });
      const ws = wb.Sheets[wb.SheetNames[0]];
      if (!ws) throw new Error("Planilha vazia");
      const rows = XLSX.utils.sheet_to_json<any[]>(ws, { header: 1, raw: true, blankrows: false });
      // Detect header: skip first row if column A is non-numeric label
      let start = 0;
      const first = rows[0];
      if (first && typeof first[1] === "string" && /barra|barcode|ean/i.test(String(first[1]))) start = 1;

      const records: Array<{ internal_code: string | null; barcode: string; description: string | null; package_type: string | null; gramatura: number }> = [];
      for (let i = start; i < rows.length; i++) {
        const r = rows[i];
        if (!r) continue;
        const barcode = r[1] != null ? String(r[1]).trim() : "";
        if (!barcode) continue;
        const gramRaw = r[4];
        const g = typeof gramRaw === "number" ? gramRaw : parseFloat(String(gramRaw ?? "1").replace(",", "."));
        records.push({
          internal_code: r[0] != null ? String(r[0]).trim() : null,
          barcode,
          description: r[2] != null ? String(r[2]).trim() : null,
          package_type: r[3] != null ? String(r[3]).trim() : null,
          gramatura: isFinite(g) && g > 0 ? g : 1,
        });
      }

      // Deduplicate by barcode (keep last)
      const map = new Map<string, typeof records[number]>();
      for (const r of records) map.set(r.barcode, r);
      const unique = Array.from(map.values());

      const total = unique.length;
      setStatus(`Enviando ${total.toLocaleString("pt-BR")} produtos...`);

      let done = 0;
      for (let i = 0; i < unique.length; i += CHUNK_SIZE) {
        const chunk = unique.slice(i, i + CHUNK_SIZE);
        const { error } = await supabase.from("products").upsert(chunk, { onConflict: "barcode" });
        if (error) throw error;
        done += chunk.length;
        setProgress(Math.round((done / total) * 100));
        setStatus(`Enviados ${done.toLocaleString("pt-BR")} de ${total.toLocaleString("pt-BR")}`);
        // yield to UI
        await new Promise((r) => setTimeout(r, 0));
      }

      toast.success(`${total.toLocaleString("pt-BR")} produtos importados`);
      setStatus("Concluído");
      await refreshCount();
    } catch (e: any) {
      console.error(e);
      toast.error(e.message ?? "Erro ao importar");
      setStatus("Erro: " + (e.message ?? "desconhecido"));
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const clearAll = async () => {
    setBusy(true);
    setStatus("Limpando base...");
    const { error } = await supabase.from("products").delete().neq("id", "00000000-0000-0000-0000-000000000000");
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Base de produtos limpa");
    await refreshCount();
    setStatus("");
  };

  return (
    <AppShell title="Dados">
      <Toaster richColors position="top-center" />
      <div className="space-y-4">
        <div className="rounded-2xl border border-border bg-card p-4 shadow-[var(--shadow-card)]">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl" style={{ background: "var(--gradient-primary)" }}>
              <Database className="h-5 w-5 text-primary-foreground" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs text-muted-foreground">Produtos cadastrados</p>
              <p className="truncate text-lg font-semibold">
                {count === null ? "..." : count.toLocaleString("pt-BR")}
              </p>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-card p-4 shadow-[var(--shadow-card)]">
          <h3 className="text-sm font-semibold">Importar planilha Excel</h3>
          <p className="mt-1 text-xs text-muted-foreground">
            Colunas: A=código interno, B=código de barras, C=descrição, D=embalagem, E=gramatura
          </p>

          <input
            ref={inputRef}
            type="file"
            accept=".xlsx,.xls,.csv"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleFile(f);
            }}
          />

          <Button
            onClick={() => inputRef.current?.click()}
            disabled={busy}
            className="mt-3 h-12 w-full gap-2"
            style={{ background: "var(--gradient-primary)" }}
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
            {busy ? "Processando..." : "Selecionar arquivo"}
          </Button>

          {(busy || progress > 0) && (
            <div className="mt-4 space-y-2">
              {fileName && (
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <FileSpreadsheet className="h-4 w-4 shrink-0" />
                  <span className="truncate">{fileName}</span>
                </div>
              )}
              <Progress value={progress} className="h-2" />
              <p className="text-xs text-muted-foreground">{status}</p>
            </div>
          )}
        </div>

        {count !== null && count > 0 && !busy && (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="outline" className="h-11 w-full gap-2 text-destructive hover:bg-destructive/10 hover:text-destructive">
                <Trash2 className="h-4 w-4" /> Limpar base de produtos
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Limpar base de produtos?</AlertDialogTitle>
                <AlertDialogDescription>
                  Todos os {count.toLocaleString("pt-BR")} produtos serão removidos. Esta ação não pode ser desfeita.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction onClick={clearAll}>Limpar</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}
      </div>
    </AppShell>
  );
}
