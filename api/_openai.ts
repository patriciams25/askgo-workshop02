/**
 * Helper de servidor para a OpenAI (Responses API via fetch, sem SDK).
 * Roda APENAS nas Vercel Functions — process.env nunca chega ao navegador.
 */

export const OPENAI_MODEL = process.env.OPENAI_MODEL || 'gpt-4o-mini'

export function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  })
}

export function missingKey() {
  return json({ error: 'OPENAI_API_KEY não configurada no servidor.' }, 503)
}

/** Chama POST /v1/responses e devolve o texto final. */
export async function openaiResponses(body: Record<string, unknown>): Promise<string> {
  const res = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ model: OPENAI_MODEL, ...body }),
  })
  if (!res.ok) {
    // não repassa detalhes internos para o cliente
    console.error('OpenAI error', res.status, await res.text())
    throw new Error(`OpenAI ${res.status}`)
  }
  const data = (await res.json()) as {
    output?: { type: string; content?: { type: string; text?: string }[] }[]
  }
  return (data.output ?? [])
    .filter((o) => o.type === 'message')
    .flatMap((o) => o.content ?? [])
    .filter((c) => c.type === 'output_text')
    .map((c) => c.text ?? '')
    .join('')
}
