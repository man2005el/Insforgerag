-- 1. Agregar columnas description y embedding a products
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS embedding vector(1536);

-- 2. Índice HNSW para acelerar búsqueda vectorial por coseno
CREATE INDEX IF NOT EXISTS products_embedding_hnsw_idx
ON public.products
USING hnsw (embedding vector_cosine_ops);

-- 3. Función RPC match_products
CREATE OR REPLACE FUNCTION public.match_products(
  query_embedding vector(1536),
  count INT DEFAULT 5,
  threshold DOUBLE PRECISION DEFAULT 0.3
)
RETURNS TABLE (
  id INT,
  name VARCHAR(120),
  category VARCHAR(60),
  price NUMERIC(10,2),
  stock INT,
  similarity DOUBLE PRECISION
)
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT
    p.id,
    p.name,
    p.category,
    p.price,
    p.stock,
    (1 - (p.embedding <=> query_embedding))::DOUBLE PRECISION AS similarity
  FROM public.products p
  WHERE p.embedding IS NOT NULL
    AND 1 - (p.embedding <=> query_embedding) >= threshold
  ORDER BY p.embedding <=> query_embedding
  LIMIT count;
$$;

GRANT EXECUTE ON FUNCTION public.match_products(vector, INT, DOUBLE PRECISION) TO anon, authenticated;
