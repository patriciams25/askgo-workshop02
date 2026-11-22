/**
 * POST /api/chat — Assistente Eskgo (estágio 2). EXEMPLO pronto para a Vercel.
 * Body: { messages: {role, content}[], context: {...} }  →  { reply }
 * Cliente: src/services/ai.ts → askAssistant()
 */
import { json, missingKey, openaiResponses } from './_openai'
import { enforceBurstLimit, isResponse, requireSupabaseUser } from './_auth'

const MAX_ATTACHMENT_BYTES = 3 * 1024 * 1024
const ALLOWED_ATTACHMENTS = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp']

const INSTRUCTIONS = `Você é o Assistente Eskgo, em PT-BR, tom próximo e direto, sem coach.
Responda SEMPRE com o número primeiro e a consequência em uma linha,
usando apenas os dados do contexto do usuário. Valores em R$.
Se faltar dado, diga o que falta. Não dê recomendação de investimento.`

export async function POST(request: Request) {
  if (!process.env.OPENAI_API_KEY) return missingKey()
  const auth = await requireSupabaseUser(request)
  if (isResponse(auth)) return auth
  const limited = enforceBurstLimit(auth.id)
  if (limited) return limited

  let parsed: unknown
  try { parsed = await request.json() } catch { return json({ error: 'JSON inválido' }, 400) }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return json({ error: 'Corpo inválido.' }, 400)
  const body = parsed as { messages?: unknown; context?: unknown; attachment?: unknown }
  if (!Array.isArray(body.messages)) return json({ error: 'Envie uma lista de mensagens.' }, 400)

  const messages = body.messages
    .filter((m): m is { role: string; content: string } => !!m && typeof m === 'object' && !Array.isArray(m)
      && ((m as { role?: unknown }).role === 'user' || (m as { role?: unknown }).role === 'assistant')
      && typeof (m as { content?: unknown }).content === 'string')
    .slice(-12)
    .map((m) => ({ role: m.role, content: m.content.slice(0, 2000) }))
  if (!messages.length) return json({ error: 'Sem mensagens' }, 400)

  let attachment: { name: string; mimeType: string; base64: string } | undefined
  if (body.attachment != null) {
    if (!body.attachment || typeof body.attachment !== 'object' || Array.isArray(body.attachment)) return json({ error: 'Anexo inválido.' }, 400)
    const candidate = body.attachment as Record<string, unknown>
    if (typeof candidate.name !== 'string' || !candidate.name.trim() || candidate.name.length > 180
      || typeof candidate.mimeType !== 'string' || !ALLOWED_ATTACHMENTS.includes(candidate.mimeType)
      || typeof candidate.base64 !== 'string' || !candidate.base64
      || !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(candidate.base64)) {
      return json({ error: 'Anexe um PDF ou imagem JPG, PNG ou WebP válido.' }, 400)
    }
    const padding = candidate.base64.endsWith('==') ? 2 : candidate.base64.endsWith('=') ? 1 : 0
    if (candidate.base64.length * 0.75 - padding > MAX_ATTACHMENT_BYTES) return json({ error: 'O anexo excede 3 MB.' }, 413)
    attachment = { name: candidate.name.trim(), mimeType: candidate.mimeType, base64: candidate.base64 }
  }

  const input = messages.map((message, index) => {
    if (!attachment || index !== messages.length - 1 || message.role !== 'user') return message
    const filePart = attachment.mimeType === 'application/pdf'
      ? { type: 'input_file', filename: attachment.name, file_data: `data:${attachment.mimeType};base64,${attachment.base64}` }
      : { type: 'input_image', image_url: `data:${attachment.mimeType};base64,${attachment.base64}` }
    return { role: message.role, content: [{ type: 'input_text', text: message.content }, filePart] }
  })

  try {
    const reply = await openaiResponses({
      instructions: `${INSTRUCTIONS}\n\nContexto do usuário (JSON):\n${JSON.stringify(body.context ?? {}).slice(0, 30000)}`,
      input,
    })
    if (!reply.trim()) return json({ error: 'A IA não retornou uma resposta.' }, 502)
    return json({ reply })
  } catch {
    return json({ error: 'Não foi possível responder agora.' }, 502)
  }
}
