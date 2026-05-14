CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TABLE public.product_inventory (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  internal_code TEXT,
  description TEXT,
  barcode TEXT NOT NULL,
  stock_coverage_days NUMERIC,
  days_without_sale NUMERIC,
  section TEXT,
  store TEXT,
  status TEXT NOT NULL DEFAULT 'nao_verificado',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (barcode, store)
);

CREATE INDEX idx_product_inventory_section ON public.product_inventory(section);
CREATE INDEX idx_product_inventory_store ON public.product_inventory(store);
CREATE INDEX idx_product_inventory_status ON public.product_inventory(status);
CREATE INDEX idx_product_inventory_barcode ON public.product_inventory(barcode);

ALTER TABLE public.product_inventory ENABLE ROW LEVEL SECURITY;

CREATE POLICY "public all product_inventory" ON public.product_inventory FOR ALL USING (true) WITH CHECK (true);

CREATE TRIGGER update_product_inventory_updated_at
BEFORE UPDATE ON public.product_inventory
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();