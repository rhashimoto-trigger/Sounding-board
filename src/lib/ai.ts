/**
 * 生成AI APIの呼び出し（非ストリーム版）
 * end/route.ts・advice/route.ts で使用
 */
export async function callAI({
  systemPrompt,
  messages,
}: {
  systemPrompt: string
  messages: { role: 'user' | 'assistant'; content: string }[]
}): Promise<string> {
  const apiKey = process.env.AI_API_KEY
  const apiBaseUrl = process.env.AI_API_BASE_URL

  if (!apiKey || !apiBaseUrl) {
    throw new Error('AI_API_KEY または AI_API_BASE_URL が設定されていません')
  }

  const response = await fetch(`${apiBaseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o',
      temperature: 0.7,
      max_tokens: 1500,
      messages: [
        { role: 'system', content: systemPrompt },
        ...messages,
      ],
    }),
  })

  if (!response.ok) {
    const errorBody = await response.text()
    throw new Error(`AI API エラー (${response.status}): ${errorBody}`)
  }

  const data = await response.json()
  const content = data.choices?.[0]?.message?.content
  if (!content) {
    throw new Error('AI APIから返信がありませんでした')
  }

  return content as string
}

/**
 * 生成AI APIの呼び出し（ストリーム版）
 * messages/route.ts で使用
 * OpenAI の Response オブジェクトをそのまま返す
 */
export async function callAIStream({
  systemPrompt,
  messages,
}: {
  systemPrompt: string
  messages: { role: 'user' | 'assistant'; content: string }[]
}): Promise<Response> {
  const apiKey = process.env.AI_API_KEY
  const apiBaseUrl = process.env.AI_API_BASE_URL

  if (!apiKey || !apiBaseUrl) {
    throw new Error('AI_API_KEY または AI_API_BASE_URL が設定されていません')
  }

  const response = await fetch(`${apiBaseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o',
      temperature: 0.7,
      max_tokens: 1500,
      stream: true,
      messages: [
        { role: 'system', content: systemPrompt },
        ...messages,
      ],
    }),
  })

  if (!response.ok) {
    const errorBody = await response.text()
    throw new Error(`AI API エラー (${response.status}): ${errorBody}`)
  }

  return response
}
