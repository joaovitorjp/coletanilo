import { useEffect, useRef } from "react";
import { Html5Qrcode } from "html5-qrcode";

export function BarcodeScanner({ onDetected, onClose }: { onDetected: (code: string) => void; onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const scannerRef = useRef<Html5Qrcode | null>(null);

  useEffect(() => {
    if (!ref.current) return;
    const id = "barcode-reader";
    ref.current.id = id;
    const scanner = new Html5Qrcode(id);
    scannerRef.current = scanner;
    scanner
      .start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 280, height: 160 } },
        (text) => {
          onDetected(text);
        },
        () => {}
      )
      .catch((e) => {
        console.error(e);
      });
    return () => {
      scanner.stop().then(() => scanner.clear()).catch(() => {});
    };
  }, [onDetected]);

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-background">
      <div className="flex items-center justify-between border-b border-border px-5 py-4">
        <h3 className="text-base font-semibold">Escanear código</h3>
        <button onClick={onClose} className="rounded-lg px-3 py-1.5 text-sm font-medium text-muted-foreground hover:bg-secondary">Fechar</button>
      </div>
      <div className="flex flex-1 items-center justify-center bg-black p-4">
        <div ref={ref} className="w-full max-w-md overflow-hidden rounded-xl" />
      </div>
      <p className="px-5 py-4 text-center text-xs text-muted-foreground">Aponte a câmera para o código de barras</p>
    </div>
  );
}
