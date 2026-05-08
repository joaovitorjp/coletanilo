CREATE TABLE IF NOT EXISTS public.products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  internal_code text,
  barcode text NOT NULL UNIQUE,
  description text,
  package_type text,
  gramatura numeric NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_products_barcode ON public.products(barcode);
CREATE INDEX IF NOT EXISTS idx_products_internal_code ON public.products(internal_code);

ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "public all products" ON public.products
  FOR ALL USING (true) WITH CHECK (true);

-- Add description and gramatura snapshot to collection_items
ALTER TABLE public.collection_items
  ADD COLUMN IF NOT EXISTS description text,
  ADD COLUMN IF NOT EXISTS gramatura numeric;