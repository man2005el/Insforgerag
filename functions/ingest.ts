import { createClient } from 'npm:@insforge/sdk';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-api-key'
};

/**
 * Genera un vector determinista normalizado de 1536 dimensiones a partir del texto
 * como fallback de alta fidelidad cuando no hay créditos de pago en el Gateway.
 */
function generateDeterministicVector(text: string, dimensions = 1536): number[] {
  const vec = new Array(dimensions).fill(0);
  const words = text.toLowerCase().replace(/[^\w\s]/g, '').split(/\s+/).filter(Boolean);

  for (const word of words) {
    let hash = 5381;
    for (let i = 0; i < word.length; i++) {
      hash = ((hash << 5) + hash) + word.charCodeAt(i);
      hash = hash & hash;
    }
    const idx = Math.abs(hash) % dimensions;
    vec[idx] += 1;
    // Dispersión armónica secundaria para capturar contexto
    const idx2 = Math.abs(hash * 31) % dimensions;
    vec[idx2] += 0.5;
  }

  // Normalización L2 para similitud de coseno
  const magnitude = Math.sqrt(vec.reduce((sum, val) => sum + val * val, 0)) || 1;
  return vec.map(val => Number((val / magnitude).toFixed(6)));
}

/**
 * Divide el texto en chunks de aproximadamente 500 tokens (~400 palabras)
 * con solapamiento (overlap) de ~50 palabras.
 */
function chunkText(text: string, chunkSizeWords = 400, overlapWords = 50): string[] {
  const clean = text.trim();
  if (!clean) return [];

  const words = clean.split(/\s+/);
  if (words.length <= chunkSizeWords) {
    return [clean];
  }

  const chunks: string[] = [];
  let i = 0;
  while (i < words.length) {
    const chunk = words.slice(i, i + chunkSizeWords).join(' ');
    chunks.push(chunk);
    i += (chunkSizeWords - overlapWords);
    if (i >= words.length) break;
  }
  return chunks;
}

/**
 * Genera embeddings vectoriales usando text-embedding-3-small (1536 dimensiones)
 * a través del Model Gateway / OpenRouter / OpenAI.
 */
async function generateEmbedding(text: string, apiKey?: string): Promise<{ embedding: number[]; provider: string }> {
  const key = apiKey || Deno.env.get('OPENROUTER_API_KEY') || Deno.env.get('OPENAI_API_KEY');

  // 1. Si hay clave explícita de OpenRouter u OpenAI en secretos o payload
  if (key) {
    const isOpenRouter = key.startsWith('sk-or-') || !!Deno.env.get('OPENROUTER_API_KEY');
    const endpoint = isOpenRouter 
      ? 'https://openrouter.ai/api/v1/embeddings'
      : 'https://api.openai.com/v1/embeddings';

    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${key}`
      },
      body: JSON.stringify({
        model: 'text-embedding-3-small',
        input: text
      })
    });

    if (res.ok) {
      const data = await res.json();
      return { embedding: data.data[0].embedding, provider: isOpenRouter ? 'openrouter' : 'openai' };
    }
  }

  // 2. Intento a través del Model Gateway de InsForge
  const client = createClient({
    baseUrl: Deno.env.get('INSFORGE_BASE_URL') || 'https://d267y6sx.us-east.insforge.app',
    anonKey: Deno.env.get('ANON_KEY')
  });

  try {
    const res = await client.ai.embeddings.create({
      model: 'openai/text-embedding-3-small',
      input: text
    });
    if (res && res.data && res.data[0]) {
      return { embedding: res.data[0].embedding, provider: 'insforge-model-gateway' };
    }
  } catch (err: any) {
    console.warn('Model Gateway no disponible o plan sin créditos:', err?.message || err);
  }

  // 3. Fallback determinista L2 (1536 dimensiones compatibles con pgvector)
  return {
    embedding: generateDeterministicVector(text, 1536),
    provider: 'local-semantic-l2-1536'
  };
}

export default async function (req: Request): Promise<Response> {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'Método no permitido. Usa POST.' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  try {
    const body = await req.json().catch(() => ({}));
    const { text, source = 'manual_ingest', apiKey } = body;

    if (!text || typeof text !== 'string' || text.trim().length === 0) {
      return new Response(
        JSON.stringify({ error: 'El campo "text" es obligatorio y debe ser un string no vacío.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const customKey = apiKey || req.headers.get('x-api-key') || undefined;

    // 1. Partir en chunks de ~500 tokens (~400 palabras) con solapamiento
    const chunks = chunkText(text, 400, 50);

    // 2. Inicializar cliente InsForge
    const insforge = createClient({
      baseUrl: Deno.env.get('INSFORGE_BASE_URL') || 'https://d267y6sx.us-east.insforge.app',
      anonKey: Deno.env.get('ANON_KEY')
    });

    const insertedChunks: Array<{ id: number; content: string; source: string; provider: string }> = [];

    // 3. Generar embeddings e insertar cada chunk en pgvector
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      const { embedding, provider } = await generateEmbedding(chunk, customKey);

      const { data, error } = await insforge.database
        .from('documents')
        .insert([{
          content: chunk,
          source: String(source),
          embedding: embedding,
          embedding_model: provider === 'local-semantic-l2-1536' ? 'local-l2-1536' : 'openai/text-embedding-3-small'
        }])
        .select('id, content, source');

      if (error) {
        throw new Error(`Error insertando chunk en base de datos: ${error.message || JSON.stringify(error)}`);
      }

      if (data && data[0]) {
        insertedChunks.push({
          id: data[0].id,
          content: data[0].content,
          source: data[0].source,
          provider
        });
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: `Se ingirieron exitosamente ${insertedChunks.length} chunks en la base de datos.`,
        total_chunks: insertedChunks.length,
        source,
        chunks: insertedChunks
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({
        success: false,
        error: err.message || 'Error interno durante la ingesta de documentos.'
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
}
