CREATE OR REPLACE FUNCTION public.inventory_distinct_sections()
RETURNS TABLE(section text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT DISTINCT section
  FROM public.product_inventory
  WHERE section IS NOT NULL AND section <> ''
  ORDER BY section
$$;

CREATE OR REPLACE FUNCTION public.inventory_distinct_stores()
RETURNS TABLE(store text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT DISTINCT store
  FROM public.product_inventory
  WHERE store IS NOT NULL AND store <> ''
  ORDER BY store
$$;

CREATE INDEX IF NOT EXISTS idx_product_inventory_section ON public.product_inventory(section);
CREATE INDEX IF NOT EXISTS idx_product_inventory_store ON public.product_inventory(store);
CREATE INDEX IF NOT EXISTS idx_product_inventory_status ON public.product_inventory(status);
CREATE INDEX IF NOT EXISTS idx_product_inventory_description ON public.product_inventory(description);