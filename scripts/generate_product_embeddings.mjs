import { createClient } from '@insforge/sdk';
import fs from 'fs';
import path from 'path';

// Cargar variables de entorno desde .env.local
const envFile = fs.readFileSync(path.resolve('.env.local'), 'utf-8');
const env = {};
for (const line of envFile.split('\n')) {
  const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
  if (match) {
    env[match[1]] = match[2]?.trim();
  }
}

const INSFORGE_URL = env.INSFORGE_OSS_HOST || 'https://d267y6sx.us-east.insforge.app';
const INSFORGE_KEY = env.INSFORGE_API_KEY || env.ANON_KEY;
const OPENROUTER_KEY = env.OPENROUTER_API_KEY;

if (!OPENROUTER_KEY) {
  console.error('No se encontró OPENROUTER_API_KEY en .env.local');
  process.exit(1);
}

const client = createClient({
  baseUrl: INSFORGE_URL,
  anonKey: INSFORGE_KEY
});

async function generateDescription(product) {
  const prompt = `Producto: "${product.name}"
Categoría: "${product.category}"

Genera una descripción en español de exactamente 3 a 4 líneas enfocada exclusivamente en sus casos de uso reales, beneficios prácticos y en qué situaciones de trabajo, estudio, entretenimiento u hogar es ideal.
IMPORTANTE:
- NO menciones precios, costos, ofertas ni moneda.
- NO menciones stock, inventario ni unidades disponibles.
- No uses viñetas, solo un párrafo fluido de 3-4 líneas.`;

  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${OPENROUTER_KEY}`,
      'HTTP-Referer': 'https://insforge.dev',
      'X-Title': 'InsForge RAG Embedding Generation'
    },
    body: JSON.stringify({
      model: 'openai/gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'Eres un redactor experto en catálogo de productos. Redactas descripciones concisas de 3 a 4 líneas en español centradas únicamente en casos de uso y utilidad práctica cotidiana. Nunca mencionas precio ni stock.'
        },
        { role: 'user', content: prompt }
      ],
      temperature: 0.3
    })
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Error generando descripción para ${product.name}: ${err}`);
  }

  const data = await res.json();
  return data.choices[0].message.content.trim();
}

async function generateEmbedding(text) {
  const res = await fetch('https://openrouter.ai/api/v1/embeddings', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${OPENROUTER_KEY}`,
      'HTTP-Referer': 'https://insforge.dev',
      'X-Title': 'InsForge RAG Embedding Generation'
    },
    body: JSON.stringify({
      model: 'text-embedding-3-small',
      input: text
    })
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Error generando embedding: ${err}`);
  }

  const data = await res.json();
  return data.data[0].embedding;
}

async function main() {
  console.log('Obteniendo lista de productos...');
  const { data: products, error } = await client.database
    .from('products')
    .select('id, name, category, price, stock')
    .order('id', { ascending: true });

  if (error || !products) {
    console.error('Error obteniendo productos:', error);
    process.exit(1);
  }

  console.log(`Total de productos a procesar: ${products.length}`);

  for (let i = 0; i < products.length; i++) {
    const p = products[i];
    console.log(`[${i + 1}/${products.length}] Procesando producto: "${p.name}" (ID: ${p.id})...`);

    try {
      // 1. Generar descripción de 3-4 líneas
      const description = await generateDescription(p);
      console.log(`   -> Descripción generada: ${description.replace(/\n/g, ' ').slice(0, 80)}...`);

      // 2. Generar embedding con text-embedding-3-small
      // Embeber el texto descriptivo junto con el nombre y categoría para maximizar similitud semántica
      const textToEmbed = `${p.name}. Categoría: ${p.category}. ${description}`;
      const embedding = await generateEmbedding(textToEmbed);
      console.log(`   -> Embedding 1536 dimensiones generado.`);

      // 3. Actualizar la fila en PostgreSQL
      const { error: updateError } = await client.database
        .from('products')
        .update({
          description,
          embedding: JSON.stringify(embedding)
        })
        .eq('id', p.id);

      if (updateError) {
        console.error(`   Error al actualizar producto ${p.id}:`, updateError);
      } else {
        console.log(`   ✓ Fila actualizada con éxito.`);
      }

      // Pequeña pausa para evitar rate limit
      await new Promise(r => setTimeout(r, 200));
    } catch (e) {
      console.error(`   Error en producto ${p.id}:`, e.message || e);
    }
  }

  console.log('\n¡Todos los productos han sido procesados y actualizados con éxito!');
}

main();
