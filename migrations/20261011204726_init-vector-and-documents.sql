-- Habilitar extensión pgvector
CREATE EXTENSION IF NOT EXISTS vector;

-- Tabla documents para almacenamiento de chunks y embeddings
CREATE TABLE IF NOT EXISTS public.documents (
  id BIGSERIAL PRIMARY KEY,
  content TEXT NOT NULL,
  source TEXT,
  embedding vector(1536) NOT NULL,
  embedding_model TEXT NOT NULL DEFAULT 'openai/text-embedding-3-small',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Políticas de seguridad RLS
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read documents"
ON public.documents
FOR SELECT TO anon, authenticated
USING (true);

CREATE POLICY "Allow insert documents"
ON public.documents
FOR INSERT TO anon, authenticated
WITH CHECK (true);

CREATE POLICY "Allow delete documents"
ON public.documents
FOR DELETE TO anon, authenticated
USING (true);

-- Otorgar permisos a los roles anon y authenticated
GRANT ALL ON public.documents TO anon, authenticated;
GRANT USAGE, SELECT ON SEQUENCE public.documents_id_seq TO anon, authenticated;

-- Índice vectorial HNSW para búsqueda rápida por similitud de coseno
CREATE INDEX IF NOT EXISTS documents_embedding_hnsw_idx
ON public.documents
USING hnsw (embedding vector_cosine_ops);

-- Función RPC para recuperación semántica (RAG)
CREATE OR REPLACE FUNCTION public.match_documents(
  query_embedding vector(1536),
  match_count INT DEFAULT 5,
  match_threshold DOUBLE PRECISION DEFAULT 0.0
)
RETURNS TABLE (
  id BIGINT,
  content TEXT,
  source TEXT,
  similarity DOUBLE PRECISION
)
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT
    public.documents.id,
    public.documents.content,
    public.documents.source,
    1 - (public.documents.embedding <=> query_embedding) AS similarity
  FROM public.documents
  WHERE 1 - (public.documents.embedding <=> query_embedding) >= match_threshold
  ORDER BY public.documents.embedding <=> query_embedding
  LIMIT match_count;
$$;

GRANT EXECUTE ON FUNCTION public.match_documents(vector, INT, DOUBLE PRECISION)
TO anon, authenticated;
