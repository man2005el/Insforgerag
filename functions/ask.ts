import { createClient } from 'npm:@insforge/sdk';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-api-key, x-openrouter-key'
};

const DB_SCHEMA = `
Esquema de base de datos PostgreSQL:

1. users (
  id SERIAL PRIMARY KEY,
  first_name VARCHAR(50) NOT NULL,
  last_name VARCHAR(50) NOT NULL,
  email VARCHAR(120) NOT NULL UNIQUE,
  phone VARCHAR(20),
  city VARCHAR(60),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
)

2. products (
  id SERIAL PRIMARY KEY,
  name VARCHAR(120) NOT NULL,
  category VARCHAR(60) NOT NULL,
  price NUMERIC(10,2) NOT NULL CHECK (price >= 0),
  stock INT NOT NULL DEFAULT 0,
  description TEXT
)

3. invoices (
  id SERIAL PRIMARY KEY,
  invoice_number VARCHAR(20) NOT NULL UNIQUE,
  user_id INT NOT NULL REFERENCES users(id),
  issued_at DATE NOT NULL,
  status VARCHAR(15) NOT NULL DEFAULT 'pagada' CHECK (status IN ('pagada','pendiente','anulada')),
  subtotal NUMERIC(10,2) NOT NULL,
  igv NUMERIC(10,2) NOT NULL, -- 18%
  total NUMERIC(10,2) NOT NULL
)

4. invoice_items (
  id SERIAL PRIMARY KEY,
  invoice_id INT NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  product_id INT NOT NULL REFERENCES products(id),
  quantity INT NOT NULL CHECK (quantity > 0),
  unit_price NUMERIC(10,2) NOT NULL,
  line_total NUMERIC(10,2) NOT NULL
)
`;

const SQL_SYSTEM_PROMPT = `Eres un asistente experto en PostgreSQL.
Tu tarea es convertir una pregunta en lenguaje natural en UNA SOLA consulta SQL SELECT válida para PostgreSQL utilizando el esquema provisto.

${DB_SCHEMA}

REGLAS OBLIGATORIAS:
1. Devuelve ÚNICAMENTE la consulta SQL en texto plano, sin explicaciones, sin comentarios ni formato markdown (no uses \`\`\`sql ni \`\`\`).
2. La consulta DEBE ser estrictamente de solo lectura (SELECT o WITH ... SELECT).
3. NUNCA uses INSERT, UPDATE, DELETE, DROP, ALTER, CREATE, TRUNCATE, GRANT ni REVOKE.
4. Aplica las relaciones correctas entre tablas:
   - invoices.user_id = users.id
   - invoice_items.invoice_id = invoices.id
   - invoice_items.product_id = products.id
5. Utiliza agrupamiento (GROUP BY) y agregaciones (SUM, AVG, COUNT, MAX, MIN) cuando corresponda.
6. Si la pregunta busca el valor máximo, superior o el principal, usa ORDER BY ... DESC LIMIT 1.
`;

const ANSWER_SYSTEM_PROMPT = `Eres un asistente experto que redacta respuestas amables, precisas y naturales en español basadas en los resultados obtenidos de una base de datos PostgreSQL.
Responde de forma clara y directa a la pregunta original del usuario utilizando los datos provistos.`;

const RECOMMENDATION_SYSTEM_PROMPT = `Eres un asistente experto y cordial de compras y recomendaciones.
El usuario busca productos según una necesidad o caso de uso específico.
A partir de los productos encontrados por similitud semántica y casos de uso, redacta una recomendación amable, atractiva y precisa en español destacando los nombres, categorías, precios y por qué cada opción es ideal para lo que busca.`;

/**
 * Invoca el LLM a través de OpenRouter o Model Gateway de InsForge
 */
async function callModelGateway(
  systemPrompt: string,
  userPrompt: string,
  apiKey?: string
): Promise<string> {
  const key = apiKey || Deno.env.get('OPENROUTER_API_KEY') || Deno.env.get('OPENAI_API_KEY');

  // 1. Proveedor configurado vía API Key (OpenRouter / OpenAI)
  if (key) {
    const isOpenRouter = key.startsWith('sk-or-') || !!Deno.env.get('OPENROUTER_API_KEY');
    const endpoint = isOpenRouter
      ? 'https://openrouter.ai/api/v1/chat/completions'
      : 'https://api.openai.com/v1/chat/completions';
    const model = isOpenRouter ? 'openai/gpt-4o-mini' : 'gpt-4o-mini';

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${key}`
    };

    if (isOpenRouter) {
      headers['HTTP-Referer'] = 'https://insforge.dev';
      headers['X-Title'] = 'InsForge RAG';
    }

    const res = await fetch(endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.2
      })
    });

    if (res.ok) {
      const data = await res.json();
      const content = data.choices?.[0]?.message?.content?.trim();
      if (content) return content;
    } else {
      const errText = await res.text();
      console.warn(`Error llamando a OpenRouter/OpenAI (${res.status}):`, errText);
    }
  }

  // 2. Model Gateway de InsForge
  const client = createClient({
    baseUrl: Deno.env.get('INSFORGE_BASE_URL') || 'https://d267y6sx.us-east.insforge.app',
    anonKey: Deno.env.get('ANON_KEY') || 'ik_dd4415a8e833437fb446ffa15f2bb335'
  });

  try {
    const res = await client.ai.chat.completions.create({
      model: 'openai/gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.2
    });
    if (res?.choices?.[0]?.message?.content) {
      return res.choices[0].message.content.trim();
    }
  } catch (err: any) {
    console.warn('Model Gateway no disponible directamente:', err?.message || err);
  }

  throw new Error('Model Gateway no disponible');
}

/**
 * Genera embedding vectorial de 1536 dimensiones usando text-embedding-3-small
 */
async function generateQueryEmbedding(text: string, apiKey?: string): Promise<number[]> {
  const key = apiKey || Deno.env.get('OPENROUTER_API_KEY') || Deno.env.get('OPENAI_API_KEY');

  if (key) {
    const isOpenRouter = key.startsWith('sk-or-') || !!Deno.env.get('OPENROUTER_API_KEY');
    const endpoint = isOpenRouter
      ? 'https://openrouter.ai/api/v1/embeddings'
      : 'https://api.openai.com/v1/embeddings';

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${key}`
    };
    if (isOpenRouter) {
      headers['HTTP-Referer'] = 'https://insforge.dev';
      headers['X-Title'] = 'InsForge RAG';
    }

    const res = await fetch(endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model: 'text-embedding-3-small',
        input: text
      })
    });

    if (res.ok) {
      const data = await res.json();
      if (data?.data?.[0]?.embedding) {
        return data.data[0].embedding;
      }
    }
  }

  // Fallback InsForge
  const client = createClient({
    baseUrl: Deno.env.get('INSFORGE_BASE_URL') || 'https://d267y6sx.us-east.insforge.app',
    anonKey: Deno.env.get('ANON_KEY') || 'ik_dd4415a8e833437fb446ffa15f2bb335'
  });

  try {
    const res = await client.ai.embeddings.create({
      model: 'openai/text-embedding-3-small',
      input: text
    });
    if (res?.data?.[0]?.embedding) {
      return res.data[0].embedding;
    }
  } catch (_e) {}

  throw new Error('No se pudo generar el embedding de la consulta');
}

/**
 * Clasifica si la consulta debe enrutarse por SQL relacional o búsqueda semántica por intención
 */
async function classifyQueryRoute(question: string, apiKey?: string): Promise<'sql' | 'intent_embedding'> {
  const qLower = question.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

  // Patrones claros de búsqueda semántica / recomendación / caso de uso
  const intentKeywords = [
    'busco', 'necesito', 'recomiendame', 'recomienda', 'sugerencia',
    'algo para', 'que me sirva para', 'trabajar comodo', 'trabajar comoda',
    'para la casa', 'para el hogar', 'para estudiar', 'para jugar',
    'opciones de', 'quiero algo', 'comodo', 'comoda', 'ergonomico', 'ergonomica'
  ];

  // Patrones claros de consulta de base de datos relacional exacta
  const sqlKeywords = [
    'mas caro', 'mas barato', 'mayor precio', 'menor precio',
    'quien gasto', 'quien compro', 'cuantos', 'cuantas', 'total de',
    'suma de', 'promedio', 'factura', 'facturas', 'usuario con', 'clientes que',
    'stock de', 'precio de'
  ];

  const hasIntent = intentKeywords.some(kw => qLower.includes(kw));
  const hasSql = sqlKeywords.some(kw => qLower.includes(kw));

  if (hasIntent && !hasSql) {
    return 'intent_embedding';
  }
  if (hasSql && !hasIntent) {
    return 'sql';
  }

  // Clasificación con LLM para preguntas ambiguas
  const CLASSIFIER_PROMPT = `Eres un enrutador inteligente de consultas para una base de datos comercial y catálogo de productos.
Clasifica la siguiente consulta en exactamente una de estas dos categorías:

- "sql": Preguntas sobre datos exactos, agregaciones, cálculos, máximos, mínimos, conteos, listas de facturas, clientes, precios específicos o inventario numérico. (Ejemplos: "¿cuál es el producto más caro?", "¿quién gastó más en total?", "¿cuántos usuarios hay en Lima?").
- "intent_embedding": Búsquedas por necesidad de uso, recomendaciones contextuales, intenciones semánticas o preferencias cualitativas. (Ejemplos: "busco algo para trabajar cómodo desde casa", "necesito preparar café en las mañanas", "algo portátil para estudiar").

Consulta: "${question}"

Responde ÚNICAMENTE con la palabra "sql" o "intent_embedding", sin puntuación ni texto adicional.`;

  try {
    const route = await callModelGateway(
      'Eres un clasificador de consultas. Responde únicamente "sql" o "intent_embedding".',
      CLASSIFIER_PROMPT,
      apiKey
    );
    const cleaned = route.toLowerCase().trim();
    if (cleaned.includes('intent_embedding') || cleaned.includes('embedding')) {
      return 'intent_embedding';
    }
    if (cleaned.includes('sql')) {
      return 'sql';
    }
  } catch (_e) {}

  return hasIntent ? 'intent_embedding' : 'sql';
}

/**
 * Limpia y normaliza el texto SQL generado por el LLM
 */
function cleanSql(rawSql: string): string {
  let sql = rawSql.trim();
  if (sql.startsWith('```')) {
    sql = sql.replace(/^```(?:sql)?\s*/i, '').replace(/\s*```$/, '');
  }
  sql = sql.replace(/^["']|["']$/g, '').trim();
  sql = sql.replace(/;+\s*$/, '').trim();
  return sql;
}

/**
 * Valida que la consulta SQL sea exclusivamente SELECT y no contenga operaciones destructivas
 */
function validateSql(sql: string): { valid: boolean; reason?: string } {
  const forbiddenKeywords = ['INSERT', 'UPDATE', 'DELETE', 'DROP', 'ALTER'];
  for (const kw of forbiddenKeywords) {
    const regex = new RegExp(`\\b${kw}\\b`, 'i');
    if (regex.test(sql)) {
      return { valid: false, reason: `La consulta contiene la instrucción no permitida: ${kw}` };
    }
  }

  const extraForbidden = ['TRUNCATE', 'CREATE', 'GRANT', 'REVOKE'];
  for (const kw of extraForbidden) {
    const regex = new RegExp(`\\b${kw}\\b`, 'i');
    if (regex.test(sql)) {
      return { valid: false, reason: `La consulta contiene una instrucción restringida: ${kw}` };
    }
  }

  const trimmed = sql.trim().toUpperCase();
  if (!trimmed.startsWith('SELECT') && !trimmed.startsWith('WITH')) {
    return { valid: false, reason: 'Solo se permiten consultas de tipo SELECT.' };
  }

  if (/;(?!\s*$)/.test(sql)) {
    return { valid: false, reason: 'No se permiten múltiples sentencias SQL en una sola consulta.' };
  }

  return { valid: true };
}

/**
 * Aplica un límite máximo de 50 filas a la consulta SQL
 */
function applyLimit(sql: string, maxLimit = 50): string {
  const limitMatch = sql.match(/\bLIMIT\s+(\d+)\b/i);
  if (limitMatch) {
    const currentLimit = parseInt(limitMatch[1], 10);
    if (currentLimit <= maxLimit) {
      return sql;
    }
    return sql.replace(/\bLIMIT\s+\d+\b/i, `LIMIT ${maxLimit}`);
  }
  return `${sql} LIMIT ${maxLimit}`;
}

export default async function (req: Request): Promise<Response> {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'Método no permitido. Utiliza POST.' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  try {
    const body = await req.json().catch(() => ({}));
    const { question, apiKey } = body;

    if (!question || typeof question !== 'string' || question.trim().length === 0) {
      return new Response(
        JSON.stringify({ error: 'El campo "question" es obligatorio y debe ser un texto.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const trimmedQuestion = question.trim();
    const customKey = apiKey || req.headers.get('x-api-key') || req.headers.get('x-openrouter-key') || undefined;

    // Inicializar cliente de InsForge
    const insforge = createClient({
      baseUrl: Deno.env.get('INSFORGE_BASE_URL') || 'https://d267y6sx.us-east.insforge.app',
      anonKey: Deno.env.get('ANON_KEY') || 'ik_dd4415a8e833437fb446ffa15f2bb335'
    });

    // 1. Decidir ruta: datos exactos -> SQL, búsqueda por intención -> embeddings + match_products
    const route = await classifyQueryRoute(trimmedQuestion, customKey);

    // =========================================================================
    // RUTA BÚSQUEDA POR INTENCIÓN: EMBEDDINGS + MATCH_PRODUCTS
    // =========================================================================
    if (route === 'intent_embedding') {
      // a. Generar embedding de la intención con text-embedding-3-small
      const queryEmbedding = await generateQueryEmbedding(trimmedQuestion, customKey);

      // b. Ejecutar RPC match_products
      const { data: matchedProducts, error: rpcError } = await insforge.database.rpc('match_products', {
        query_embedding: queryEmbedding,
        count: 5,
        threshold: 0.3
      });

      if (rpcError) {
        throw new Error(`Error en match_products: ${rpcError.message || JSON.stringify(rpcError)}`);
      }

      let rows = Array.isArray(matchedProducts) ? matchedProducts : [];
      if (rows.length === 0) {
        // Fallback a umbral más flexible si 0.3 es muy estricto
        const retry = await insforge.database.rpc('match_products', {
          query_embedding: queryEmbedding,
          count: 5,
          threshold: 0.1
        });
        rows = Array.isArray(retry.data) ? retry.data : [];
      }

      // c. Redactar recomendación en español con el LLM
      const draftPrompt = `Necesidad / búsqueda del usuario: "${trimmedQuestion}"

Productos encontrados por similitud semántica en el catálogo:
${JSON.stringify(rows, null, 2)}

Por favor, redacta una respuesta concisa, organizada y natural en español recomendando de forma directa las opciones que mejor se adaptan a lo que busca.`;

      let answer = '';
      try {
        answer = await callModelGateway(RECOMMENDATION_SYSTEM_PROMPT, draftPrompt, customKey);
      } catch (_e) {
        if (rows.length > 0) {
          const topList = rows.map((r: any) => `• ${r.name} (S/ ${r.price}) - Categoría: ${r.category}`).join('\n');
          answer = `Te recomiendo las siguientes opciones que se ajustan a tu búsqueda:\n${topList}`;
        } else {
          answer = 'No se encontraron productos que coincidan con la intención de búsqueda.';
        }
      }

      return new Response(
        JSON.stringify({
          route: 'intent_embedding',
          answer,
          sql: null,
          rows
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // =========================================================================
    // RUTA DATOS EXACTOS: TEXT-TO-SQL
    // =========================================================================
    let rawSql = '';
    try {
      rawSql = await callModelGateway(
        SQL_SYSTEM_PROMPT,
        `Pregunta: "${trimmedQuestion}"\nGenera únicamente la consulta SQL SELECT para responder esta pregunta.`,
        customKey
      );
    } catch (_llmErr) {
      // Fallback básico si falla el Model Gateway
      rawSql = 'SELECT * FROM products ORDER BY price DESC LIMIT 1';
    }

    let parsedSql = cleanSql(rawSql);

    // Validación de seguridad (sin INSERT, UPDATE, DELETE, DROP ni ALTER)
    const validation = validateSql(parsedSql);
    if (!validation.valid) {
      return new Response(
        JSON.stringify({
          route: 'sql',
          error: `Consulta SQL rechazada por validación de seguridad: ${validation.reason}`,
          sql: parsedSql
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Límite estricto de máximo 50 filas
    const finalSql = applyLimit(parsedSql, 50);

    // Ejecución de la consulta en PostgreSQL
    const { data: rowsData, error: sqlError } = await insforge.database.rpc('execute_sql', {
      query_text: finalSql
    });

    if (sqlError) {
      return new Response(
        JSON.stringify({
          route: 'sql',
          error: `Error al ejecutar la consulta SQL: ${sqlError.message || JSON.stringify(sqlError)}`,
          sql: finalSql
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const rows = Array.isArray(rowsData) ? rowsData : [];

    // Redactar respuesta en español
    const draftPrompt = `Pregunta original: "${trimmedQuestion}"
Consulta SQL ejecutada:
${finalSql}

Resultados devueltos por la base de datos:
${JSON.stringify(rows, null, 2)}

Por favor, redacta una respuesta concisa, natural y directa en español respondiendo a la pregunta original basándote en los datos anteriores.`;

    let answer = '';
    try {
      answer = await callModelGateway(ANSWER_SYSTEM_PROMPT, draftPrompt, customKey);
    } catch (_llmErr) {
      answer = `Se obtuvieron ${rows.length} resultados de la base de datos.`;
    }

    return new Response(
      JSON.stringify({
        route: 'sql',
        answer,
        sql: finalSql,
        rows
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    return new Response(
      JSON.stringify({
        error: error.message || 'Error interno del servidor procesando la consulta.'
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
}
