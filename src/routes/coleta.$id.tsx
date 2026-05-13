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

type Item = { id: string; barcode: string; quantity: number; created_at: string; description: string | null; gramatura: number | null };
type Coll = { id: string; number: number; store_code: string; store_name: string; status: string };
type Product = { internal_code: string | null; barcode: string; description: string | null; package_type: string | null; gramatura: number };

function ColetaPage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const [coll, setColl] = useState<Coll | null>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [mode, setMode] = useState<"keyboard" | "scan">("keyboard");
  const [barcode, setBarcode] = useState("");
  const [qtyBox, setQtyBox] = useState<string>("");
  const [qtyUnit, setQtyUnit] = useState<string>("");
  const [scanning, setScanning] = useState(false);
  const [product, setProduct] = useState<Product | null>(null);
  const [lookingUp, setLookingUp] = useState(false);
  const qtyBoxRef = useRef<HTMLInputElement>(null);
  const qtyUnitRef = useRef<HTMLInputElement>(null);
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

  const lookupProduct = async (code: string): Promise<Product | null> => {
    const clean = code.trim();
    if (!clean) return null;
    setLookingUp(true);
    const { data } = await supabase
      .from("products")
      .select("internal_code,barcode,description,package_type,gramatura")
      .or(`barcode.eq.${clean},internal_code.eq.${clean}`)
      .maybeSingle();
    setLookingUp(false);
    return (data as Product) ?? null;
  };

  // Lookup product when barcode changes (debounced)
  useEffect(() => {
    const code = barcode.trim();
    if (!code) { setProduct(null); return; }
    const t = setTimeout(async () => {
      const p = await lookupProduct(code);
      setProduct(p);
    }, 250);
    return () => clearTimeout(t);
  }, [barcode]);

  const addItem = async (code: string, qBox: string, qUnit: string) => {
    const clean = code.trim();
    const units = parseFloat((qUnit || "").replace(",", "."));
    if (!clean) { toast.error("Informe o código"); return; }
    if (!units || units <= 0) { toast.error("Informe a quantidade"); qtyUnitRef.current?.focus(); return; }

    const p = product && (product.barcode === clean || product.internal_code === clean) ? product : await lookupProduct(clean);
    if (!p) { toast.error("Produto não encontrado na base"); return; }

    const g = Number(p.gramatura) || 1;

    const { data, error } = await supabase
      .from("collection_items")
      .insert({ collection_id: id, barcode: p.barcode, quantity: units, description: p.description, gramatura: g })
      .select()
      .single();
    if (error) { toast.error(error.message); return; }
    setItems((prev) => [data as Item, ...prev]);
    setBarcode("");
    setQtyBox("");
    setQtyUnit("");
    setProduct(null);
    toast.success(`${p.description ?? p.barcode} × ${units}`);
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
    navigate({ to: "/historico" });
  };

  if (!coll) return <AppShell><div className="flex justify-center pt-10"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div></AppShell>;

  const totalQty = items.reduce((s, i) => s + Number(i.quantity), 0);
  const g = product ? Number(product.gramatura) || 1 : 1;
  const hasBox = !!product && g > 1;

  const fmt = (n: number) => {
    if (!isFinite(n)) return "";
    const r = Math.round(n * 1000) / 1000;
    return String(r);
  };
  const handleBoxChange = (v: string) => {
    const clean = v.replace(/[^0-9.,]/g, "").replace(",", ".");
    setQtyBox(clean);
    if (clean === "" || clean === ".") { setQtyUnit(""); return; }
    const n = parseFloat(clean);
    if (isNaN(n)) { setQtyUnit(""); return; }
    setQtyUnit(fmt(n * g));
  };
  const handleUnitChange = (v: string) => {
    const clean = v.replace(/[^0-9.,]/g, "").replace(",", ".");
    setQtyUnit(clean);
    if (!hasBox) return;
    if (clean === "" || clean === ".") { setQtyBox(""); return; }
    const n = parseFloat(clean);
    if (isNaN(n)) { setQtyBox(""); return; }
    setQtyBox(fmt(n / g));
  };

  return (
    <AppShell title={`Coleta #${String(coll.number).padStart(3, "0")}`}>
      <Toaster richColors position="top-center" />
      {scanning && (
        <BarcodeScanner
          onDetected={(code) => {
            setScanning(false);
            setBarcode(code);
            setQtyBox("");
            setQtyUnit("");
            toast.info(`Código ${code} — informe a quantidade`);
            setTimeout(() => (qtyBoxRef.current ?? qtyUnitRef.current)?.focus(), 100);
          }}
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
              placeholder="Código de barras ou interno"
              value={barcode}
              onChange={(e) => setBarcode(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") (qtyBoxRef.current ?? qtyUnitRef.current)?.focus(); }}
              className="h-12 text-base"
            />
          ) : (
            <Button onClick={() => setScanning(true)} variant="outline" className="h-12 w-full gap-2">
              <Camera className="h-4 w-4" /> Abrir câmera
            </Button>
          )}

          {barcode && (
            <div className={`rounded-xl border p-3 text-sm ${product ? "border-primary/30 bg-primary/5" : "border-destructive/30 bg-destructive/5"}`}>
              {lookingUp ? (
                <div className="flex items-center gap-2 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Buscando...</div>
              ) : product ? (
                <>
                  <p className="font-medium leading-snug">{product.description ?? product.barcode}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {product.package_type ?? "—"} {product.gramatura}
                    {g > 1 && <span className="ml-2">• 1 cx = {g} un</span>}
                  </p>
                </>
              ) : (
                <p className="font-medium text-destructive">Produto não encontrado na base</p>
              )}
            </div>
          )}

          <div className={hasBox ? "grid grid-cols-2 gap-2" : ""}>
            {hasBox && (
              <div>
                <label className="text-xs font-medium text-muted-foreground">Caixas</label>
                <Input
                  ref={qtyBoxRef}
                  type="text"
                  inputMode="decimal"
                  placeholder="0"
                  value={qtyBox}
                  onChange={(e) => handleBoxChange(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") addItem(barcode, qtyBox, qtyUnit); }}
                  className="h-12 mt-1 text-center text-base font-semibold"
                />
              </div>
            )}
            <div>
              <label className="text-xs font-medium text-muted-foreground">Unidades</label>
              <Input
                ref={qtyUnitRef}
                type="text"
                inputMode="decimal"
                placeholder="0"
                value={qtyUnit}
                onChange={(e) => handleUnitChange(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") addItem(barcode, qtyBox, qtyUnit); }}
                className="h-12 mt-1 text-center text-base font-semibold"
              />
            </div>
          </div>

          <Button onClick={() => addItem(barcode, qtyBox, qtyUnit)} disabled={!barcode || !qtyUnit || !product} className="h-12 w-full gap-2" style={{ background: "var(--gradient-primary)" }}>
            <Plus className="h-4 w-4" /> Adicionar
          </Button>
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
                    {it.description && <p className="truncate text-sm font-medium">{it.description}</p>}
                    <p className="truncate font-mono text-xs text-muted-foreground">{it.barcode}</p>
                    <p className="text-xs text-muted-foreground">
                      Qtd: <strong className="text-foreground">{it.quantity}</strong>
                      {it.gramatura && Number(it.gramatura) > 1 && (
                        <span className="ml-2">({Number(it.quantity) / Number(it.gramatura)} × {it.gramatura})</span>
                      )}
                    </p>
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
