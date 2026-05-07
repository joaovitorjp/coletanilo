import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Toaster } from "@/components/ui/sonner";
import { Camera, Check, Keyboard, Loader2, Minus, Package, Plus, Trash2 } from "lucide-react";
import { BarcodeScanner } from "@/components/BarcodeScanner";

export const Route = createFileRoute("/coleta/$id")({ component: ColetaPage });

type Item = { id: string; barcode: string; quantity: number; created_at: string };
type Coll = { id: string; number: number; store_code: string; store_name: string; status: string };

function ColetaPage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const [coll, setColl] = useState<Coll | null>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [mode, setMode] = useState<"keyboard" | "scan">("keyboard");
  const [barcode, setBarcode] = useState("");
  const [qty, setQty] = useState(1);
  const [scanning, setScanning] = useState(false);
  const [finishing, setFinishing] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const load = async () => {
    const [{ data: c }, { data: it }] = await Promise.all([
      supabase.from("collections").select("*").eq("id", id).single(),
      supabase.from("collection_items").select("*").eq("collection_id", id).order("created_at", { ascending: false }),
    ]);
    if (c) setColl(c as Coll);
    if (it) setItems(it as Item[]);
  };

  useEffect(() => { load(); }, [id]);

  const addItem = async (code: string, q: number) => {
    const clean = code.trim();
    if (!clean) { toast.error("Informe o código"); return; }
    if (q < 1) { toast.error("Quantidade inválida"); return; }
    const { data, error } = await supabase
      .from("collection_items")
      .insert({ collection_id: id, barcode: clean, quantity: q })
      .select()
      .single();
    if (error) { toast.error(error.message); return; }
    setItems((prev) => [data as Item, ...prev]);
    setBarcode("");
    setQty(1);
    toast.success(`${clean} × ${q} adicionado`);
    inputRef.current?.focus();
  };

  const removeItem = async (itemId: string) => {
    const prev = items;
    setItems(items.filter((i) => i.id !== itemId));
    const { error } = await supabase.from("collection_items").delete().eq("id", itemId);
    if (error) { setItems(prev); toast.error(error.message); }
  };

  const finish = async () => {
    if (items.length === 0) { toast.error("Adicione ao menos um item"); return; }
    setFinishing(true);
    const { error } = await supabase
      .from("collections")
      .update({ status: "finished", finished_at: new Date().toISOString() })
      .eq("id", id);
    setFinishing(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Coleta finalizada");
    navigate({ to: "/coleta/$id/resumo", params: { id } });
  };

  if (!coll) return <AppShell><div className="flex justify-center pt-10"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div></AppShell>;

  const totalQty = items.reduce((s, i) => s + Number(i.quantity), 0);

  return (
    <AppShell title={`Coleta #${String(coll.number).padStart(3, "0")}`}>
      <Toaster richColors position="top-center" />
      {scanning && (
        <BarcodeScanner
          onDetected={(code) => { setScanning(false); addItem(code, qty || 1); }}
          onClose={() => setScanning(false)}
        />
      )}
      <div className="space-y-4">
        <div className="rounded-2xl border border-border bg-card p-4 shadow-[var(--shadow-card)]">
          <p className="text-xs font-medium text-muted-foreground">LOJA {coll.store_code}</p>
          <p className="text-sm font-semibold">{coll.store_name}</p>
          <div className="mt-3 flex justify-between text-xs">
            <span className="text-muted-foreground">Itens: <strong className="text-foreground">{items.length}</strong></span>
            <span className="text-muted-foreground">Qtd total: <strong className="text-foreground">{totalQty}</strong></span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 rounded-2xl bg-secondary p-1">
          <button onClick={() => setMode("keyboard")} className={`flex items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-medium transition-all ${mode === "keyboard" ? "bg-card shadow-sm" : "text-muted-foreground"}`}>
            <Keyboard className="h-4 w-4" /> Digitar
          </button>
          <button onClick={() => setMode("scan")} className={`flex items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-medium transition-all ${mode === "scan" ? "bg-card shadow-sm" : "text-muted-foreground"}`}>
            <Camera className="h-4 w-4" /> Escanear
          </button>
        </div>

        <div className="space-y-3 rounded-2xl border border-border bg-card p-4 shadow-[var(--shadow-card)]">
          {mode === "keyboard" ? (
            <Input
              ref={inputRef}
              autoFocus
              inputMode="numeric"
              placeholder="Código de barras"
              value={barcode}
              onChange={(e) => setBarcode(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") addItem(barcode, qty); }}
              className="h-12 text-base"
            />
          ) : (
            <Button onClick={() => setScanning(true)} variant="outline" className="h-12 w-full gap-2">
              <Camera className="h-4 w-4" /> Abrir câmera
            </Button>
          )}

          <div>
            <label className="text-xs font-medium text-muted-foreground">Quantidade</label>
            <div className="mt-1 flex items-center gap-2">
              <Button type="button" variant="outline" size="icon" className="h-12 w-12 shrink-0" onClick={() => setQty(Math.max(1, qty - 1))}>
                <Minus className="h-4 w-4" />
              </Button>
              <Input
                type="number"
                inputMode="numeric"
                value={qty}
                onChange={(e) => setQty(Math.max(1, Number(e.target.value) || 1))}
                className="h-12 text-center text-base font-semibold"
              />
              <Button type="button" variant="outline" size="icon" className="h-12 w-12 shrink-0" onClick={() => setQty(qty + 1)}>
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {mode === "keyboard" && (
            <Button onClick={() => addItem(barcode, qty)} className="h-12 w-full gap-2" style={{ background: "var(--gradient-primary)" }}>
              <Plus className="h-4 w-4" /> Adicionar
            </Button>
          )}
        </div>

        <div>
          <h3 className="mb-2 px-1 text-sm font-semibold">Itens coletados</h3>
          {items.length === 0 ? (
            <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-border py-10 text-muted-foreground">
              <Package className="h-8 w-8" />
              <p className="text-sm">Nenhum item ainda</p>
            </div>
          ) : (
            <ul className="space-y-2">
              {items.map((it) => (
                <li key={it.id} className="flex items-center gap-3 rounded-xl border border-border bg-card p-3 shadow-[var(--shadow-card)]">
                  <div className="flex-1 min-w-0">
                    <p className="truncate font-mono text-sm font-medium">{it.barcode}</p>
                    <p className="text-xs text-muted-foreground">Qtd: {it.quantity}</p>
                  </div>
                  <button onClick={() => removeItem(it.id)} className="rounded-lg p-2 text-muted-foreground hover:bg-destructive/10 hover:text-destructive">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="fixed inset-x-0 bottom-16 z-10 mx-auto max-w-md px-5 pb-3">
          <Button onClick={finish} disabled={finishing || items.length === 0} className="h-14 w-full rounded-2xl text-base font-semibold shadow-[var(--shadow-elegant)]" style={{ background: "var(--gradient-primary)" }}>
            {finishing ? <Loader2 className="h-5 w-5 animate-spin" /> : <><Check className="mr-2 h-5 w-5" /> Finalizar coleta</>}
          </Button>
        </div>
      </div>
    </AppShell>
  );
}
