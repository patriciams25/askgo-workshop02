/**
 * POST /api/invoice — Leitura de fatura (estágio 2). EXEMPLO pronto para a Vercel.
 * Body: { name, mimeType, base64 }  (PDF ou foto)  →  { total, items[] }
 * Cliente: src/services/ai.ts → readInvoice()
 * A pessoa confirma os itens antes de virarem lançamentos no app.
 */
import { json, missingKey, openaiResponses } from './_openai'
import { enforceBurstLimit, isResponse, requireSupabaseUser } from './_auth'

const MAX_BYTES = 3 * 1024 * 1024 // base64 + JSON permanecem abaixo do limite padrão da Vercel
const ALLOWED = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp']
const CATEGORIES = ['moradia', 'alimentacao', 'transporte', 'lazer', 'saude', 'outros']

const schema = {
  type: 'object',
  additionalProperties: false,
  required: ['total', 'items'],
  properties: {
    total: { type: 'number' },
    items: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['name', 'value', 'date', 'category', 'subscription'],
        properties: {
          name: { type: 'string' },
          value: { type: 'number' },
          date: { type: 'string', description: 'YYYY-MM-DD' },
          category: { type: 'string', enum: CATEGORIES },
          subscription: { type: 'boolean' },
        },
      },
    },
  },
}

export async function POST(request: Request) {
  if (!process.env.OPENAI_API_KEY) return missingKey()
  const auth = await requireSupabaseUser(request)
  if (isResponse(auth)) return auth
  const limited = enforceBurstLimit(auth.id)
  if (limited) return limited

  let parsed: unknown
  try { parsed = await request.json() } catch { return json({ error: 'JSON inválido' }, 400) }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return json({ error: 'Corpo inválido.' }, 400)
  const body = parsed as { name?: unknown; mimeType?: unknown; base64?: unknown }

  const { name = 'fatura', mimeType = '', base64 = '' } = body
  if (typeof name !== 'string' || !name.trim() || name.length > 180 || typeof mimeType !== 'string' || typeof base64 !== 'string') {
    return json({ error: 'Dados do arquivo inválidos.' }, 400)
  }
  if (!ALLOWED.includes(mimeType)) return json({ error: 'Envie PDF, JPG, PNG ou WEBP.' }, 415)
  if (!base64 || !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(base64)) return json({ error: 'Arquivo vazio ou inválido.' }, 400)
  const padding = base64.endsWith('==') ? 2 : base64.endsWith('=') ? 1 : 0
  if (base64.length * 0.75 - padding > MAX_BYTES) return json({ error: 'Arquivo grande demais (máximo 3 MB).' }, 413)

  const dataUrl = `data:${mimeType};base64,${base64}`
  const filePart = mimeType === 'application/pdf'
    ? { type: 'input_file', filename: name, file_data: dataUrl } // PDF: texto + páginas
    : { type: 'input_image', image_url: dataUrl } // foto: visão

  try {
    const text = await openaiResponses({
      input: [{
        role: 'user',
        content: [
          filePart,
          {
            type: 'input_text',
            text: 'Extraia todas as compras desta fatura de cartão. Valores positivos em reais. ' +
              'Marque subscription=true para cobranças recorrentes (streaming, apps, academia). ' +
              'Classifique cada compra numa das categorias. total = valor total da fatura.',
          },
        ],
      }],
      text: { format: { type: 'json_schema', name: 'fatura', strict: true, schema } },
    })
    const result = JSON.parse(text) as { total?: unknown; items?: unknown }
    if (typeof result.total !== 'number' || !Number.isFinite(result.total) || result.total < 0 || !Array.isArray(result.items)) {
      return json({ error: 'A leitura retornou dados inválidos.' }, 502)
    }
    return json(result)
  } catch {
    return json({ error: 'Não foi possível ler a fatura.' }, 502)
  }
}
